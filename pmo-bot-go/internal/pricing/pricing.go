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

// CacheMultiplier descreve o preço de tokens de cache da OpenRouter em
// relação ao preço normal de entrada do modelo (DT-37/prompt caching).
//
// Read é o multiplicador de um token servido do cache (barato — o provedor já
// processou aquele prefixo antes). Write é o multiplicador do primeiro
// armazenamento (a maioria dos fornecedores cobra um prêmio por isso; alguns
// não cobram nada extra). Fonte: docs/PLAN-openrouter-prompt-caching.md,
// capturado da documentação oficial da OpenRouter.
type CacheMultiplier struct {
	Read  float64
	Write float64
}

// noCacheMultiplier é usado quando o fornecedor do modelo não tem
// multiplicador documentado. Mesma política do fallbackPrice: não presumir
// desconto que pode não existir — 1.0x equivale a tratar o token de cache como
// um token de entrada normal, nunca mais barato que a realidade.
var noCacheMultiplier = CacheMultiplier{Read: 1.0, Write: 1.0}

// cacheMultipliers é indexado pelo prefixo de fornecedor da OpenRouter (a
// parte antes da "/"). Os valores vêm da documentação capturada em
// docs/PLAN-openrouter-prompt-caching.md (seção "Multiplicadores Base").
//
// Nota sobre a linha "Groq/Moonshot: 0.5x / 0.25x" da fonte: a documentação
// não distingue explicitamente qual valor é leitura e qual é escrita para
// cada um dos dois fornecedores nessa linha — interpretação conservadora
// aplicada abaixo (0.5x leitura para Groq, 0.25x leitura para Moonshot,
// escrita sem desconto documentado). Como Cost é só estimativa de relatório,
// não faturamento real, o pior caso de um multiplicador impreciso aqui é uma
// estimativa levemente errada — nunca uma cobrança real incorreta.
var cacheMultipliers = map[string]CacheMultiplier{
	"anthropic":  {Read: 0.1, Write: 1.25}, // TTL de 5min; 2.0x para TTL de 1h (não modelado)
	"google":     {Read: 0.25, Write: 1.0}, // sem custo extra de escrita além do preço normal + armazenamento
	"openai":     {Read: 0.25, Write: 1.25},
	"x-ai":       {Read: 0.25, Write: 1.0}, // Grok
	"deepseek":   {Read: 0.1, Write: 1.0},
	"alibaba":    {Read: 0.1, Write: 1.25},
	"qwen":       {Read: 0.1, Write: 1.25}, // mesmo fornecedor que "alibaba/" em alguns catálogos
	"groq":       {Read: 0.5, Write: 1.0},
	"moonshotai": {Read: 0.25, Write: 1.0},
}

// cacheMultiplierFor resolve o multiplicador de cache pelo prefixo de
// fornecedor do id do modelo (formato OpenRouter: "fornecedor/modelo").
func cacheMultiplierFor(model string) CacheMultiplier {
	m := strings.ToLower(strings.TrimSpace(model))
	if i := strings.Index(m, "/"); i >= 0 {
		if cm, ok := cacheMultipliers[m[:i]]; ok {
			return cm
		}
	}
	return noCacheMultiplier
}

// CostWithCache calcula o custo em USD de uma chamada que usou prompt
// caching, separando os tokens de entrada em não-cacheados, lidos do cache e
// escritos no cache.
//
// cachedReadTokens e cacheWriteTokens devem vir da telemetria real da
// resposta (ex: prompt_tokens_details.cached_tokens/cache_write_tokens da
// OpenRouter) — nunca estimados, porque a hit rate do cache não é previsível
// a priori. inputTokens deve ser o total de tokens de entrada da chamada,
// INCLUINDO os que vieram do cache (mesma convenção da API: prompt_tokens já
// conta os cached_tokens dentro do total).
func CostWithCache(model string, inputTokens, cachedReadTokens, cacheWriteTokens, outputTokens int) Estimate {
	p, found, exact := Lookup(model)

	// cacheMultiplierFor resolve pelo prefixo "fornecedor/" — mas o chamador
	// pode passar um id sem prefixo (ex: CallGoogle devolve "gemini-3.1-..."
	// puro, sem "google/"). Usar `found` em vez de `model` aproveita a mesma
	// normalização que Lookup já fez: toda entrada do catálogo gerado tem
	// prefixo de fornecedor, então quando exact==true, found sempre tem
	// "fornecedor/modelo" — mesmo que o `model` recebido não tivesse. Sem
	// isso, o caminho Gemini nativo (produção primária) sempre caía em
	// noCacheMultiplier mesmo com cache real.
	cm := cacheMultiplierFor(found)

	freshInputTokens := inputTokens - cachedReadTokens
	if freshInputTokens < 0 {
		freshInputTokens = 0
	}

	cost := (float64(freshInputTokens)/1e6)*p.InputPerMillion +
		(float64(cachedReadTokens)/1e6)*p.InputPerMillion*cm.Read +
		(float64(cacheWriteTokens)/1e6)*p.InputPerMillion*cm.Write +
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
