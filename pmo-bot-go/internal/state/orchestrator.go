package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// TraceEvent represents a single step in the agent's reasoning.
type TraceEvent struct {
	Action   string      `json:"acao"`
	Tool     string      `json:"tool,omitempty"`
	Input    interface{} `json:"input,omitempty"`
	Output   interface{} `json:"output,omitempty"`
	Provider string      `json:"provider,omitempty"`
	Time     time.Time   `json:"time"`
}

// Orchestrator manages the lifecycle of an agentic session with context injection and traceability.
type Orchestrator struct {
	LLM llm.LLMProvider
	SB  *supabase.Client
	MCP *mcp.Server
	// OutputJudge validates the LLM's final response before delivery.
	// Set to nil to disable output governance (e.g. in tests).
	OutputJudge guardrails.OutputJudge
	// HITLController intercepts high-risk tool calls for producer confirmation.
	// Set to nil to disable HITL (development/test mode).
	HITL guardrails.HITLHandler
	// Phone is the producer's WhatsApp number — required for HITL confirmation messages.
	Phone string
	// WhatsApp is the message sender port to deliver confirmation prompts.
	WhatsApp ports.MessageSender
	// BusinessEvaluator validates business rules and limits deterministically before tool execution.
	BusinessEvaluator guardrails.BusinessEvaluator
}

// NewOrchestrator creates a new agentic orchestrator.
func NewOrchestrator(provider llm.LLMProvider, sb *supabase.Client, mcpServer *mcp.Server) *Orchestrator {
	return &Orchestrator{
		LLM:               provider,
		SB:                sb,
		MCP:               mcpServer,
		OutputJudge:       ActiveOutputJudge,
		HITL:              ActiveHITLController,
		BusinessEvaluator: ActiveBusinessEvaluator,
	}
}

// ExecuteAgenticLoop runs the agentic loop with manual tool calling and automatic fallback between providers.
func (o *Orchestrator) ExecuteAgenticLoop(ctx context.Context, profile *supabase.Profile, systemPrompt string, userMessage string, tools []llm.FerramentaAgnostica, history []llm.MensagemAgnostica, guard *mcp.LoopGuard, agentDomain string, userMemories string, routerResult RouterResult) (string, []llm.MensagemAgnostica, []TraceEvent, llm.UsoMetadados, string, error) {
	promptManager := NewPromptManager()
	sysInst := promptManager.BuildSystemInstruction(profile, systemPrompt, agentDomain, userMemories, routerResult)

	var trace []TraceEvent
	var usage llm.UsoMetadados
	var lastToolMsg string
	var usedTools []string
	effectiveModel := o.LLM.ModelName()

	hitlRequested := make(map[string]bool)

	if userMessage != "" {
		history = append(history, llm.MensagemAgnostica{
			Role:    llm.PapelUser,
			Content: userMessage,
		})
	}

	if len(tools) == 0 || strings.Contains(systemPrompt, "CHAT") {
		// Este atalho envia ZERO ferramentas — é o grupo de controle natural da
		// hipótese do DT-37 (a carga das definições causa os timeouts?). Sem
		// instrumentá-lo, a amostra ficaria enviesada: só apareceriam as chamadas
		// pesadas, e não haveria com o que comparar.
		reqBytes := approxRequestBytes(sysInst, history, nil)

		startCall := time.Now()
		resp, err := o.LLM.GenerateContent(ctx, llm.ContentRequest{
			SystemInstruction: sysInst,
			History:           history,
			Tools:             nil,
		})
		latency := time.Since(startCall)

		if err != nil {
			log.Printf("telemetry event=llm_call status=erro turno=0 modelo=%s latency_ms=%d req_bytes=%d ferramentas=0 msgs_historico=%d erro=%q",
				o.LLM.ModelName(), latency.Milliseconds(), reqBytes, len(history), err.Error())
			return "", history, trace, usage, effectiveModel, err
		}

		log.Printf("telemetry event=llm_call status=ok turno=0 modelo=%s latency_ms=%d req_bytes=%d ferramentas=0 msgs_historico=%d input_tokens=%d output_tokens=%d tool_calls=0",
			resp.Model, latency.Milliseconds(), reqBytes, len(history),
			resp.Usage.PromptTokens, resp.Usage.CandidatesTokens)

		usage.PromptTokens += resp.Usage.PromptTokens
		usage.CandidatesTokens += resp.Usage.CandidatesTokens
		usage.TotalTokens += resp.Usage.TotalTokens
		usage.CachedTokens += resp.Usage.CachedTokens
		usage.CacheWriteTokens += resp.Usage.CacheWriteTokens
		effectiveModel = resp.Model

		history = append(history, llm.MensagemAgnostica{
			Role:    llm.PapelAssistant,
			Content: resp.Texto,
		})
		return resp.Texto, history, trace, usage, effectiveModel, nil
	}

	if o.WhatsApp != nil {
		defer o.WhatsApp.SendPresence(context.Background(), o.Phone, "paused")
	}

	mcpHandler := &MCPExecutionHandler{MCPServer: o.MCP, Guard: guard, Profile: profile}
	hitlMw := &HITLMiddleware{
		Controller:    o.HITL,
		Phone:         o.Phone,
		WhatsApp:      o.WhatsApp,
		Profile:       profile,
		HitlRequested: hitlRequested,
	}
	bizMw := &BusinessGuardrailMiddleware{
		Evaluator: o.BusinessEvaluator,
		Profile:   profile,
		SB:        o.SB,
	}

	seenToolCounts := make(map[string]int)

	// DT-37 — sem saber QUAIS ferramentas cada intent realmente usa, apertar o
	// filtro de `GetToolsForIntent` seria chute: se o roteador classificar
	// "registra 10kg de tomate" como RAG e RAG tiver perdido as ferramentas de
	// escrita, o registro falha silenciosamente. Esta linha monta a matriz
	// intent × ferramenta a partir do uso real, para o corte ser feito com dado.
	loopIntent := intentFromSystemPrompt(systemPrompt)

	for i := 0; i < 3; i++ {
		if o.WhatsApp != nil {
			go o.WhatsApp.SendPresence(ctx, o.Phone, "composing")
		}

		turnCtx, turnCancel := context.WithTimeout(ctx, 30*time.Second)

		log.Printf("🤖 [Orchestrator] Turno %d/%d: Tentando provider (%s)...", i+1, 3, o.LLM.ModelName())

		currentHistory := history
		if i > 0 {
			currentHistory = promptManager.BuildTurnHistory(history)
		}

		// DT-33 — dimensiona a requisição ANTES de enviá-la. Sem isto só se
		// enxerga o sintoma ("timeout") e não a carga que o provocou; medido em
		// bancada, só as definições de ferramentas somam ~29KB (~7,4k tokens).
		reqBytes := approxRequestBytes(sysInst, currentHistory, tools)

		startCall := time.Now()
		resp, err := o.LLM.GenerateContent(turnCtx, llm.ContentRequest{
			SystemInstruction: sysInst,
			History:           currentHistory,
			Tools:             tools,
		})
		latency := time.Since(startCall)

		if err != nil {
			turnCancel()
			// Linha agregável: permite responder "os timeouts se concentram em
			// quais tamanhos de payload?" sem reler log a log.
			log.Printf("telemetry event=llm_call status=erro turno=%d modelo=%s latency_ms=%d req_bytes=%d ferramentas=%d msgs_historico=%d erro=%q",
				i+1, o.LLM.ModelName(), latency.Milliseconds(), reqBytes, len(tools), len(currentHistory), err.Error())
			log.Printf("❌ [CRITICAL ORCHESTRATOR ERROR]: Turno %d — provider failed: %v", i+1, err)
			return "", history, trace, usage, effectiveModel, fmt.Errorf("turno %d — provider failed: %w", i+1, err)
		}
		turnCancel()

		log.Printf("telemetry event=llm_call status=ok turno=%d modelo=%s latency_ms=%d req_bytes=%d ferramentas=%d msgs_historico=%d input_tokens=%d output_tokens=%d tool_calls=%d",
			i+1, resp.Model, latency.Milliseconds(), reqBytes, len(tools), len(currentHistory),
			resp.Usage.PromptTokens, resp.Usage.CandidatesTokens, len(resp.ToolCalls))

		usage.PromptTokens += resp.Usage.PromptTokens
		usage.CandidatesTokens += resp.Usage.CandidatesTokens
		usage.TotalTokens += resp.Usage.TotalTokens
		usage.CachedTokens += resp.Usage.CachedTokens
		usage.CacheWriteTokens += resp.Usage.CacheWriteTokens
		effectiveModel = resp.Model

		history = append(history, llm.MensagemAgnostica{
			Role:             llm.PapelAssistant,
			Content:          resp.Texto,
			ToolCalls:        resp.ToolCalls,
			ThoughtSignature: resp.ThoughtSignature,
		})

		if len(resp.ToolCalls) == 0 {
			finalTexto := resp.Texto
			if finalTexto == "" && i > 0 {
				if lastToolMsg != "" {
					log.Printf("ℹ️ [Orchestrator] LLM retornou vazio no turno %d, usando mensagem da ferramenta como fallback.", i+1)
					finalTexto = lastToolMsg
				} else {
					log.Printf("ℹ️ [Orchestrator] LLM retornou vazio no turno %d, usando mensagem genérica de sucesso.", i+1)
					finalTexto = "✅ Operação registrada no sistema com sucesso!"
				}
			}

			finalTexto = sanitizeResponse(finalTexto)

			if finalTexto != "" && o.OutputJudge != nil {
				// Mesma derivação usada pela telemetria (loopIntent): manter as
				// duas cópias em sincronia era convite a divergência silenciosa.
				judgeIntent := loopIntent
				if judgeIntent == intentDesconhecido {
					judgeIntent = ""
				}

				if judgeIntent == "" {
					log.Printf("⏩ [Judge] Pulando auditoria — intent conversacional (CHAT ou desconhecido)")
				} else {
					startJudge := time.Now()
					verdict := o.OutputJudge.Judge(ctx, guardrails.JudgeRequest{
						UserInput:    userMessage,
						LLMOutput:    finalTexto,
						Intent:       judgeIntent,
						ModalityFarm: profile.ModalidadePredominante,
						ToolsUsed:    usedTools,
					})
					log.Printf("⏱️ [TRACING] Sub-passo: Output Judge: %v", time.Since(startJudge))
					if !verdict.Approved {
						log.Printf("🚨 [Judge] Resposta BLOQUEADA — violations=%v reason=%s", verdict.Violations, verdict.Reason)
						finalTexto = buildJudgeBlockedMessage(verdict)
					}
				}
			}

			return finalTexto, history, trace, usage, effectiveModel, nil
		}

		for _, tc := range resp.ToolCalls {
			usedTools = append(usedTools, tc.Nome)
			log.Printf("telemetry event=tool_invoked intent=%s tool=%s turno=%d ferramentas_ofertadas=%d",
				loopIntent, tc.Nome, i+1, len(tools))
			trace = append(trace, TraceEvent{
				Action:   "tool_call",
				Tool:     tc.Nome,
				Input:    tc.Args,
				Provider: resp.Provider,
				Time:     time.Now(),
			})

			parsedArgs, errParse := llm.ParseToolArgs(tc.Nome, tc.Args)
			if errParse != nil {
				log.Printf("⚠️ [Orchestrator] Erro ao parsear args da ferramenta %s: %v", tc.Nome, errParse)
			}

			// Gerar IdempotencyKey determinística por grupo (tool_name + canonical_args)
			cJSON, _ := guardrails.NormalizeCanonicalJSON(tc.Args)
			groupKey := tc.Nome + ":" + string(cJSON)
			occurrenceIdx := seenToolCounts[groupKey]
			seenToolCounts[groupKey]++

			messageID := ""
			if mid, ok := ctx.Value("message_id").(string); ok && mid != "" {
				messageID = mid
			} else if rawID, ok := ctx.Value("raw_payload_id").(string); ok && rawID != "" {
				messageID = rawID
			} else {
				messageID = fmt.Sprintf("msg-%d", len(history))
			}

			phone := ""
			if profile != nil {
				phone = profile.Telefone
			}

			idempKey, errIdemp := guardrails.GenerateIdempotencyKey(phone, messageID, tc.Nome, tc.Args, occurrenceIdx)
			if errIdemp != nil {
				log.Printf("⚠️ [Orchestrator] Falha ao gerar IdempotencyKey para %s: %v", tc.Nome, errIdemp)
			}

			req := ToolRequest{
				ToolName:       tc.Nome,
				ToolID:         tc.ID,
				RawArgs:        tc.Args,
				ParsedArgs:     parsedArgs,
				Provider:       resp.Provider,
				IdempotencyKey: idempKey,
				OccurrenceIdx:  occurrenceIdx,
				TraceEvents:    &trace,
				History:        &history,
			}

			// 1. Contexto - não injetamos mais IDs em req.RawArgs
			// (Eles agora vão tipados via Profile no momento da execução)

			// 2. HITL
			toolResp, errChain := hitlMw.Process(ctx, &req)
			if !toolResp.IsSynthetic {
				// 3. Business Guardrail
				toolResp, errChain = bizMw.Process(ctx, &req)
				if !toolResp.IsSynthetic {
					// 4. Executar Ferramenta
					startTool := time.Now()
					var opCount int
					
					if tc.Nome == "RegistrarLoteOperacoes" {
						if parsedMap, ok := req.ParsedArgs.(map[string]interface{}); ok {
							if ops, ok := parsedMap["operacoes"].([]interface{}); ok {
								opCount = len(ops)
							}
						}
						log.Printf("telemetry event=batch_tool_invoked conversation_id=%s tool_name=%s op_count=%d", profile.Telefone, tc.Nome, opCount)
					}

					toolResp, errChain = mcpHandler.Execute(ctx, &req)

					if tc.Nome == "RegistrarLoteOperacoes" {
						latency := time.Since(startTool).Milliseconds()
						if errChain != nil {
							log.Printf("telemetry event=batch_tool_failed conversation_id=%s tool_name=%s op_count=%d latency_ms=%d", profile.Telefone, tc.Nome, opCount, latency)
						} else {
							log.Printf("telemetry event=batch_tool_completed conversation_id=%s tool_name=%s op_count=%d success=true latency_ms=%d", profile.Telefone, tc.Nome, opCount, latency)
						}
					}
				}
			}

			if toolResp.IsSynthetic {
				if errChain != nil && errChain.Error() == "hitl_pending" {
					return "", history, trace, usage, effectiveModel, errChain
				}
				if errChain != nil {
					return toolResp.ErrorMessage, history, trace, usage, effectiveModel, errChain
				}
				continue
			}

			var resMap map[string]interface{}
			if errChain != nil {
				resMap = map[string]interface{}{"error": errChain.Error()}
			} else {
				var ok bool
				resMap, ok = toolResp.Result.(map[string]interface{})
				if !ok {
					resMap = map[string]interface{}{"result": toolResp.Result}
				}

				if msg, ok := resMap["message"].(string); ok && msg != "" {
					lastToolMsg = msg
				} else if res, ok := resMap["result"].(string); ok && res != "" {
					lastToolMsg = res
				} else if s, ok := toolResp.Result.(string); ok && s != "" {
					lastToolMsg = s
				}
			}

			outputJSON, _ := json.Marshal(resMap)

			history = append(history, llm.MensagemAgnostica{
				Role:     llm.PapelTool,
				Content:  string(outputJSON),
				ToolID:   tc.ID,
				ToolName: tc.Nome,
			})

			trace = append(trace, TraceEvent{
				Action: "tool_return",
				Tool:   tc.Nome,
				Output: resMap,
				Time:   time.Now(),
			})
		}
	}

	return "Desculpe, excedi o limite de passos para processar sua solicitação.", history, trace, usage, effectiveModel, nil
}

// buildJudgeBlockedMessage constructs a safe, user-facing message when the
// OutputJudge blocks a response. It avoids alarming language while being
// honest that the content was reviewed and a specialist will follow up.
func buildJudgeBlockedMessage(verdict guardrails.JudgeVerdict) string {
	// Map policy codes to Portuguese user-friendly explanations
	policyExplanations := map[string]string{
		"PESTICIDAS_PROIBIDOS":   "menção a pesticidas proibidos no sistema orgânico",
		"DOSAGEM_PERIGOSA":       "dosagem sugerida fora dos limites agronômicos seguros",
		"ALUCINACAO_DADOS":       "informações não confirmadas nos seus registros",
		"INFORMACAO_REGULATORIA": "orientação regulatória que requer verificação especializada",
		"PII_VAZAMENTO":          "dados sensíveis detectados na resposta",
		"CONTEUDO_OFENSIVO":      "conteúdo inadequado detectado",
	}

	reason := "política de segurança agronômica"
	if len(verdict.Violations) > 0 {
		if friendly, ok := policyExplanations[verdict.Violations[0]]; ok {
			reason = friendly
		}
	}

	return fmt.Sprintf(
		"⚠️ *Atenção:* A resposta gerada foi revisada e continha %s.\n\n"+
			"Para garantir a conformidade do seu sistema *orgânico*, "+
			"um especialista será notificado e entrará em contato em breve.\n\n"+
			"Enquanto isso, reformule sua pergunta ou consulte diretamente "+
			"o seu técnico de campo. 🌱",
		reason,
	)
}

// reToolCallJSON matches any JSON object that looks like a tool/function call leak.
// It catches:
//   - {"tool_calls": ...}
//   - {"name": "...", "args": ...}
//   - {"function_call": ...}
//   - Markdown-fenced JSON blocks (```json ... ```)
var (
	reToolCallBlock  = regexp.MustCompile(`(?s)\x60{3}(?:json)?\s*\{[^\x60]*"(?:tool_calls|function_call|name)[^\x60]*\}\s*\x60{3}`)
	reInlineToolCall = regexp.MustCompile(`(?s)\{[^{}]*"(?:tool_calls|function_call)"[^{}]*\}`)
	reNameArgsBlock  = regexp.MustCompile(`(?s)\{[^{}]*"name"\s*:\s*"[a-z_]+"[^{}]*"args"\s*:\s*\{[^}]*\}[^{}]*\}`)
)

// sanitizeResponse removes any tool_call/function_call JSON that accidentally
// leaked into the LLM's final text response before it is delivered to the user.
// It is fail-safe: if stripping produces an empty string, the original is returned
// so we never send a blank message to the producer.
func sanitizeResponse(text string) string {
	original := text

	// Strip markdown-fenced JSON blocks first (greedy block match)
	text = reToolCallBlock.ReplaceAllString(text, "")

	// Strip inline {"tool_calls": ...} or {"function_call": ...} objects
	text = reInlineToolCall.ReplaceAllString(text, "")

	// Strip {"name": "tool_name", "args": {...}} patterns
	text = reNameArgsBlock.ReplaceAllString(text, "")

	text = strings.TrimSpace(text)

	if text == "" {
		log.Printf("⚠️ [Sanitize] Resposta ficou vazia após limpeza de tool_call JSON — restaurando original truncado")
		// Return a generic safe message instead of leaking the raw original
		return "✅ Operação processada com sucesso!"
	}

	if text != original {
		log.Printf("🛡️ [Sanitize] Tool-call JSON removido da resposta final (len antes=%d, depois=%d)", len(original), len(text))
	}

	return text
}

// hitlFingerprint builds a deterministic key for HITL dedup by serializing
// the tool name + args. Go's json.Marshal automatically sorts map keys,
// ensuring that {"b":2,"a":1} and {"a":1,"b":2} produce the same fingerprint.
func hitlFingerprint(toolName string, args map[string]interface{}) string {
	b, _ := json.Marshal(args)
	return toolName + ":" + string(b)
}

// FilterToolsByRouterResult is a defensive filter that subsets tools based on the RouterResult.
// It applies graceful degradation (fallback) if the router result is invalid.
func FilterToolsByRouterResult(result RouterResult, tools []mcp.Tool) []mcp.Tool {
	if err := result.Validate(); err != nil {
		log.Printf("⚠️ [Orchestrator] RouterResult inválido: %v. Aplicando fallback seguro.", err)
		return getFallbackTools(tools)
	}

	var filtered []mcp.Tool
	for _, tool := range tools {
		switch tool.Category {
		case mcp.CategoryRAG:
			if result.PrimaryIntent == IntentAgronomy || (result.SecondaryIntent != nil && *result.SecondaryIntent == IntentAgronomy) {
				filtered = append(filtered, tool)
			}
		case mcp.CategoryDBRead:
			if result.PrimaryIntent == IntentDatabase || (result.SecondaryIntent != nil && *result.SecondaryIntent == IntentDatabase) || result.IsMixed {
				filtered = append(filtered, tool)
			}
		case mcp.CategoryDBWrite:
			if result.NeedsWrite && result.WriteScope != WriteScopeNone {
				filtered = append(filtered, tool)
			}
		case mcp.CategoryChat:
			// Ferramentas de chat/clarificação são sempre seguras
			filtered = append(filtered, tool)
		}
	}
	return filtered
}

func getFallbackTools(tools []mcp.Tool) []mcp.Tool {
	var fallback []mcp.Tool
	for _, tool := range tools {
		if tool.Category == mcp.CategoryChat || tool.Category == mcp.CategoryRAG {
			fallback = append(fallback, tool)
		}
	}
	return fallback
}

// approxRequestBytes estima o tamanho da requisição enviada ao LLM.
//
// Aproximação deliberada: serializa o que domina o payload (instrução de
// sistema, histórico e definições de ferramentas) sem replicar a conversão
// específica de cada provider. Serve para correlacionar carga com latência e
// timeout — ordem de grandeza, não cobrança.
func approxRequestBytes(sysInst string, history []llm.MensagemAgnostica, tools []llm.FerramentaAgnostica) int {
	total := len(sysInst)

	for _, m := range history {
		total += len(m.Content)
		for _, tc := range m.ToolCalls {
			total += len(tc.Nome) + len(tc.Args)
		}
	}

	if raw, err := json.Marshal(tools); err == nil {
		total += len(raw)
	}

	return total
}

// intentDesconhecido marca conversas sem intent operacional (CHAT ou não
// classificado) — nesses casos o Output Judge é pulado.
const intentDesconhecido = "CHAT_OU_DESCONHECIDO"

// intentFromSystemPrompt deriva o intent a partir do prompt de sistema em uso.
//
// Reproduz a mesma heurística já aplicada ao Output Judge, extraída para poder
// ser usada também na telemetria — sem ela, os eventos de uso de ferramenta não
// teriam como ser agrupados por intent.
func intentFromSystemPrompt(systemPrompt string) string {
	switch {
	case strings.Contains(systemPrompt, "RAG") || strings.Contains(systemPrompt, "duvida"):
		return "RAG"
	case strings.Contains(systemPrompt, "DATABASE") || strings.Contains(systemPrompt, "registro"):
		return "DATABASE"
	case strings.Contains(systemPrompt, "FINANCE") || strings.Contains(systemPrompt, "financeiro"):
		return "FINANCE"
	default:
		return intentDesconhecido
	}
}
