package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"sort"
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
		LLM: provider,
		SB:  sb,
		MCP: mcpServer,
	}
}

// ExecuteAgenticLoop runs the agentic loop with manual tool calling and automatic fallback between providers.
func (o *Orchestrator) ExecuteAgenticLoop(ctx context.Context, profile *supabase.Profile, systemPrompt string, userMessage string, tools []llm.FerramentaAgnostica, history []llm.MensagemAgnostica, guard *mcp.LoopGuard) (string, []llm.MensagemAgnostica, []TraceEvent, llm.UsoMetadados, string, error) {
	// 1. Fetch Context (Farm / Plots / IDs)
	farmContext := ""
	if profile.ID != "" {
		farmContext = fmt.Sprintf("\n[CONTEXTO DO USUÁRIO]:\n- user_id: %s\n", profile.ID)
		if profile.PropriedadeAtivaID > 0 {
			farmContext += fmt.Sprintf("- propriedade_id: %d\n", profile.PropriedadeAtivaID)
			if len(profile.Talhoes) > 0 {
				talhoesNames := []string{}
				for _, t := range profile.Talhoes {
					talhoesNames = append(talhoesNames, fmt.Sprintf("%s (ID: %d)", t.Nome, t.ID))
				}
				farmContext += fmt.Sprintf("- Talhões Disponíveis: %s\n", strings.Join(talhoesNames, ", "))
			}
		}
		if profile.PmoAtivoID > 0 {
			farmContext += fmt.Sprintf("- pmo_id: %d\n", profile.PmoAtivoID)
		}
	}

	// 2. Setup System Instruction with dynamic context
	// CRITICAL guardrail appended unconditionally: the LLM must NEVER expose
	// raw tool_call JSON or function-call syntax in the final user-facing message.
	toolCallGuardrail := "\n\n[REGRA ABSOLUTA DE SAÍDA]: NUNCA inclua JSON de chamadas de ferramenta (tool_calls, function_call, {\"name\":..., \"args\":...}, etc.) na sua resposta final ao utilizador. A sua resposta deve ser APENAS texto amigável em Português. Se uma ferramenta foi executada, descreva o RESULTADO da ação com palavras simples."
	sysInst := systemPrompt + "\n" + farmContext + "\nUse as ferramentas para consultar ou registrar dados. Se as informações críticas (como IDs de talhão ou PMO) já constam no contexto acima, use-as DIRETAMENTE sem perguntar ou consultar novamente." + toolCallGuardrail

	var trace []TraceEvent
	var usage llm.UsoMetadados
	var lastToolMsg string
	var usedTools []string // track tool names for OutputJudge context
	effectiveModel := o.LLM.ModelName()

	// HITL dedup set: tracks "toolName:argsFingerprint" strings already requested
	// this session to prevent duplicate confirmation messages when the NER loop
	// fires multiple orchestrators for the same high-risk tool call.
	hitlRequested := make(map[string]bool)

	// Append initial user message if present
	if userMessage != "" {
		history = append(history, llm.MensagemAgnostica{
			Role:    llm.PapelUser,
			Content: userMessage,
		})
	}

	for i := 0; i < 3; i++ { // Loop Guard (max 3 steps — cost control)
		var resp llm.RespostaAgnostica
		var err error

		// Per-turn timeout: each LLM call gets its own 30s budget, independent from
		// the outer webhook timeout. This prevents a slow provider from killing the
		// whole loop and gives us time to attempt the fallback within the outer ctx.
		turnCtx, turnCancel := context.WithTimeout(ctx, 30*time.Second)

		// --- LOGICA DE FALLBACK (Try Google -> Fallback OpenRouter) ---
		log.Printf("🤖 [Orchestrator] Turno %d/%d: Tentando provider (%s)...", i+1, 3, o.LLM.ModelName())

		// Reforce o prompt se já tivermos resultados de ferramentas no histórico
		currentHistory := history
		if i > 0 {
			// Cria uma cópia rasa do slice original para não alterar o histórico real que é persistido
			currentHistory = append([]llm.MensagemAgnostica{}, history...)

			hasPendingHITL := false
			for _, hMsg := range history {
				if hMsg.Role == llm.PapelTool && strings.Contains(hMsg.Content, "awaiting_confirmation") {
					hasPendingHITL = true
					break
				}
			}

			summaryInstruction := "RESUMO OBRIGATÓRIO: NUNCA retorne uma resposta vazia. Resuma os resultados das ferramentas executadas de forma amigável para o usuário."
			if hasPendingHITL {
				summaryInstruction += " IMPORTANTE: Se o status de alguma ferramenta for 'awaiting_confirmation', isso significa que a operação NÃO foi concluída e está aguardando aprovação do produtor pelo WhatsApp. Você deve informar ao usuário de forma clara que a ação específica aguarda confirmação e que uma solicitação de aprovação foi enviada para o WhatsApp dele, e NUNCA dizer que a operação foi concluída ou registrada com sucesso."
			}

			currentHistory = append(currentHistory, llm.MensagemAgnostica{
				Role:    llm.PapelSystem,
				Content: summaryInstruction,
			})
		}

		resp, err = o.LLM.GenerateContent(turnCtx, llm.ContentRequest{
			SystemInstruction: sysInst,
			History:           currentHistory,
			Tools:             tools,
		})

		if err != nil {
			turnCancel()
			log.Printf("❌ [CRITICAL ORCHESTRATOR ERROR]: Turno %d — provider failed: %v", i+1, err)
			return "", history, trace, usage, effectiveModel, fmt.Errorf("turno %d — provider failed: %w", i+1, err)
		}
		turnCancel()

		// Acumular métricas
		usage.PromptTokens += resp.Usage.PromptTokens
		usage.CandidatesTokens += resp.Usage.CandidatesTokens
		usage.TotalTokens += resp.Usage.TotalTokens
		effectiveModel = resp.Model

		// Guardar resposta da IA no histórico agnóstico.
		// IDs de ToolCalls vazios (vindo do Google) são normalizados no adaptador
		// ParaOpenRouterHistory — a camada de orquestração não precisa saber disso.
		history = append(history, llm.MensagemAgnostica{
			Role:             llm.PapelAssistant,
			Content:          resp.Texto,
			ToolCalls:        resp.ToolCalls,
			ThoughtSignature: resp.ThoughtSignature,
		})

		// Se não houver chamadas de ferramentas, retornamos o texto final
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

			// ── Guardrail 1: Tool-Call JSON Sanitization ──────────────────────
			// Strip any raw tool_call / function_call JSON that the LLM may have
			// accidentally included in its text output before we send it to the user.
			finalTexto = sanitizeResponse(finalTexto)
			// ─────────────────────────────────────────────────────────────────

			// ── Guardrail 2: Output Content Governance ────────────────────────
			// Only audits RAG/DATABASE/FINANCE intents where agronomic data safety
			// is relevant. CHAT responses are conversational and must not be blocked
			// (e.g. a "sim" confirmation reply mentioning session context is NOT hallucination).
			if finalTexto != "" && o.OutputJudge != nil {
				// Derive intent from system prompt (injected by handleDuvidaFallback)
				judgeIntent := ""
				switch {
				case strings.Contains(systemPrompt, "RAG") || strings.Contains(systemPrompt, "duvida"):
					judgeIntent = "RAG"
				case strings.Contains(systemPrompt, "DATABASE") || strings.Contains(systemPrompt, "registro"):
					judgeIntent = "DATABASE"
				case strings.Contains(systemPrompt, "FINANCE") || strings.Contains(systemPrompt, "financeiro"):
					judgeIntent = "FINANCE"
				}

				if judgeIntent == "" {
					log.Printf("⏩ [Judge] Pulando auditoria — intent conversacional (CHAT ou desconhecido)")
				} else {
					verdict := o.OutputJudge.Judge(ctx, guardrails.JudgeRequest{
						UserInput:    userMessage,
						LLMOutput:    finalTexto,
						Intent:       judgeIntent,
						ModalityFarm: profile.ModalidadePredominante,
						ToolsUsed:    usedTools,
					})
					if !verdict.Approved {
						log.Printf("🚨 [Judge] Resposta BLOQUEADA — violations=%v reason=%s",
							verdict.Violations, verdict.Reason)
						finalTexto = buildJudgeBlockedMessage(verdict)
					}
				}
			}
			// ─────────────────────────────────────────────────────────────────

			return finalTexto, history, trace, usage, effectiveModel, nil
		}

		// Se houver chamadas de ferramentas, executamos cada uma
		for _, tc := range resp.ToolCalls {
			usedTools = append(usedTools, tc.Nome) // record for OutputJudge
			trace = append(trace, TraceEvent{
				Action:   "tool_call",
				Tool:     tc.Nome,
				Input:    tc.Args,
				Provider: resp.Provider,
				Time:     time.Now(),
			})

			// Context Injection
			args := tc.Args
			if args == nil {
				args = make(map[string]interface{})
			}
			args["user_id"] = profile.ID
			args["pmo_id"] = profile.PmoAtivoID
			args["propriedade_id"] = profile.PropriedadeAtivaID
			if rawPayloadID, ok := ctx.Value("raw_payload_id").(string); ok && rawPayloadID != "" {
				args["raw_payload_id"] = rawPayloadID
			}

			// ── HITL: Intercept High-Risk Tools ──────────────────────────────
			// Before ANY mutation, check if this tool requires producer approval.
			// Strategy: soft-pause — inject a synthetic "awaiting_confirmation" tool
			// result so the LLM generates a graceful hold message. The real
			// execution happens in the webhook on SIM response.
			if o.HITL != nil {
				if needsHITL, label := guardrails.RequiresHITL(tc.Nome); needsHITL {
					// ── Dedup Guard ─────────────────────────────────────────────────
					// Build a deterministic fingerprint: sorted JSON keys prevent
					// false misses when the LLM reorders args between orchestrator calls.
					fp := hitlFingerprint(tc.Nome, args)
					if hitlRequested[fp] {
						log.Printf("🔄 [HITL-DEDUP] Confirmação já solicitada para tool=%s (fp=%s) — reutilizando synthetic result", tc.Nome, fp)
						// Inject synthetic awaiting result without creating a new DB record
						synthResult := map[string]interface{}{
							"status":  "awaiting_confirmation",
							"message": fmt.Sprintf("Ação '%s' já aguarda confirmação do produtor via WhatsApp.", label),
						}
						synthJSON, _ := json.Marshal(synthResult)
						history = append(history, llm.MensagemAgnostica{
							Role:     llm.PapelTool,
							Content:  string(synthJSON),
							ToolID:   tc.ID,
							ToolName: tc.Nome,
						})
						continue
					}
					// ────────────────────────────────────────────────────────────────
					token, hitlErr := o.HITL.RequestApproval(ctx, guardrails.HITLRecord{
						FromPhone:   o.Phone,
						PmoID:       &profile.PmoAtivoID,
						UserID:      profile.ID,
						ToolName:    tc.Nome,
						ToolArgs:    args,
						ActionLabel: label,
					})
					if hitlErr == nil {
						hitlRequested[fp] = true // mark as requested for dedup
						log.Printf("⏸️ [HITL] Aprovação solicitada — tool=%s token=%s phone=%s",
							tc.Nome, token, o.Phone)
						// Send the actual confirmation WhatsApp message with native buttons to the user!
						if o.WhatsApp != nil {
							confirmMsg := guardrails.BuildConfirmationMessage(label, args)
							buttons := []map[string]string{
								{"type": "reply", "displayText": "SIM", "id": "SIM"},
								{"type": "reply", "displayText": "NÃO", "id": "NÃO"},
							}
							title := "Confirmação Necessária"
							footer := "Esta confirmação expira em 10 minutos"
							if err := o.WhatsApp.SendButton(o.Phone, title, confirmMsg, footer, buttons); err != nil {
								log.Printf("⚠️ [HITL] Falha ao enviar botões de confirmação: %v", err)
							}
						}
						// Inject synthetic result — tells LLM the action is pending approval
						synthResult := map[string]interface{}{
							"status":  "awaiting_confirmation",
							"message": fmt.Sprintf("Ação '%s' aguarda confirmação do produtor via WhatsApp.", label),
							"token":   token,
						}
						synthJSON, _ := json.Marshal(synthResult)
						history = append(history, llm.MensagemAgnostica{
							Role:     llm.PapelTool,
							Content:  string(synthJSON),
							ToolID:   tc.ID,
							ToolName: tc.Nome,
						})
						trace = append(trace, TraceEvent{
							Action: "hitl_requested",
							Tool:   tc.Nome,
							Output: synthResult,
							Time:   time.Now(),
						})
						return "", history, trace, usage, effectiveModel, fmt.Errorf("hitl_pending")
					}
					// HITL storage failed: fail-open → execute the tool normally
					log.Printf("⚠️ [HITL] Falha ao solicitar aprovação — executando ferramenta diretamente: %v", hitlErr)
				}
			}
			// ─────────────────────────────────────────────────────────────────

			// ── Validação do Guardrail Determinístico (BusinessEvaluator) ──
			if o.BusinessEvaluator != nil {
				evalCtx := guardrails.EvaluationContext{
					PmoID:         profile.PmoAtivoID,
					PropriedadeID: profile.PropriedadeAtivaID,
					UserID:        profile.ID,
				}

				var evalErr error

				switch tc.Nome {
				case "registrar_compra_insumo":
					valTotal := parseToFloat(args["valor_total"])
					produto := ""
					if p, ok := args["produto"].(string); ok {
						produto = strings.TrimSpace(p)
					}

					var talhoes []string
					if rawAlocs, ok := args["alocacoes_talhoes"].([]interface{}); ok {
						for _, rawAloc := range rawAlocs {
							if alocMap, ok := rawAloc.(map[string]interface{}); ok {
								if tNome, ok := alocMap["talhao_nome"].(string); ok && tNome != "" {
									talhoes = append(talhoes, tNome)
								}
							}
						}
					}

					evalErr = o.BusinessEvaluator.EvaluateTransaction(ctx, evalCtx, guardrails.TransactionPayload{
						ValorTotal: valTotal,
						Produto:    produto,
						Talhoes:    talhoes,
					})

				case "registrar_venda":
					valTotal := parseToFloat(args["valor_total"])
					if valTotal <= 0 {
						qtd := parseToFloat(args["quantidade"])
						valUnit := parseToFloat(args["valor_unitario"])
						valTotal = qtd * valUnit
					}
					produto := ""
					if p, ok := args["produto"].(string); ok {
						produto = strings.TrimSpace(p)
					}
					evalErr = o.BusinessEvaluator.EvaluateTransaction(ctx, evalCtx, guardrails.TransactionPayload{
						ValorTotal: valTotal,
						Produto:    produto,
					})

				case "registrar_limpeza":
					qtd := parseToFloat(args["dosagem"])
					produto := ""
					if p, ok := args["produto_utilizado"].(string); ok {
						produto = strings.TrimSpace(p)
					}
					talhao := ""
					if t, ok := args["item_area"].(string); ok {
						talhao = strings.TrimSpace(t)
					}
					evalErr = o.BusinessEvaluator.EvaluateManejo(ctx, evalCtx, guardrails.ManejoPayload{
						Quantidade:    qtd,
						Unidade:       "dosagem",
						Produto:       produto,
						TalhaoNome:    talhao,
						TipoAtividade: "Limpeza",
					})

				case "registrar_propagacao_vegetal":
					tipoStr := ""
					if t, ok := args["tipo"].(string); ok {
						tipoStr = strings.TrimSpace(t)
					}

					if strings.EqualFold(tipoStr, "Compra/Aquisição") {
						valTotal := parseToFloat(args["valor_total"])
						produto := ""
						if p, ok := args["especies"].(string); ok {
							produto = strings.TrimSpace(p)
						}
						evalErr = o.BusinessEvaluator.EvaluateTransaction(ctx, evalCtx, guardrails.TransactionPayload{
							ValorTotal: valTotal,
							Produto:    produto,
						})
					} else {
						qtd := parseToFloat(args["quantidade"])
						produto := ""
						if p, ok := args["especies"].(string); ok {
							produto = strings.TrimSpace(p)
						}
						evalErr = o.BusinessEvaluator.EvaluateManejo(ctx, evalCtx, guardrails.ManejoPayload{
							Quantidade:    qtd,
							Unidade:       "unidades",
							Produto:       produto,
							TalhaoNome:    "Área de Propagação",
							TipoAtividade: "Propagação Vegetal",
						})
					}

				case "registrar_compostagem":
					acaoStr := ""
					if a, ok := args["acao"].(string); ok {
						acaoStr = strings.TrimSpace(a)
					}
					pilha := ""
					if p, ok := args["identificador_pilha"].(string); ok {
						pilha = strings.TrimSpace(p)
					}
					mat := ""
					if m, ok := args["materiais"].(string); ok {
						mat = strings.TrimSpace(m)
					}
					evalErr = o.BusinessEvaluator.EvaluateManejo(ctx, evalCtx, guardrails.ManejoPayload{
						Quantidade:    0,
						Unidade:       "pilha",
						Produto:       mat,
						TalhaoNome:    pilha,
						TipoAtividade: "Compostagem (" + acaoStr + ")",
					})

				case "registrar_colheita":
					qtd := parseToFloat(args["quantidade"])
					unid := ""
					if u, ok := args["unidade"].(string); ok {
						unid = strings.TrimSpace(u)
					}
					prod := ""
					if p, ok := args["cultura"].(string); ok {
						prod = strings.TrimSpace(p)
					}
					talhao := ""
					if t, ok := args["talhao"].(string); ok {
						talhao = strings.TrimSpace(t)
					}
					evalErr = o.BusinessEvaluator.EvaluateManejo(ctx, evalCtx, guardrails.ManejoPayload{
						Quantidade:    qtd,
						Unidade:       unid,
						Produto:       prod,
						TalhaoNome:    talhao,
						TipoAtividade: "Colheita",
					})
				}

				if evalErr != nil {
					log.Printf("🚨 [Guardrail-Business] Payload REPROVADO para a ferramenta %s: %v", tc.Nome, evalErr)

					if rawPayloadID, ok := ctx.Value("raw_payload_id").(string); ok && rawPayloadID != "" {
						_ = o.SB.UpdateRawPayloadStatus(ctx, rawPayloadID, "FAILED", evalErr.Error())
					}

					history = append(history, llm.MensagemAgnostica{
						Role:    llm.PapelAssistant,
						Content: "Bloqueio do Guardrail: " + evalErr.Error(),
					})

					return evalErr.Error(), history, trace, usage, effectiveModel, evalErr
				}
			}
			// ─────────────────────────────────────────────────────────────────

			// Execute Tool via MCP (Agnóstico)
			result, err := o.MCP.CallToolWithGuard(guard, tc.Nome, args)

			var resMap map[string]interface{}
			if err != nil {
				log.Printf("⚠️ [Orchestrator] Erro na ferramenta %s: %v", tc.Nome, err)
				resMap = map[string]interface{}{"error": err.Error()}
			} else {
				var ok bool
				resMap, ok = result.(map[string]interface{})
				if !ok {
					resMap = map[string]interface{}{"result": result}
				}

				// Captura mensagem de sucesso para fallback caso o LLM retorne vazio depois
				if msg, ok := resMap["message"].(string); ok && msg != "" {
					lastToolMsg = msg
				} else if res, ok := resMap["result"].(string); ok && res != "" {
					lastToolMsg = res
				} else if s, ok := result.(string); ok && s != "" {
					lastToolMsg = s
				}
			}

			outputJSON, _ := json.Marshal(resMap)

			// Adicionar resultado ao histórico agnóstico (Papel Tool).
			// tc.ID foi garantido como não-vazio acima, portanto ToolCallID e ToolID
			// estarão sempre consistentes com a mensagem do Assistant — conformidade OpenAI.
			history = append(history, llm.MensagemAgnostica{
				Role:     llm.PapelTool,
				Content:  string(outputJSON),
				ToolID:   tc.ID,   // Referencia o ID gerado/recebido da chamada original
				ToolName: tc.Nome, // Nome da ferramenta (exigido por alguns provedores)
			})

			trace = append(trace, TraceEvent{
				Action: "tool_return",
				Tool:   tc.Nome,
				Output: resMap,
				Time:   time.Now(),
			})
		}
		// Continua o loop para que a IA processe os resultados das ferramentas
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
// the tool name + sorted-key JSON of args. Sorting keys ensures that
// {"b":2,"a":1} and {"a":1,"b":2} produce the same fingerprint.
func hitlFingerprint(toolName string, args map[string]interface{}) string {
	// Extract and sort keys for deterministic ordering
	keys := make([]string, 0, len(args))
	for k := range args {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Build ordered pairs
	ordered := make([]interface{}, 0, len(keys)*2)
	for _, k := range keys {
		ordered = append(ordered, k, args[k])
	}

	b, _ := json.Marshal(ordered)
	return toolName + ":" + string(b)
}
