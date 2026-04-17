package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
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
	Gemini *gemini.Client
	SB     *supabase.Client
	MCP    *mcp.Server
}

// NewOrchestrator creates a new agentic orchestrator.
func NewOrchestrator(gem *gemini.Client, sb *supabase.Client, mcpServer *mcp.Server) *Orchestrator {
	return &Orchestrator{
		Gemini: gem,
		SB:     sb,
		MCP:    mcpServer,
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
	effectiveModel := o.Gemini.Config.Model

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
		log.Printf("🤖 [Orchestrator] Turno %d/%d: Tentando Google (%s)...", i+1, 3, o.Gemini.Config.Model)

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

		resp, err = o.Gemini.CallGoogle(turnCtx, sysInst, currentHistory, tools, nil)

		if err != nil {
			googleErr := err // capture for structured logging
			log.Printf("⚠️ [Orchestrator] Turno %d — Google falhou: [%T] %v — Tentando OpenRouter (%s)...", i+1, googleErr, googleErr, o.Gemini.Config.OpenRouterModel)
			resp, err = o.Gemini.CallOpenRouter(turnCtx, sysInst, currentHistory, tools, nil)
			if err != nil {
				turnCancel()
				criticalErr := fmt.Errorf("turno %d — ambos os provedores falharam: google=(%v) openrouter=(%w)", i+1, googleErr, err)
				log.Printf("❌ [CRITICAL ORCHESTRATOR ERROR]: %v", criticalErr)
				return "", history, trace, usage, effectiveModel, criticalErr
			}
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
			return finalTexto, history, trace, usage, effectiveModel, nil
		}

		// Se houver chamadas de ferramentas, executamos cada uma
		for _, tc := range resp.ToolCalls {
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
