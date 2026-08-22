// Package pricing resolve o custo por token de qualquer modelo, de qualquer
// fornecedor.
//
// Motivação (DT-05): a tabela anterior vivia embutida num `switch` em
// internal/state/utils.go, com preços digitados à mão, entendia basicamente
// Gemini e — pior — retornava **custo zero** para qualquer modelo não
// reconhecido. Como o sistema passou a escalar para a OpenRouter, todo o gasto
// com o fallback ficava invisível no relatório.
//
// Princípio: o projeto não deve ficar preso a um fornecedor. A escolha de
// modelo precisa ser decidida por custo/qualidade medidos, não por inércia de
// integração. Para isso, o catálogo:
//
//   - cobre múltiplos fornecedores (Google, Anthropic, OpenAI, Meta, DeepSeek,
//     Qwen, Mistral e outros), não só o que está em uso hoje;
//   - vem de uma fonte verificável e atualizável (`cmd/pricing-refresh`), em vez
//     de números decorados no código;
//   - é consultado offline, sem HTTP no caminho quente.
package pricing

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

//go:embed catalog.json
var catalogJSON []byte

// ModelPrice é o preço em USD por 1 milhão de tokens.
type ModelPrice struct {
	InputPerMillion  float64 `json:"in"`
	OutputPerMillion float64 `json:"out"`
}

// Catalog é o mapa id-do-modelo → preço, gerado por cmd/pricing-refresh.
type Catalog struct {
	GeneratedAt string                `json:"generated_at"`
	Source      string                `json:"source"`
	Models      map[string]ModelPrice `json:"models"`
}

var (
	loadOnce sync.Once
	catalog  Catalog
	loadErr  error
)

func load() (Catalog, error) {
	loadOnce.Do(func() {
		loadErr = json.Unmarshal(catalogJSON, &catalog)
	})
	return catalog, loadErr
}

// Estimate é o resultado de uma consulta de custo.
//
// Exact indica se o preço veio do catálogo ou de uma estimativa conservadora.
// A distinção existe porque silenciar a incerteza foi exatamente o defeito
// anterior: um modelo desconhecido custava "zero" e sumia do relatório.
type Estimate struct {
	CostUSD    float64
	ModelFound string
	Exact      bool
}

// fallbackPrice é usado quando o modelo não está no catálogo.
//
// Deliberadamente CARO, não barato: um custo desconhecido subestimado engana a
// decisão de arquitetura (faz um modelo parecer viável quando não é), enquanto
// um superestimado apenas provoca uma conferência. Na dúvida, erre para cima.
var fallbackPrice = ModelPrice{InputPerMillion: 3.0, OutputPerMillion: 15.0}

// Lookup encontra o preço de um modelo, tolerando as variações de nome que
// aparecem entre fornecedores.
//
// O mesmo modelo chega escrito de formas diferentes conforme o caminho:
// "gemini-3.1-flash-lite" (SDK do Google) e "google/gemini-3.1-flash-lite"
// (OpenRouter). Sufixos como ":batch" ou datas de versão também aparecem.
func Lookup(model string) (ModelPrice, string, bool) {
	c, err := load()
	if err != nil || len(c.Models) == 0 {
		return fallbackPrice, "", false
	}

	m := strings.ToLower(strings.TrimSpace(model))
	if m == "" {
		return fallbackPrice, "", false
	}

	// 1. Correspondência exata.
	if p, ok := c.Models[m]; ok {
		return p, m, true
	}

	// 2. Sem o prefixo de fornecedor ("google/x" → "x") e vice-versa.
	if i := strings.Index(m, "/"); i >= 0 {
		if p, ok := c.Models[m[i+1:]]; ok {
			return p, m[i+1:], true
		}
	}
	for id, p := range c.Models {
		if i := strings.Index(id, "/"); i >= 0 && id[i+1:] == m {
			return p, id, true
		}
	}

	// 3. Prefixo mais longo: cobre sufixos de data e variantes
	//    ("gemini-3.1-flash-lite-preview" → "gemini-3.1-flash-lite").
	best, bestLen := "", 0
	for id := range c.Models {
		base := id
		if i := strings.Index(id, "/"); i >= 0 {
			base = id[i+1:]
		}
		if strings.HasPrefix(m, base) && len(base) > bestLen {
			best, bestLen = id, len(base)
		}
	}
	if best != "" {
		return c.Models[best], best, true
	}

	return fallbackPrice, "", false
}

// Cost calcula o custo em USD de uma chamada.
func Cost(model string, inputTokens, outputTokens int) Estimate {
	p, found, exact := Lookup(model)
	cost := (float64(inputTokens)/1e6)*p.InputPerMillion +
		(float64(outputTokens)/1e6)*p.OutputPerMillion
	return Estimate{CostUSD: cost, ModelFound: found, Exact: exact}
}

// Meta descreve a proveniência do catálogo, para o relatório poder informar
// quão recente é o dado em que a decisão de custo se apoia.
func Meta() (generatedAt, source string, models int) {
	c, err := load()
	if err != nil {
		return "", "", 0
	}
	return c.GeneratedAt, c.Source, len(c.Models)
}

// Compare devolve os N modelos mais baratos para um perfil de uso, servindo de
// insumo objetivo para o roteador por complexidade (DT-34).
//
// Recebe a proporção real de tokens de entrada/saída porque a ordem muda com
// ela: modelos com saída cara podem ser os mais baratos em tarefas de
// classificação (muita entrada, pouca saída) e os mais caros em geração.
func Compare(inputTokens, outputTokens, limit int) []string {
	c, err := load()
	if err != nil {
		return nil
	}

	type row struct {
		id   string
		cost float64
	}
	rows := make([]row, 0, len(c.Models))
	for id, p := range c.Models {
		rows = append(rows, row{id, (float64(inputTokens)/1e6)*p.InputPerMillion +
			(float64(outputTokens)/1e6)*p.OutputPerMillion})
	}

	for i := 1; i < len(rows); i++ {
		for j := i; j > 0 && rows[j].cost < rows[j-1].cost; j-- {
			rows[j], rows[j-1] = rows[j-1], rows[j]
		}
	}

	if limit > len(rows) {
		limit = len(rows)
	}
	out := make([]string, 0, limit)
	for i := 0; i < limit; i++ {
		out = append(out, fmt.Sprintf("%s (US$ %.6f)", rows[i].id, rows[i].cost))
	}
	return out
}
