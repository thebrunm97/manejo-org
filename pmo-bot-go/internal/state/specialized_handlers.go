package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/generative-ai-go/genai"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

// handleActiveState routes a message when the user is in a middle of an interview (FSM State != Initial)
func handleActiveState(state string, ctxMap map[string]interface{}, body string, from string, phone string, profile *supabase.Profile, respondWithAudio bool, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, historyManager *history.Manager, startTime time.Time) ProcessResult {
	switch state {
	case StateAguardandoQuantidade:
		return handleAguardandoQuantidade(context.Background(), body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, ctxMap, startTime)
	case StateAguardandoCompra:
		return handleAguardandoCompra(context.Background(), body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, ctxMap, startTime)
	default:
		log.Printf("⚠️ [FSM] Estado desconhecido detectado: %s. Limpando.", state)
		historyManager.ClearFSMState(phone)
		return ProcessResult{Success: false, Reason: "unknown_state_cleared"}
	}
}

// handleDuvidaFallback is the specialist multi-agent entry point.
// It uses modular prompts, filtered tools, loop protection, and short-term memory injection.
func handleDuvidaFallback(wpClient ports.MessageSender, ttsClient *tts.Orchestrator, from string, gemClient *gemini.Client, body string, respondWithAudio bool, sbClient *supabase.Client, profile *supabase.Profile, startTime time.Time, promptTokens int, completionTokens int, finalIntent string, tools []*genai.Tool, guard *mcp.LoopGuard, historyManager *history.Manager, mcpServer *mcp.Server) ProcessResult {
	log.Printf("🤖 [FSM] Iniciando Fluxo Especialista (Intent: %s)", finalIntent)

	// 1. Prepare Specialized Context
	phone, _ := sbClient.ResolvePhone(from)
	modality := profile.ModalidadePredominante
	if modality == "" {
		modality = "NÃO DEFINIDA"
	}
	specPrompt := gemini.GetPromptForIntent(gemini.Intent(finalIntent), modality, profile.TemProducaoParalela)

	// 2. Prepare History
	var genaiHistory []*genai.Content
	if historyManager != nil {
		rawHistory := historyManager.GetHistory(phone)
		for _, msg := range rawHistory {
			role := msg.Role
			if role == "model" {
				role = "model"
			} else {
				role = "user"
			}
			genaiHistory = append(genaiHistory, &genai.Content{
				Role:  role,
				Parts: []genai.Part{genai.Text(msg.Content)},
			})
		}
	}

	// 3. Main Agentic Loop (max 5 turns)
	ctx := context.Background()
	var botResponse string
	var currentQuestion = body

	// Log JSON payload to inspect what we're sending to Gemini
	if len(tools) > 0 {
		toolJSON, _ := json.MarshalIndent(tools, "", "  ")
		log.Printf("📥 [FSM] Payload Tools enviado para o Gemini:\n%s", string(toolJSON))
	}

	for i := 0; i < 5; i++ {
		resp, session, err := gemClient.GenerateContentWithTools(ctx, currentQuestion, genaiHistory, tools, specPrompt)
		if err != nil {
			log.Printf("❌ [FSM] Erro na geração do agente (%d): %v", i, err)
			break
		}

		// Update history for subsequent turns in this loop
		genaiHistory = session.History

		if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
			break
		}

		part := resp.Candidates[0].Content.Parts[0]

		// CASE A: Model returned text (Terminal response)
		if text, ok := part.(genai.Text); ok {
			botResponse = string(text)
			break
		}

		// CASE B: Model requested tool calls
		if funcCall, ok := part.(genai.FunctionCall); ok {
			log.Printf("🛠️ [FSM] Chamando ferramenta: %s", funcCall.Name)
			// Interceptador para o Motor Agronômico (Passo 4.3)
			if funcCall.Name == "calcular_recomendacao_adubacao" {
				funcResponse, err := executeCalcularAdubacao(ctx, sbClient, &funcCall)
				if err != nil {
					log.Printf("⚠️ [FSM] Erro no Motor Agronômico: %v", err)
					currentQuestion = fmt.Sprintf("Erro no motor agronômico: %v", err)
					continue
				}
				
				// Bypass SDK ChatSession bugs (Thought Signature missing) by using the Simplified Loop!
				// Convert the FunctionResponse map into a text response and restart the turn.
				resultJSON, _ := json.Marshal(funcResponse.Response)
				currentQuestion = fmt.Sprintf("[RESULTADO DA FERRAMENTA %s: %s]\nApresente esse cálculo ao produtor de forma amigável e técnica.", funcCall.Name, string(resultJSON))
				continue
			}

			result, err := mcpServer.CallToolWithGuard(guard, funcCall.Name, funcCall.Args)
			if err != nil {
				log.Printf("⚠️ [FSM] LoopGuard ou Erro na Tool: %v", err)
				currentQuestion = fmt.Sprintf("Erro na ferramenta: %v", err)
				continue
			}

			// Short-Term Memory Injection (InjectSystemNote)
			if historyManager != nil {
				historyManager.InjectSystemNote(phone, fmt.Sprintf("Tool '%s' executada. Resultado: %v", funcCall.Name, result))
			}

			// Prepare response for Gemini to continue
			// The next "question" is actually the tool result
			// (Note: In a real SDK-managed chat session, you'd send a FunctionResponse, 
			// but here we are using a simplified multi-turn loop helper)
			
			// For simplicity in this implementation, we restart the turn with the tool result 
			// as a "system observation" in the prompt or as a new user message.
			currentQuestion = fmt.Sprintf("[RESULTADO DA FERRAMENTA %s: %v]", funcCall.Name, result)
			continue
		}
		
		break
	}

	if botResponse == "" {
		botResponse = "⚠️ Desculpe, não consegui processar sua solicitação agora."
	}

	// 4. Feedback and Logging
	sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
	recordLog(sbClient, profile, body, botResponse, "gemini-agentic-v4", promptTokens, completionTokens, finalIntent, nil, startTime, true)
	
	if historyManager != nil {
		historyManager.AddMessage(phone, "user", body)
		historyManager.AddMessage(phone, "model", botResponse)
	}

	return ProcessResult{Success: true, Reason: "agent_responded"}
}
