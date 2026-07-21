// Package benchmark implementa o Model Shootout multi-cenário: testa cada
// modelo em 5 cenários realistas baseados no padrão fat-database com RPCs do
// Supabase, medindo latência, custo real e completude do payload gerado.
package benchmark

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"text/tabwriter"
	"time"
)

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const (
	openRouterAPIURL    = "https://openrouter.ai/api/v1/chat/completions"
	openRouterModelsURL = "https://openrouter.ai/api/v1/models"
	maxRetries          = 3
	httpTimeout         = 90 * time.Second
)

// ---------------------------------------------------------------------------
// Structs HTTP / Chat
// ---------------------------------------------------------------------------

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type toolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type tool struct {
	Type     string       `json:"type"`
	Function toolFunction `json:"function"`
}

type chatRequest struct {
	Model      string    `json:"model"`
	Messages   []message `json:"messages"`
	Tools      []tool    `json:"tools,omitempty"`
	ToolChoice string    `json:"tool_choice,omitempty"`
}

type usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type apiError struct {
	Message string `json:"message"`
}

type toolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type chatResponse struct {
	ID      string `json:"id"`
	Choices []struct {
		Message struct {
			Role      string     `json:"role"`
			Content   string     `json:"content"`
			ToolCalls []toolCall `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage usage    `json:"usage"`
	Error apiError `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// Structs de Preços (Models API)
// ---------------------------------------------------------------------------

type modelPricingInfo struct {
	Prompt     string `json:"prompt"`
	Completion string `json:"completion"`
}

type modelInfo struct {
	ID      string           `json:"id"`
	Pricing modelPricingInfo `json:"pricing"`
}

type modelsResponse struct {
	Data []modelInfo `json:"data"`
}

// ---------------------------------------------------------------------------
// Resultado por cenário
// ---------------------------------------------------------------------------

// ScenarioResult contém o resultado de um modelo para um cenário específico.
type ScenarioResult struct {
	ScenarioName      string
	ToolCallSuccess   bool
	FieldsPresent     []string
	FieldsMissing     []string
	CompletenessScore float64 // 0.0 a 1.0
	Latency           time.Duration
	PromptTokens      int
	CompletionTokens  int
	TotalTokens       int
	CostPer1kTokens   float64
	TotalCostRun      float64
	Status            string
	Attempts          int
	RawArguments      string
	// Campos exclusivos de cenários multi-tool
	ToolCallCount     int // Quantas tool_calls o modelo efetivamente gerou
	ExpectedToolCalls int // Quantas eram esperadas (0 = cenário single)
}

// ModelReport consolida todos os cenários de um único modelo.
type ModelReport struct {
	Model     string
	Scenarios []ScenarioResult
}

// ---------------------------------------------------------------------------
// Definição de Cenários
// ---------------------------------------------------------------------------

// Scenario descreve um caso de teste: o contexto do sistema, a mensagem do
// usuário, a ferramenta esperada e a função que valida os argumentos gerados.
type Scenario struct {
	Name         string
	Description  string
	SystemPrompt string
	UserMessage  string
	Tool         tool
	// RequiredFields são os campos que o modelo DEVE extrair para sucesso total.
	RequiredFields []string
	// ValidateFn inspeciona o map de argumentos (cenários single-tool).
	ValidateFn func(args map[string]any) (present []string, missing []string)
	// MultiValidateFn valida TODOS os tool_calls de uma só vez (cenários multi-tool).
	// Quando definido, sobrepõe ValidateFn. Recebe a fatia inteira de chamadas.
	MultiValidateFn func(calls []toolCall) (present []string, missing []string)
	// ExpectedToolCalls indica quantas chamadas simultâneas são esperadas (0 = single).
	ExpectedToolCalls int
}

// buildScenarios constrói os 6 cenários baseados nas RPCs reais do projeto.
func buildScenarios() []Scenario {
	return []Scenario{
		// ----------------------------------------------------------------
		// Cenário 1: rpc_registrar_operacao_campo — Manejo
		// ----------------------------------------------------------------
		{
			Name:        "S1:RegistrarManejo",
			Description: "Extração de operação de manejo a partir de linguagem natural de produtor",
			SystemPrompt: `Você é o assistente agrônomo do sistema Manejo Org. 
Quando o produtor relatar uma atividade de campo, chame imediatamente a ferramenta 
rpc_registrar_operacao_campo com os dados extraídos da mensagem.
O campo tipo_arg deve ser exatamente um de: Limpeza, Propagacao, Plantio, Manejo, Compostagem, Colheita, Venda.`,
			UserMessage: "Hoje apliquei 2 litros de calda bordalesa no talhão Canteiro A. Foi método de pulverização foliar.",
			Tool: tool{
				Type: "function",
				Function: toolFunction{
					Name:        "rpc_registrar_operacao_campo",
					Description: "Registra uma operação de campo no caderno agrônomo. SEMPRE chame esta função quando o produtor relatar uma atividade.",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"tipo_arg": map[string]any{
								"type":        "string",
								"enum":        []string{"Limpeza", "Propagacao", "Plantio", "Manejo", "Compostagem", "Colheita", "Venda"},
								"description": "Tipo de operação de campo",
							},
							"payload_arg": map[string]any{
								"type":        "object",
								"description": "Dados específicos da operação",
								"properties": map[string]any{
									"insumo":            map[string]any{"type": "string"},
									"quantidade":        map[string]any{"type": "string"},
									"metodo_aplicacao":  map[string]any{"type": "string"},
									"talhao_nome":       map[string]any{"type": "string"},
									"data":              map[string]any{"type": "string"},
								},
							},
						},
						"required": []string{"tipo_arg", "payload_arg"},
					},
				},
			},
			RequiredFields: []string{"tipo_arg", "payload_arg.insumo", "payload_arg.talhao_nome"},
			ValidateFn: func(args map[string]any) ([]string, []string) {
				required := []string{"tipo_arg", "payload_arg.insumo", "payload_arg.talhao_nome", "payload_arg.metodo_aplicacao"}
				return checkNestedFields(args, required)
			},
		},

		// ----------------------------------------------------------------
		// Cenário 2: rpc_registrar_compra_insumo — Extração de NF
		// ----------------------------------------------------------------
		{
			Name:        "S2:RegistrarCompra",
			Description: "Extração de entidades de uma compra de insumo com nota fiscal",
			SystemPrompt: `Você é o assistente financeiro do sistema Manejo Org.
Quando o produtor informar uma compra de insumo, chame a ferramenta rpc_registrar_compra_insumo 
extraindo todos os dados mencionados: produto, quantidade, unidade, fornecedor, valor e nota fiscal.`,
			UserMessage: "Comprei 50 kg de farinha de osso do fornecedor João Adubos por R$ 180,00. Nota fiscal número 4521.",
			Tool: tool{
				Type: "function",
				Function: toolFunction{
					Name:        "rpc_registrar_compra_insumo",
					Description: "Registra a compra de um insumo no sistema, atualizando o estoque e o módulo financeiro.",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"produto_arg":           map[string]any{"type": "string", "description": "Nome do insumo comprado"},
							"quantidade_valor_arg":  map[string]any{"type": "number", "description": "Quantidade numérica"},
							"quantidade_unidade_arg": map[string]any{"type": "string", "description": "Unidade (kg, L, un, etc)"},
							"fornecedor_arg":        map[string]any{"type": "string", "description": "Nome do fornecedor"},
							"valor_total_arg":       map[string]any{"type": "number", "description": "Valor total pago em reais"},
							"nota_fiscal_arg":       map[string]any{"type": "string", "description": "Número da nota fiscal"},
						},
						"required": []string{"produto_arg", "quantidade_valor_arg", "quantidade_unidade_arg"},
					},
				},
			},
			RequiredFields: []string{"produto_arg", "quantidade_valor_arg", "quantidade_unidade_arg", "fornecedor_arg", "valor_total_arg", "nota_fiscal_arg"},
			ValidateFn: func(args map[string]any) ([]string, []string) {
				required := []string{"produto_arg", "quantidade_valor_arg", "quantidade_unidade_arg", "fornecedor_arg", "valor_total_arg", "nota_fiscal_arg"}
				return checkNestedFields(args, required)
			},
		},

		// ----------------------------------------------------------------
		// Cenário 3: get_dre_mensal — Consulta analítica (read-only)
		// ----------------------------------------------------------------
		{
			Name:        "S3:ConsultaDRE",
			Description: "Consulta analítica financeira — modelo deve acionar RPC de leitura correta",
			SystemPrompt: `Você é o assistente financeiro do sistema Manejo Org. O ID da sua propriedade atual é 1.
EXECUÇÃO OBRIGATÓRIA DE TOOL FINANCEIRA: Se o usuário fizer qualquer pergunta sobre saldo, receita, despesas, balanço financeiro, DRE ou saúde financeira da fazenda, você DEVE OBRIGATORIAMENTE chamar a ferramenta de consulta (get_dre_mensal). NUNCA responda com texto livre ou estimativas financeiras sem antes extrair os dados reais usando a ferramenta.
NUNCA tente registrar dados quando o produtor está apenas perguntando.`,
			UserMessage: "Qual foi o meu resultado financeiro ao longo do ano de 2026? Quero ver mês a mês.",
			Tool: tool{
				Type: "function",
				Function: toolFunction{
					Name:        "get_dre_mensal",
					Description: "Retorna o DRE (Demonstrativo de Resultado) mensal de uma propriedade para um ano específico.",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"p_propriedade_id": map[string]any{
								"type":        "integer",
								"description": "ID da propriedade do produtor",
							},
							"p_ano": map[string]any{
								"type":        "integer",
								"description": "Ano de referência para o DRE",
							},
						},
						"required": []string{"p_propriedade_id", "p_ano"},
					},
				},
			},
			RequiredFields: []string{"p_propriedade_id", "p_ano"},
			ValidateFn: func(args map[string]any) ([]string, []string) {
				required := []string{"p_propriedade_id", "p_ano"}
				return checkNestedFields(args, required)
			},
		},

		// ----------------------------------------------------------------
		// Cenário 4: match_farm_documents — RAG / Busca semântica
		// ----------------------------------------------------------------
		{
			Name:        "S4:BuscaRAG",
			Description: "Consulta de conhecimento agronômico — modelo deve acionar busca RAG antes de responder",
			SystemPrompt: `Você é o assistente agrônomo do sistema Manejo Org com acesso a uma base de conhecimento.
Para perguntas técnicas sobre cultivos, pragas, insumos ou boas práticas, SEMPRE chame 
match_farm_documents para buscar o conhecimento antes de responder. 
Nunca responda de memória sobre técnicas agronômicas específicas.`,
			UserMessage: "Quais os cuidados e dosagem para aplicar calda bordalesa em tomate orgânico? Quando devo aplicar preventivamente?",
			Tool: tool{
				Type: "function",
				Function: toolFunction{
					Name:        "match_farm_documents",
					Description: "Busca documentos técnicos e manuais agronômicos relevantes na base de conhecimento Embrapa/MAPA.",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"query": map[string]any{
								"type":        "string",
								"description": "Consulta de busca semântica em linguagem natural",
							},
							"match_count": map[string]any{
								"type":        "integer",
								"description": "Número máximo de documentos a retornar (1-10)",
							},
						},
						"required": []string{"query"},
					},
				},
			},
			RequiredFields: []string{"query"},
			ValidateFn: func(args map[string]any) ([]string, []string) {
				required := []string{"query"}
				present, missing := checkNestedFields(args, required)
				// Valida que a query não é vazia ou genérica demais
				if q, ok := args["query"].(string); ok && len(q) < 5 {
					missing = append(missing, "query(muito_curta)")
					present = filterSlice(present, "query")
				}
				return present, missing
			},
		},

		// ----------------------------------------------------------------
		// Cenário 5: Ambiguidade Intencional — Stress Test
		// ----------------------------------------------------------------
		{
			Name:        "S5:AmbiguityStress",
			Description: "Mensagem vaga sem data e sem quantidade — testa preenchimento de defaults vs pedido de esclarecimento",
			SystemPrompt: `Você é o assistente agrônomo do sistema Manejo Org.
Quando possível, tente preencher campos com valores padrão razoáveis (data de hoje, quantidade 1 unidade).
Chame rpc_registrar_operacao_campo mesmo que alguns dados estejam faltando, usando CURRENT_DATE para data.`,
			UserMessage: "Capinei o Canteiro B.",
			Tool: tool{
				Type: "function",
				Function: toolFunction{
					Name:        "rpc_registrar_operacao_campo",
					Description: "Registra uma operação de campo no caderno agrônomo.",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"tipo_arg": map[string]any{
								"type": "string",
								"enum": []string{"Limpeza", "Propagacao", "Plantio", "Manejo", "Compostagem", "Colheita", "Venda"},
							},
							"payload_arg": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"item_area":    map[string]any{"type": "string"},
									"tipo_limpeza": map[string]any{"type": "string"},
									"talhao_nome":  map[string]any{"type": "string"},
									"data":         map[string]any{"type": "string"},
								},
							},
						},
						"required": []string{"tipo_arg", "payload_arg"},
					},
				},
			},
			RequiredFields: []string{"tipo_arg", "payload_arg.talhao_nome"},
			ValidateFn: func(args map[string]any) ([]string, []string) {
				required := []string{"tipo_arg", "payload_arg.talhao_nome"}
				return checkNestedFields(args, required)
			},
		},

		// ----------------------------------------------------------------
		// Cenário 6: Dupla Ação — Multi Tool Call
		// ----------------------------------------------------------------
		// O agricultor relata DUAS ações na mesma frase (colheita + uso de insumo).
		// Esperamos que o modelo dispare DUAS chamadas simultâneas à mesma RPC,
		// uma com tipo_arg="Colheita" e outra com tipo_arg="Manejo".
		{
			Name:              "S6:MultiToolDualAction",
			Description:       "Dupla ação numa frase (colheita + uso de insumo) — valida parallel tool calls",
			ExpectedToolCalls: 2,
			SystemPrompt: `Você é o assistente agrônomo do sistema Manejo Org.
IMPORTANTE: Quando o produtor relatar MÚLTIPLAS atividades distintas numa mesma mensagem,
você DEVE chamar rpc_registrar_operacao_campo UMA VEZ POR ATIVIDADE, em paralelo.
Não agrupe ações diferentes numa única chamada. Cada ação é um registro independente.
- Colheita de produto → tipo_arg="Colheita", produto no payload
- Uso/aplicação de insumo → tipo_arg="Manejo", insumo no payload
Unidades populares: "caixa" = unidade padrão de colheita. "saco de 50kg" = 50kg de insumo.`,
			UserMessage: "Colhi umas 10 caixas de tomate ali no fundo e gastei 2 sacos de adubo orgânico de 50kg do galpão.",
			Tool: tool{
				Type: "function",
				Function: toolFunction{
					Name:        "rpc_registrar_operacao_campo",
					Description: "Registra UMA operação de campo. Chame múltiplas vezes para múltiplas ações.",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"tipo_arg": map[string]any{
								"type": "string",
								"enum": []string{"Limpeza", "Propagacao", "Plantio", "Manejo", "Compostagem", "Colheita", "Venda"},
							},
							"payload_arg": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"produto":           map[string]any{"type": "string"},
									"insumo":            map[string]any{"type": "string"},
									"quantidade_valor":  map[string]any{"type": "number"},
									"quantidade_unidade": map[string]any{"type": "string"},
									"talhao_nome":       map[string]any{"type": "string"},
								},
							},
						},
						"required": []string{"tipo_arg", "payload_arg"},
					},
				},
			},
			// MultiValidateFn recebe todas as tool_calls e valida:
			// 1. Exatamente 2 chamadas foram feitas
			// 2. Uma com tipo_arg="Colheita" + produto presente
			// 3. Outra com tipo_arg="Manejo" + insumo presente
			MultiValidateFn: func(calls []toolCall) (present []string, missing []string) {
				hasColheita := false
				hasManejo := false
				hasColheitaProduto := false
				hasManejoInsumo := false

				for _, tc := range calls {
					var args map[string]any
					if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
						continue
					}
					tipo, _ := args["tipo_arg"].(string)
					var payload map[string]any
					if p, ok := args["payload_arg"].(map[string]any); ok {
						payload = p
					}

					switch tipo {
					case "Colheita":
						hasColheita = true
						if v, ok := payload["produto"].(string); ok && v != "" {
							hasColheitaProduto = true
						}
					case "Manejo":
						hasManejo = true
						if v, ok := payload["insumo"].(string); ok && v != "" {
							hasManejoInsumo = true
						}
					}
				}

				checks := map[string]bool{
					"call:Colheita":        hasColheita,
					"call:Colheita.produto": hasColheitaProduto,
					"call:Manejo":          hasManejo,
					"call:Manejo.insumo":   hasManejoInsumo,
				}
				for k, ok := range checks {
					if ok {
						present = append(present, k)
					} else {
						missing = append(missing, k)
					}
				}
				return present, missing
			},
		},
	}
}

// ---------------------------------------------------------------------------
// Helpers de validação
// ---------------------------------------------------------------------------

// checkNestedFields verifica se campos no formato "parent.child" existem no map.
func checkNestedFields(args map[string]any, fields []string) (present, missing []string) {
	for _, field := range fields {
		parts := strings.SplitN(field, ".", 2)
		if len(parts) == 1 {
			if v, ok := args[field]; ok && v != nil && v != "" {
				present = append(present, field)
			} else {
				missing = append(missing, field)
			}
		} else {
			// Navega para o sub-objeto
			parent := parts[0]
			child := parts[1]
			if sub, ok := args[parent].(map[string]any); ok {
				if v, ok := sub[child]; ok && v != nil && v != "" {
					present = append(present, field)
				} else {
					missing = append(missing, field)
				}
			} else {
				missing = append(missing, field)
			}
		}
	}
	return
}

func filterSlice(s []string, exclude string) []string {
	out := s[:0]
	for _, v := range s {
		if v != exclude {
			out = append(out, v)
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Pricing dinâmico
// ---------------------------------------------------------------------------

func fetchModelPrices(client *http.Client) (map[string]modelInfo, error) {
	req, _ := http.NewRequest(http.MethodGet, openRouterModelsURL, nil)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var mResp modelsResponse
	if err := json.Unmarshal(body, &mResp); err != nil {
		return nil, err
	}

	priceMap := make(map[string]modelInfo, len(mResp.Data))
	for _, m := range mResp.Data {
		priceMap[m.ID] = m
	}
	return priceMap, nil
}

// ---------------------------------------------------------------------------
// Retry com exponential backoff
// ---------------------------------------------------------------------------

var errRateLimit = errors.New("rate limit (429)")
var errNetTimeout = errors.New("network timeout")

func doWithRetry(label string, fn func() (ScenarioResult, error)) (ScenarioResult, error) {
	var (
		res ScenarioResult
		err error
	)
	for attempt := 1; attempt <= maxRetries; attempt++ {
		res, err = fn()
		res.Attempts = attempt

		if err == nil {
			return res, nil
		}
		if !errors.Is(err, errRateLimit) && !errors.Is(err, errNetTimeout) {
			return res, err
		}

		wait := time.Duration(1<<attempt) * time.Second
		fmt.Printf("  [%s retry %d/%d] aguardando %s: %v\n", label, attempt, maxRetries, wait, err)
		time.Sleep(wait)
	}
	return res, fmt.Errorf("falhou após %d tentativas: %w", maxRetries, err)
}

// ---------------------------------------------------------------------------
// Execução de um cenário para um modelo
// ---------------------------------------------------------------------------

func runScenario(client *http.Client, apiKey, model string, sc Scenario, priceData modelInfo) (ScenarioResult, error) {
	payload := chatRequest{
		Model: model,
		Messages: []message{
			{Role: "system", Content: sc.SystemPrompt},
			{Role: "user", Content: sc.UserMessage},
		},
		Tools:      []tool{sc.Tool},
		ToolChoice: "auto",
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, openRouterAPIURL, bytes.NewBuffer(body))
	if err != nil {
		return ScenarioResult{ScenarioName: sc.Name, Status: "Erro: criar request"}, nil
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/benchmark")
	req.Header.Set("X-Title", "Manejo Org — Model Shootout")

	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start)

	if err != nil {
		var netErr net.Error
		if errors.As(err, &netErr) && netErr.Timeout() {
			return ScenarioResult{ScenarioName: sc.Name, Latency: latency}, errNetTimeout
		}
		return ScenarioResult{ScenarioName: sc.Name, Latency: latency, Status: "Erro: rede"}, nil
	}
	defer resp.Body.Close()

	rawBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusTooManyRequests {
		return ScenarioResult{ScenarioName: sc.Name, Latency: latency}, errRateLimit
	}
	if resp.StatusCode != http.StatusOK {
		return ScenarioResult{ScenarioName: sc.Name, Latency: latency,
			Status: fmt.Sprintf("Erro HTTP: %d", resp.StatusCode)}, nil
	}

	var chatResp chatResponse
	if err := json.Unmarshal(rawBody, &chatResp); err != nil {
		return ScenarioResult{ScenarioName: sc.Name, Latency: latency, Status: "Erro: parse JSON"}, nil
	}
	if chatResp.Error.Message != "" {
		return ScenarioResult{ScenarioName: sc.Name, Latency: latency,
			Status: fmt.Sprintf("Erro API: %s", chatResp.Error.Message)}, nil
	}

	// -----------------------------------------------------------------------
	// Validação do Tool Call
	// -----------------------------------------------------------------------
	sr := ScenarioResult{
		ScenarioName:      sc.Name,
		Latency:           latency,
		PromptTokens:      chatResp.Usage.PromptTokens,
		CompletionTokens:  chatResp.Usage.CompletionTokens,
		TotalTokens:       chatResp.Usage.TotalTokens,
		ExpectedToolCalls: sc.ExpectedToolCalls,
		Status:            "Sucesso (sem tool_call)",
	}

	var allCalls []toolCall
	if len(chatResp.Choices) > 0 {
		allCalls = chatResp.Choices[0].Message.ToolCalls
	}
	sr.ToolCallCount = len(allCalls)

	if len(allCalls) > 0 {
		sr.RawArguments = allCalls[0].Function.Arguments

		// -----------------------------------------------------------------------
		// Caminho multi-tool: usa MultiValidateFn com todas as chamadas
		// -----------------------------------------------------------------------
		if sc.MultiValidateFn != nil {
			present, missing := sc.MultiValidateFn(allCalls)
			sr.FieldsPresent = present
			sr.FieldsMissing = missing

			total := len(present) + len(missing)
			if total > 0 {
				sr.CompletenessScore = float64(len(present)) / float64(total)
			}

			// Bônus de penalidade: se o modelo fez apenas 1 call quando esperávamos 2
			if sc.ExpectedToolCalls > 0 && sr.ToolCallCount < sc.ExpectedToolCalls {
				sr.CompletenessScore *= float64(sr.ToolCallCount) / float64(sc.ExpectedToolCalls)
			}

			if len(missing) == 0 && (sc.ExpectedToolCalls == 0 || sr.ToolCallCount >= sc.ExpectedToolCalls) {
				sr.ToolCallSuccess = true
				sr.Status = fmt.Sprintf("✓ Sucesso (%d calls)", sr.ToolCallCount)
			} else {
				sr.Status = fmt.Sprintf("⚠ Incompleto (%d/%d calls, %d campos ausentes)",
					sr.ToolCallCount, sc.ExpectedToolCalls, len(missing))
			}

		// -----------------------------------------------------------------------
		// Caminho single-tool: valida apenas a primeira chamada
		// -----------------------------------------------------------------------
		} else {
			tc := allCalls[0]
			if tc.Type == "function" && tc.Function.Name == sc.Tool.Function.Name {
				var argsMap map[string]any
				if err := json.Unmarshal([]byte(tc.Function.Arguments), &argsMap); err == nil {
					present, missing := sc.ValidateFn(argsMap)
					sr.FieldsPresent = present
					sr.FieldsMissing = missing

					total := len(present) + len(missing)
					if total > 0 {
						sr.CompletenessScore = float64(len(present)) / float64(total)
					}
					if len(missing) == 0 {
						sr.ToolCallSuccess = true
						sr.Status = "✓ Sucesso"
					} else {
						sr.Status = fmt.Sprintf("⚠ Incompleto (%d campos ausentes)", len(missing))
					}
				} else {
					sr.Status = "✗ Erro: JSON de argumentos inválido"
				}
			} else {
				sr.Status = fmt.Sprintf("✗ Tool errada: chamou '%s'", tc.Function.Name)
			}
		}
	}

	// Custo
	var promptPrice, completionPrice float64
	promptPrice, _ = strconv.ParseFloat(priceData.Pricing.Prompt, 64)
	completionPrice, _ = strconv.ParseFloat(priceData.Pricing.Completion, 64)
	sr.CostPer1kTokens = completionPrice * 1000.0
	sr.TotalCostRun = float64(sr.PromptTokens)*promptPrice + float64(sr.CompletionTokens)*completionPrice

	return sr, nil
}

// ---------------------------------------------------------------------------
// Orquestração: todos os modelos × todos os cenários (concorrente por modelo)
// ---------------------------------------------------------------------------

func RunModelShootout(models []string) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "Erro: OPENROUTER_API_KEY não definida.")
		os.Exit(1)
	}

	client := &http.Client{Timeout: httpTimeout}
	scenarios := buildScenarios()

	fmt.Println("Buscando preços da OpenRouter...")
	priceMap, err := fetchModelPrices(client)
	if err != nil {
		fmt.Printf("Aviso: falha ao buscar preços: %v\n", err)
		priceMap = make(map[string]modelInfo)
	} else {
		fmt.Println("Preços carregados!")
	}

	fmt.Printf("\n🌾 Manejo Org — Model Shootout\n")
	fmt.Printf("   %d modelos × %d cenários = %d chamadas à API\n\n", len(models), len(scenarios), len(models)*len(scenarios))

	reportCh := make(chan ModelReport, len(models))
	var wg sync.WaitGroup

	for _, m := range models {
		wg.Add(1)
		go func(model string) {
			defer wg.Done()
			fmt.Printf("→ Testando: %s (%d cenários)\n", model, len(scenarios))

			priceData := priceMap[model]
			report := ModelReport{Model: model, Scenarios: make([]ScenarioResult, 0, len(scenarios))}

			// Cenários sequenciais dentro de cada modelo (evitar rate limit em burst)
			for _, sc := range scenarios {
				label := fmt.Sprintf("%s/%s", model, sc.Name)
				sr, err := doWithRetry(label, func() (ScenarioResult, error) {
					return runScenario(client, apiKey, model, sc, priceData)
				})
				if err != nil {
					sr.ScenarioName = sc.Name
					sr.Status = fmt.Sprintf("✗ Falhou: %v", err)
				}
				report.Scenarios = append(report.Scenarios, sr)
				time.Sleep(300 * time.Millisecond) // gentleness entre cenários
			}
			reportCh <- report
		}(m)
	}

	go func() {
		wg.Wait()
		close(reportCh)
	}()

	var reports []ModelReport
	for r := range reportCh {
		reports = append(reports, r)
	}

	timestamp := time.Now().Format("20060102_150405")
	printMatrix(reports, scenarios)
	exportCSVMulti(reports, scenarios, fmt.Sprintf("benchmark_results_%s.csv", timestamp))
	exportJSONMulti(reports, fmt.Sprintf("benchmark_results_%s.json", timestamp))
	exportMarkdownMulti(reports, scenarios, fmt.Sprintf("benchmark_results_%s.md", timestamp))
}

// ---------------------------------------------------------------------------
// Impressão: Matriz Modelo × Cenário
// ---------------------------------------------------------------------------

func printMatrix(reports []ModelReport, scenarios []Scenario) {
	fmt.Println("\n╔══════════════════════════════════════════════════════════════════════════╗")
	fmt.Println("║          MATRIZ DE RESULTADOS — MANEJO ORG MODEL SHOOTOUT               ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════════════════╝")
	fmt.Println()

	// --- Tabela 1: Score de Completude (visão geral) ---
	fmt.Println("📊 COMPLETUDE POR CENÁRIO (score 0.0–1.0 | ✓=100% | ✗=erro | -=sem tool)")
	fmt.Println()

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)

	// Cabeçalho com nomes dos cenários
	header := "Modelo\t"
	for _, sc := range scenarios {
		header += sc.Name + "\t"
	}
	header += "Latência Média(ms)\tCusto Total(USD)\t"
	fmt.Fprintln(w, header)

	sep := "------\t"
	for range scenarios {
		sep += "----\t"
	}
	sep += "------------------\t----------------\t"
	fmt.Fprintln(w, sep)

	for _, rep := range reports {
		line := rep.Model + "\t"
		var totalLatency time.Duration
		var totalCost float64

		// Garante que os cenários estão na ordem certa
		scMap := make(map[string]ScenarioResult)
		for _, sr := range rep.Scenarios {
			scMap[sr.ScenarioName] = sr
		}

		for _, sc := range scenarios {
			sr := scMap[sc.Name]
			totalLatency += sr.Latency
			totalCost += sr.TotalCostRun

			if !sr.ToolCallSuccess && sr.RawArguments == "" {
				// Não acionou ferramenta
				line += fmt.Sprintf("✗ %s\t", sr.Status)
			} else if sr.ToolCallSuccess {
				line += fmt.Sprintf("✓ 1.00\t")
			} else {
				line += fmt.Sprintf("⚠ %.2f\t", sr.CompletenessScore)
			}
		}

		avgLatency := totalLatency / time.Duration(len(scenarios))
		line += fmt.Sprintf("%d\t$%.6f\t", avgLatency.Milliseconds(), totalCost)
		fmt.Fprintln(w, line)
	}
	w.Flush()

	// --- Tabela 2: Detalhe por modelo ---
	fmt.Println("\n\n📋 DETALHE DE CAMPOS AUSENTES POR CENÁRIO")
	fmt.Println()

	for _, rep := range reports {
		fmt.Printf("  🤖 %s\n", rep.Model)
		w2 := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w2, "  Cenário\tLatência(ms)\tTokens\tCusto(USD)\tScore\tCalls\tCampos Ausentes\t")
		fmt.Fprintln(w2, "  -------\t------------\t------\t----------\t-----\t-----\t---------------\t")
		for _, sr := range rep.Scenarios {
			missing := "-"
			if len(sr.FieldsMissing) > 0 {
				missing = strings.Join(sr.FieldsMissing, ", ")
			}
			callsLabel := "-"
			if sr.ExpectedToolCalls > 0 {
				callsLabel = fmt.Sprintf("%d/%d", sr.ToolCallCount, sr.ExpectedToolCalls)
			}
			fmt.Fprintf(w2, "  %s\t%d\t%d\t$%.6f\t%.2f\t%s\t%s\t\n",
				sr.ScenarioName,
				sr.Latency.Milliseconds(),
				sr.TotalTokens,
				sr.TotalCostRun,
				sr.CompletenessScore,
				callsLabel,
				missing,
			)
		}
		w2.Flush()
		fmt.Println()
	}
}

// ---------------------------------------------------------------------------
// Exportação CSV multi-cenário
// ---------------------------------------------------------------------------

func exportCSVMulti(reports []ModelReport, scenarios []Scenario, filename string) {
	f, err := os.Create(filename)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Aviso: não foi possível criar %s: %v\n", filename, err)
		return
	}
	defer f.Close()

	w := csv.NewWriter(f)
	defer w.Flush()

	_ = w.Write([]string{
		"Modelo", "Cenário", "Descrição", "Tool Call OK", "Score Completude",
		"Tool Calls Feitos", "Tool Calls Esperados",
		"Campos Presentes", "Campos Ausentes",
		"Latência(ms)", "Prompt Tokens", "Completion Tokens", "Total Tokens",
		"Custo/1k Tok(USD)", "Custo Run(USD)", "Tentativas", "Status",
	})

	scDesc := make(map[string]string)
	for _, sc := range scenarios {
		scDesc[sc.Name] = sc.Description
	}

	for _, rep := range reports {
		for _, sr := range rep.Scenarios {
			_ = w.Write([]string{
				rep.Model,
				sr.ScenarioName,
				scDesc[sr.ScenarioName],
				strconv.FormatBool(sr.ToolCallSuccess),
				fmt.Sprintf("%.2f", sr.CompletenessScore),
				strconv.Itoa(sr.ToolCallCount),
				strconv.Itoa(sr.ExpectedToolCalls),
				strings.Join(sr.FieldsPresent, "|"),
				strings.Join(sr.FieldsMissing, "|"),
				strconv.FormatInt(sr.Latency.Milliseconds(), 10),
				strconv.Itoa(sr.PromptTokens),
				strconv.Itoa(sr.CompletionTokens),
				strconv.Itoa(sr.TotalTokens),
				fmt.Sprintf("%.6f", sr.CostPer1kTokens),
				fmt.Sprintf("%.6f", sr.TotalCostRun),
				strconv.Itoa(sr.Attempts),
				sr.Status,
			})
		}
	}
	fmt.Printf("→ CSV exportado: %s\n", filename)
}

// ---------------------------------------------------------------------------
// Exportação JSON multi-cenário
// ---------------------------------------------------------------------------

type jsonScenarioRecord struct {
	Model               string   `json:"model"`
	Scenario            string   `json:"scenario"`
	ToolCallSuccess     bool     `json:"tool_call_success"`
	ToolCallCount       int      `json:"tool_call_count"`
	ExpectedToolCalls   int      `json:"expected_tool_calls"`
	CompletenessScore   float64  `json:"completeness_score"`
	FieldsPresent       []string `json:"fields_present"`
	FieldsMissing       []string `json:"fields_missing"`
	LatencyMs           int64    `json:"latency_ms"`
	PromptTokens        int      `json:"prompt_tokens"`
	CompletionTokens    int      `json:"completion_tokens"`
	TotalTokens         int      `json:"total_tokens"`
	CostPer1kTokensUSD  float64  `json:"cost_per_1k_tokens_usd"`
	TotalCostRunUSD     float64  `json:"total_cost_run_usd"`
	Attempts            int      `json:"attempts"`
	Status              string   `json:"status"`
	RawArguments        string   `json:"raw_arguments,omitempty"`
}

func exportJSONMulti(reports []ModelReport, filename string) {
	var records []jsonScenarioRecord
	for _, rep := range reports {
		for _, sr := range rep.Scenarios {
			records = append(records, jsonScenarioRecord{
				Model:              rep.Model,
				Scenario:           sr.ScenarioName,
				ToolCallSuccess:    sr.ToolCallSuccess,
				ToolCallCount:      sr.ToolCallCount,
				ExpectedToolCalls:  sr.ExpectedToolCalls,
				CompletenessScore:  sr.CompletenessScore,
				FieldsPresent:      sr.FieldsPresent,
				FieldsMissing:      sr.FieldsMissing,
				LatencyMs:          sr.Latency.Milliseconds(),
				PromptTokens:       sr.PromptTokens,
				CompletionTokens:   sr.CompletionTokens,
				TotalTokens:        sr.TotalTokens,
				CostPer1kTokensUSD: sr.CostPer1kTokens,
				TotalCostRunUSD:    sr.TotalCostRun,
				Attempts:           sr.Attempts,
				Status:             sr.Status,
				RawArguments:       sr.RawArguments,
			})
		}
	}

	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Aviso: falha ao serializar JSON: %v\n", err)
		return
	}
	if err := os.WriteFile(filename, data, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "Aviso: erro ao escrever %s: %v\n", filename, err)
		return
	}
	fmt.Printf("→ JSON exportado: %s\n", filename)
}

// ---------------------------------------------------------------------------
// Exportação Markdown multi-cenário
// ---------------------------------------------------------------------------

func exportMarkdownMulti(reports []ModelReport, scenarios []Scenario, filename string) {
	f, err := os.Create(filename)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Aviso: não foi possível criar %s: %v\n", filename, err)
		return
	}
	defer f.Close()

	fmt.Fprintln(f, "# Relatório de Benchmark — Manejo Org Model Shootout")
	fmt.Fprintln(f, "")
	fmt.Fprintln(f, "## Cenários Testados")
	fmt.Fprintln(f, "")
	fmt.Fprintln(f, "| Cenário | RPC | Descrição |")
	fmt.Fprintln(f, "|---|---|---|")
	for _, sc := range scenarios {
		fmt.Fprintf(f, "| %s | `%s` | %s |\n", sc.Name, sc.Tool.Function.Name, sc.Description)
	}

	// Tabela resumo: matriz modelo × cenário
	fmt.Fprintln(f, "")
	fmt.Fprintln(f, "## Matriz de Completude (score 0.0–1.0)")
	fmt.Fprintln(f, "")

	header := "| Modelo |"
	sep := "|---|"
	for _, sc := range scenarios {
		header += " " + sc.Name + " |"
		sep += "---|"
	}
	header += " Latência Média(ms) | Custo Total(USD) |"
	sep += "---|---|"
	fmt.Fprintln(f, header)
	fmt.Fprintln(f, sep)

	for _, rep := range reports {
		scMap := make(map[string]ScenarioResult)
		for _, sr := range rep.Scenarios {
			scMap[sr.ScenarioName] = sr
		}

		line := fmt.Sprintf("| %s |", rep.Model)
		var totalLatency time.Duration
		var totalCost float64

		for _, sc := range scenarios {
			sr := scMap[sc.Name]
			totalLatency += sr.Latency
			totalCost += sr.TotalCostRun

			if sr.ToolCallSuccess {
				line += " ✅ 1.00 |"
			} else if sr.RawArguments == "" {
				line += " ❌ sem tool |"
			} else {
				line += fmt.Sprintf(" ⚠️ %.2f |", sr.CompletenessScore)
			}
		}

		avgLatency := totalLatency / time.Duration(len(scenarios))
		line += fmt.Sprintf(" %d | $%.6f |", avgLatency.Milliseconds(), totalCost)
		fmt.Fprintln(f, line)
	}

	// Detalhe por modelo
	fmt.Fprintln(f, "")
	fmt.Fprintln(f, "## Detalhe por Modelo")
	fmt.Fprintln(f, "")

	for _, rep := range reports {
		fmt.Fprintf(f, "### %s\n\n", rep.Model)
		fmt.Fprintln(f, "| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |")
		fmt.Fprintln(f, "|---|---|---|---|---|---|---|---|")
		for _, sr := range rep.Scenarios {
			missing := "-"
			if len(sr.FieldsMissing) > 0 {
				missing = "`" + strings.Join(sr.FieldsMissing, "`, `") + "`"
			}
			callsLabel := "-"
			if sr.ExpectedToolCalls > 0 {
				callsLabel = fmt.Sprintf("%d/%d", sr.ToolCallCount, sr.ExpectedToolCalls)
			}
			fmt.Fprintf(f, "| %s | %d | %d | $%.6f | %.2f | %s | %s | %s |\n",
				sr.ScenarioName,
				sr.Latency.Milliseconds(),
				sr.TotalTokens,
				sr.TotalCostRun,
				sr.CompletenessScore,
				callsLabel,
				missing,
				sr.Status,
			)
		}
		fmt.Fprintln(f, "")
	}

	fmt.Printf("→ Markdown exportado: %s\n", filename)
}
