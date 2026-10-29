// Command eval-roteador mede o roteador de intenções contra o conjunto
// rotulado (eval/roteamento/mensagens.jsonl): acerto e tempo de cada chamada.
//
// Usa o mesmo cliente e modelos do servidor (GEMINI_MODEL, OPENROUTER_MODEL,
// com o fallback). Roda os dois roteadores do código:
//   - legado: ClassifyIntent (o que está em produção hoje)
//   - rapido: state.EvaluateWithLLM (ENABLE_FAST_ROUTER)
//
// Uso: eval-roteador -arquivo mensagens.jsonl -saida resultado.json
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
	_ "time/tzdata" // a imagem mínima não tem fusos; o cliente usa o de Maputo/Brasília

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
)

type mensagem struct {
	ID              string `json:"id"`
	Texto           string `json:"texto"`
	Origem          string `json:"origem"`
	Pais            string `json:"pais"`
	PrecisaContexto bool   `json:"precisa_contexto"`
	Intencao        string `json:"intencao"`
	Escrita         bool   `json:"escrita"`
	Tema            string `json:"tema"`
}

type resultado struct {
	ID       string `json:"id"`
	Texto    string `json:"texto"`
	Esperado string `json:"esperado"`
	Pais     string `json:"pais"`
	Origem   string `json:"origem"`
	Tema     string `json:"tema"`
	Escrita  bool   `json:"escrita"`

	Legado      string `json:"legado"`
	LegadoOK    bool   `json:"legado_ok"`
	LegadoMs    int64  `json:"legado_ms"`
	LegadoModel string `json:"legado_modelo"`
	LegadoErro  string `json:"legado_erro,omitempty"`

	Rapido        string `json:"rapido"`
	RapidoOK      bool   `json:"rapido_ok"`
	RapidoEscrita bool   `json:"rapido_escrita"`
	RapidoMs      int64  `json:"rapido_ms"`
	RapidoErro    string `json:"rapido_erro,omitempty"`
}

// legadoBate: o roteador legado fala RAG/DATABASE/CHAT/REGISTRO_FINANCEIRO.
func legadoBate(esperado, obtido string) bool {
	switch esperado {
	case "AGRONOMY":
		return obtido == "RAG"
	case "DATABASE":
		return obtido == "DATABASE" || obtido == "REGISTRO_FINANCEIRO"
	case "CHAT", "CLARIFICATION":
		return obtido == "CHAT"
	}
	return false
}

func rapidoBate(esperado, obtido string) bool {
	if esperado == "CLARIFICATION" {
		return obtido == "CLARIFICATION" || obtido == "CHAT"
	}
	return esperado == obtido
}

func main() {
	arquivo := flag.String("arquivo", "eval/roteamento/mensagens.jsonl", "conjunto rotulado")
	saida := flag.String("saida", "resultado-roteador.json", "onde gravar o detalhe por mensagem")
	paralelo := flag.Int("paralelo", 3, "chamadas simultâneas")
	limite := flag.Int("limite", 0, "usar só as N primeiras (0 = todas)")
	flag.Parse()

	msgs, err := ler(*arquivo)
	if err != nil {
		log.Fatal(err)
	}
	if *limite > 0 && *limite < len(msgs) {
		msgs = msgs[:*limite]
	}

	version := os.Getenv("GEMINI_API_VERSION")
	if version == "" {
		version = "v1"
	}
	cli, err := gemini.NewClient(gemini.Config{
		APIKey:           os.Getenv("GEMINI_API_KEY"),
		OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
		Model:            os.Getenv("GEMINI_MODEL"),
		OpenRouterModel:  os.Getenv("OPENROUTER_MODEL"),
		FallbackModel:    os.Getenv("GEMINI_FALLBACK_MODEL"),
		APIVersion:       version,
	})
	if err != nil {
		log.Fatal(err)
	}
	log.SetOutput(os.Stderr)

	res := make([]resultado, len(msgs))
	sem := make(chan struct{}, *paralelo)
	var wg sync.WaitGroup
	for i, m := range msgs {
		wg.Add(1)
		sem <- struct{}{}
		go func(i int, m mensagem) {
			defer wg.Done()
			defer func() { <-sem }()
			r := resultado{ID: m.ID, Texto: m.Texto, Esperado: m.Intencao, Pais: m.Pais, Origem: m.Origem, Tema: m.Tema, Escrita: m.Escrita}

			ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			t := time.Now()
			u, modelo, err := cli.ClassifyIntent(ctx, m.Texto)
			r.LegadoMs, r.LegadoModel = time.Since(t).Milliseconds(), modelo
			cancel()
			if err != nil {
				r.LegadoErro = err.Error()
			} else if len(u.Intents) > 0 {
				r.Legado = string(u.Intents[0])
			}
			r.LegadoOK = legadoBate(m.Intencao, r.Legado)

			ctx, cancel = context.WithTimeout(context.Background(), 45*time.Second)
			t = time.Now()
			f, err := state.EvaluateWithLLM(ctx, cli, m.Texto)
			r.RapidoMs = time.Since(t).Milliseconds()
			cancel()
			if err != nil {
				r.RapidoErro = err.Error()
			} else {
				r.Rapido, r.RapidoEscrita = string(f.PrimaryIntent), f.NeedsWrite
			}
			r.RapidoOK = rapidoBate(m.Intencao, r.Rapido)
			res[i] = r
			fmt.Fprintf(os.Stderr, ".")
		}(i, m)
	}
	wg.Wait()
	fmt.Fprintln(os.Stderr)

	b, _ := json.MarshalIndent(res, "", "  ")
	if err := os.WriteFile(*saida, b, 0o644); err != nil {
		log.Fatal(err)
	}
	relatorio(res)
}

func ler(caminho string) ([]mensagem, error) {
	f, err := os.Open(caminho)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out []mensagem
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	for sc.Scan() {
		var m mensagem
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			return nil, err
		}
		if !m.PrecisaContexto { // sem a conversa anterior não há resposta certa
			out = append(out, m)
		}
	}
	return out, sc.Err()
}

func relatorio(res []resultado) {
	fmt.Printf("Mensagens: %d (sem as que dependem de contexto)\n\n", len(res))
	fmt.Println("                 acerto   p50     p90     máx    erros  fallback")
	linha := func(nome string, ok func(resultado) bool, ms func(resultado) int64, erro func(resultado) bool, fb func(resultado) bool) {
		var acertos, erros, fallbacks int
		var tempos []int64
		for _, r := range res {
			if ok(r) {
				acertos++
			}
			if erro(r) {
				erros++
			}
			if fb(r) {
				fallbacks++
			}
			tempos = append(tempos, ms(r))
		}
		sort.Slice(tempos, func(i, j int) bool { return tempos[i] < tempos[j] })
		q := func(p float64) string {
			return fmt.Sprintf("%.1fs", float64(tempos[int(p*float64(len(tempos)-1))])/1000)
		}
		fmt.Printf("%-16s %5.1f%%  %-7s %-7s %-6s %5d  %5d\n", nome, 100*float64(acertos)/float64(len(res)), q(0.5), q(0.9), q(1), erros, fallbacks)
	}
	linha("legado (prod)", func(r resultado) bool { return r.LegadoOK }, func(r resultado) int64 { return r.LegadoMs },
		func(r resultado) bool { return r.LegadoErro != "" }, func(r resultado) bool { return strings.Contains(r.LegadoModel, "/") })
	linha("rápido", func(r resultado) bool { return r.RapidoOK }, func(r resultado) int64 { return r.RapidoMs },
		func(r resultado) bool { return r.RapidoErro != "" }, func(r resultado) bool { return false })

	var esc, escOK int
	for _, r := range res {
		if r.RapidoErro == "" {
			esc++
			if r.RapidoEscrita == r.Escrita {
				escOK++
			}
		}
	}
	if esc > 0 {
		fmt.Printf("\nRápido, needs_write certo: %.1f%%\n", 100*float64(escOK)/float64(esc))
	}

	fmt.Println("\nAcerto por grupo (legado / rápido):")
	grupos := map[string][3]int{}
	for _, r := range res {
		for _, g := range []string{"país " + r.Pais, "origem " + r.Origem, "esperado " + r.Esperado} {
			v := grupos[g]
			v[0]++
			if r.LegadoOK {
				v[1]++
			}
			if r.RapidoOK {
				v[2]++
			}
			grupos[g] = v
		}
	}
	var nomes []string
	for g := range grupos {
		nomes = append(nomes, g)
	}
	sort.Strings(nomes)
	for _, g := range nomes {
		v := grupos[g]
		fmt.Printf("  %-22s n=%-4d %5.1f%% / %5.1f%%\n", g, v[0], 100*float64(v[1])/float64(v[0]), 100*float64(v[2])/float64(v[0]))
	}

	fmt.Println("\nErros do legado (esperado → obtido):")
	for _, r := range res {
		if !r.LegadoOK {
			fmt.Printf("  %s %-13s → %-20s %s\n", r.ID, r.Esperado, r.Legado+erroCurto(r.LegadoErro), corta(r.Texto))
		}
	}
	fmt.Println("\nErros do rápido (esperado → obtido):")
	for _, r := range res {
		if !r.RapidoOK {
			fmt.Printf("  %s %-13s → %-20s %s\n", r.ID, r.Esperado, r.Rapido+erroCurto(r.RapidoErro), corta(r.Texto))
		}
	}
}

func erroCurto(e string) string {
	if e == "" {
		return ""
	}
	return " (erro)"
}

func corta(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if r := []rune(s); len(r) > 70 {
		return string(r[:70]) + "…"
	}
	return s
}
