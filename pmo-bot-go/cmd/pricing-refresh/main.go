// Command pricing-refresh regenera internal/pricing/catalog.json a partir do
// catálogo público da OpenRouter.
//
// Existe para que a tabela de custos não seja um punhado de números digitados à
// mão no código — que era o estado anterior (DT-05): preços decorados, só de
// Gemini, e custo ZERO para qualquer modelo não reconhecido, tornando invisível
// todo o gasto com o fallback.
//
// Uso:
//
//	go run ./cmd/pricing-refresh                 # só modelos com tool calling
//	go run ./cmd/pricing-refresh -all            # catálogo completo
//	go run ./cmd/pricing-refresh -check          # não escreve; só audita
//
// O modo -check é o mais importante no dia a dia: ele avisa se algum modelo em
// uso foi DESCONTINUADO. Foi exatamente esse cenário que quebrou a cadeia de
// fallback em produção — `gemini-1.5-flash` havia sido aposentado e ninguém
// percebeu até o bot parar de responder.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"
)

const catalogURL = "https://openrouter.ai/api/v1/models"

type orResponse struct {
	Data []orModel `json:"data"`
}

type orModel struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	ContextLength  int    `json:"context_length"`
	ExpirationDate string `json:"expiration_date"`
	Pricing        struct {
		Prompt     string `json:"prompt"`
		Completion string `json:"completion"`
		// Overrides carrega preços condicionais (contexto longo, janelas de
		// horário). NÃO são modelados aqui: o custo calculado assume sempre as
		// condições padrão. Para prompts muito grandes o valor real pode ser
		// maior — ver a limitação registrada no README do pacote.
		Overrides []map[string]any `json:"overrides"`
	} `json:"pricing"`
	SupportedParameters []string `json:"supported_parameters"`
}

type modelPrice struct {
	InputPerMillion  float64 `json:"in"`
	OutputPerMillion float64 `json:"out"`
	ContextLength    int     `json:"ctx,omitempty"`
	ExpiresAt        string  `json:"expires_at,omitempty"`
	HasOverrides     bool    `json:"conditional_pricing,omitempty"`
}

type catalog struct {
	GeneratedAt string                `json:"generated_at"`
	Source      string                `json:"source"`
	Filter      string                `json:"filter"`
	Note        string                `json:"note"`
	Models      map[string]modelPrice `json:"models"`
}

// modelosEmUso são os modelos que o sistema realmente configura hoje. O modo
// -check verifica especificamente se algum deles sumiu ou está para expirar.
var modelosEmUso = []string{
	"google/gemini-3.1-flash-lite",
	"google/gemini-3.7-flash",
	"google/gemini-2.5-flash",
}

func main() {
	incluirTodos := flag.Bool("all", false, "inclui modelos sem suporte a tool calling")
	apenasChecar := flag.Bool("check", false, "não escreve o arquivo; audita o catálogo atual")
	saida := flag.String("o", filepath.Join("internal", "pricing", "catalog.json"), "arquivo de saída")
	flag.Parse()

	url := catalogURL
	filtro := "supported_parameters=tools"
	if *incluirTodos {
		filtro = "nenhum"
	} else {
		// O bot depende de tool calling; um modelo sem isso não é candidato
		// viável, por mais barato que seja.
		url += "?supported_parameters=tools"
	}

	models, err := fetch(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro ao buscar catálogo: %v\n", err)
		os.Exit(1)
	}

	cat := catalog{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Source:      url,
		Filter:      filtro,
		Note: "Gerado por cmd/pricing-refresh. Preços em USD por 1M de tokens, " +
			"nas condições padrão — pricing.overrides (contexto longo, janelas de " +
			"horário) NÃO está modelado.",
		Models: map[string]modelPrice{},
	}

	var expirando []string
	for _, m := range models {
		in, err1 := strconv.ParseFloat(m.Pricing.Prompt, 64)
		out, err2 := strconv.ParseFloat(m.Pricing.Completion, 64)
		if err1 != nil || err2 != nil || in <= 0 {
			continue // sem preço utilizável (gratuito ou não informado)
		}
		cat.Models[m.ID] = modelPrice{
			InputPerMillion:  in * 1e6,
			OutputPerMillion: out * 1e6,
			ContextLength:    m.ContextLength,
			ExpiresAt:        m.ExpirationDate,
			HasOverrides:     len(m.Pricing.Overrides) > 0,
		}
		if m.ExpirationDate != "" {
			expirando = append(expirando, fmt.Sprintf("%s (expira em %s)", m.ID, m.ExpirationDate))
		}
	}

	fmt.Printf("Catálogo: %d modelos com preço (filtro: %s)\n", len(cat.Models), filtro)

	// Auditoria dos modelos em uso — o ponto que evita repetir o incidente do
	// gemini-1.5-flash, aposentado sem que o sistema soubesse.
	fmt.Println("\nModelos configurados no sistema:")
	problemas := 0
	for _, id := range modelosEmUso {
		p, ok := cat.Models[id]
		switch {
		case !ok:
			fmt.Printf("  ❌ %-34s AUSENTE DO CATÁLOGO — pode ter sido descontinuado\n", id)
			problemas++
		case p.ExpiresAt != "":
			fmt.Printf("  ⚠️  %-34s expira em %s\n", id, p.ExpiresAt)
			problemas++
		default:
			fmt.Printf("  ✅ %-34s in US$%.3f/1M  out US$%.3f/1M\n", id, p.InputPerMillion, p.OutputPerMillion)
		}
	}

	if len(expirando) > 0 {
		fmt.Printf("\n%d modelo(s) do catálogo têm data de expiração anunciada.\n", len(expirando))
		sort.Strings(expirando)
		for _, e := range expirando[:min(5, len(expirando))] {
			fmt.Printf("  · %s\n", e)
		}
	}

	if *apenasChecar {
		if problemas > 0 {
			fmt.Printf("\n%d problema(s) encontrado(s).\n", problemas)
			os.Exit(1)
		}
		fmt.Println("\nNenhum problema com os modelos em uso.")
		return
	}

	blob, err := json.MarshalIndent(cat, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro ao serializar: %v\n", err)
		os.Exit(1)
	}
	if err := os.WriteFile(*saida, blob, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "erro ao escrever %s: %v\n", *saida, err)
		os.Exit(1)
	}
	fmt.Printf("\nEscrito: %s (%d bytes)\n", *saida, len(blob))
}

func fetch(url string) ([]orModel, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, body)
	}

	var parsed orResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	return parsed.Data, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
