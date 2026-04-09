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
func (o *Orchestrator) ExecuteAgenticLoop(ctx context.Context, profile *supabase.Profile, systemPrompt string, userMessage string, tools []llm.FerramentaAgnostica, history []llm.MensagemAgnostica, guard *mcp.LoopGuard) (string, []TraceEvent, llm.UsoMetadados, string, error) {
	// 1. Fetch Context (Farm / Plots)
	farmContext := ""
	if profile.PropriedadeAtivaID > 0 {
		farmContext = fmt.Sprintf("\nCONTEXTO DO USUÁRIO:\n- Fazenda Ativa ID: %d\n", profile.PropriedadeAtivaID)
		if len(profile.Talhoes) > 0 {
			talhoesNames := []string{}
			for _, t := range profile.Talhoes {
				talhoesNames = append(talhoesNames, fmt.Sprintf("%s (ID: %d)", t.Nome, t.ID))
			}
			farmContext += fmt.Sprintf("- Talhões Disponíveis: %s\n", strings.Join(talhoesNames, ", "))
		}
		if profile.PmoAtivoID > 0 {
			farmContext += fmt.Sprintf("- PMO Ativo ID: %d\n", profile.PmoAtivoID)
		}
	}

	// 2. Setup System Instruction with dynamic context
	sysInst := systemPrompt + "\n" + farmContext + "\nUse as ferramentas para consultar ou registrar dados. Se as informações críticas (como IDs de talhão ou PMO) já constam no contexto acima, use-as DIRETAMENTE sem perguntar ou consultar novamente."

	var trace []TraceEvent
	var usage llm.UsoMetadados
	effectiveModel := o.Gemini.Config.Model

	// Append initial user message if present
	if userMessage != "" {
		history = append(history, llm.MensagemAgnostica{
			Role:    llm.PapelUser,
			Content: userMessage,
		})
	}

	for i := 0; i < 6; i++ { // Loop Guard (max 6 steps)
		var resp llm.RespostaAgnostica
		var err error

		// --- LOGICA DE FALLBACK (Try Google -> Fallback OpenRouter) ---
		log.Printf("🤖 [Orchestrator] Turno %d: Tentando Google...", i+1)
		resp, err = o.Gemini.CallGoogle(ctx, sysInst, history, tools)

		if err != nil {
			log.Printf("⚠️ [Orchestrator] Falha no Google: %v. Tentando OpenRouter...", err)
			resp, err = o.Gemini.CallOpenRouter(ctx, history, tools)
			if err != nil {
				return "", trace, usage, effectiveModel, fmt.Errorf("ambos os provedores falharam: %w", err)
			}
		}

		// Acumular métricas
		usage.PromptTokens += resp.Usage.PromptTokens
		usage.CandidatesTokens += resp.Usage.CandidatesTokens
		usage.TotalTokens += resp.Usage.TotalTokens
		effectiveModel = resp.Model

		// Guardar resposta da IA no histórico agnóstico
		history = append(history, llm.MensagemAgnostica{
			Role:      llm.PapelAssistant,
			Content:   resp.Texto,
			ToolCalls: resp.ToolCalls,
		})

		// Se não houver chamadas de ferramentas, retornamos o texto final
		if len(resp.ToolCalls) == 0 {
			return resp.Texto, trace, usage, effectiveModel, nil
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
			}

			outputJSON, _ := json.Marshal(resMap)
			
			// Adicionar resultado ao histórico agnóstico (Papel Tool)
			history = append(history, llm.MensagemAgnostica{
				Role:    llm.PapelTool,
				Content: string(outputJSON),
				ToolID:  tc.ID, // Necessário para OpenAI, ignorado pelo adaptador do Google se preferir
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

	return "Desculpe, excedi o limite de passos para processar sua solicitação.", trace, usage, effectiveModel, nil
}
