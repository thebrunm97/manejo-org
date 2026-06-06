package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
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
	LLM         llm.LLMProvider
	SB          *supabase.Client
	MCP         *mcp.Server
	// OutputJudge validates the LLM's final response before delivery.
	// Set to nil to disable output governance (e.g. in tests).
	OutputJudge guardrails.OutputJudge
	// HITLController intercepts high-risk tool calls for producer confirmation.
	// Set to nil to disable HITL (development/test mode).
	HITL guardrails.HITLHandler
	// Phone is the producer's WhatsApp number — required for HITL confirmation messages.
	Phone string
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
	sysInst := systemPrompt + "\n" + farmContext + "\nUse as ferramentas para consultar ou registrar dados. Se as informações críticas (como IDs de talhão ou PMO) já constam no contexto acima, use-as DIRETAMENTE sem perguntar ou consultar novamente."

	var trace []TraceEvent
	var usage llm.UsoMetadados
	var lastToolMsg string
	var usedTools []string // track tool names for OutputJudge context
	effectiveModel := o.LLM.ModelName()

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
			currentHistory = append(currentHistory, llm.MensagemAgnostica{
				Role:    llm.PapelSystem,
				Content: "RESUMO OBRIGATÓRIO: NUNCA retorne uma resposta vazia. Resuma os resultados das ferramentas executadas de forma amigável para o usuário.",
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

			// ── Guardrail: Output Content Governance ─────────────────────────
			// Run after every final LLM response (non-tool turns).
			// Fail-open: if judge unavailable, delivers original text.
			if finalTexto != "" && o.OutputJudge != nil {
				verdict := o.OutputJudge.Judge(ctx, guardrails.JudgeRequest{
					UserInput:    userMessage,
					LLMOutput:    finalTexto,
					Intent:       "", // Intent not available here; enriched by FSM if needed
					ModalityFarm: profile.ModalidadePredominante,
					ToolsUsed:    usedTools,
				})
				if !verdict.Approved {
					log.Printf("🚨 [Judge] Resposta BLOQUEADA — violations=%v reason=%s",
						verdict.Violations, verdict.Reason)
					finalTexto = buildJudgeBlockedMessage(verdict)
				}
			}
			// ───────────────────────────────────────────────────────────────

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

			// ── HITL: Intercept High-Risk Tools ──────────────────────────────
			// Before ANY mutation, check if this tool requires producer approval.
			// Strategy: soft-pause — inject a synthetic "awaiting_confirmation" tool
			// result so the LLM generates a graceful hold message. The real
			// execution happens in the webhook on SIM response.
			if o.HITL != nil {
				if needsHITL, label := guardrails.RequiresHITL(tc.Nome); needsHITL {
					token, hitlErr := o.HITL.RequestApproval(ctx, guardrails.HITLRecord{
						FromPhone:   o.Phone,
						PmoID:       &profile.PmoAtivoID,
						UserID:      profile.ID,
						ToolName:    tc.Nome,
						ToolArgs:    args,
						ActionLabel: label,
					})
					if hitlErr == nil {
						log.Printf("⏸️ [HITL] Aprovação solicitada — tool=%s token=%s phone=%s",
							tc.Nome, token, o.Phone)
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
						continue // Skip actual tool execution — will resume on SIM
					}
					// HITL storage failed: fail-open → execute the tool normally
					log.Printf("⚠️ [HITL] Falha ao solicitar aprovação — executando ferramenta diretamente: %v", hitlErr)
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
				Role:    llm.PapelTool,
				Content: string(outputJSON),
				ToolID:  tc.ID, // Referencia o ID gerado/recebido da chamada original
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

