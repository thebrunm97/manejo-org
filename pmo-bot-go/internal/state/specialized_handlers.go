package state

import (
	"context"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

// handleDuvidaFallback is the specialist multi-agent entry point.
// It uses modular prompts, filtered tools, loop protection, and short-term memory injection.
func handleDuvidaFallback(ctx context.Context, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, from string, gemClient *gemini.Client, body string, respondWithAudio bool, sbClient *supabase.Client, profile *supabase.Profile, startTime time.Time, promptTokens int, completionTokens int, finalIntent string, tools []llm.FerramentaAgnostica, guard *mcp.LoopGuard, historyManager *history.Manager, mcpServer *mcp.Server) ProcessResult {
	log.Printf("🤖 [FSM] Iniciando Fluxo Especialista (Intent: %s)", finalIntent)

	// 1. Prepare Specialized Context
	phone, _ := sbClient.ResolvePhone(from)
	modality := profile.ModalidadePredominante
	if modality == "" {
		modality = "NÃO DEFINIDA"
	}
	specPrompt := gemini.GetPromptForIntent(gemini.Intent(finalIntent), modality, profile.TemProducaoParalela)

	// 2. Load History into Agnostic Format
	var agnosticHistory []llm.MensagemAgnostica
	if historyManager != nil {
		h := historyManager.GetHistory(phone)
		for _, m := range h {
			role := llm.PapelUser
			if m.Role != "user" {
				role = llm.PapelAssistant
			}
			agnosticHistory = append(agnosticHistory, llm.MensagemAgnostica{
				Role:    role,
				Content: m.Content,
			})
		}
	}

	var totalPromptTokens, totalCompletionTokens int
	
	// 3. Execute Agentic Loop via Orchestrator (Agnostic)
	orchestrator := NewOrchestrator(gemClient, sbClient, mcpServer)
	
	// Note: initialParts removed here. Multi-modal info is already in 'body' string processed by router
	botResponse, trace, usage, modelUsed, err := orchestrator.ExecuteAgenticLoop(ctx, profile, specPrompt, body, tools, agnosticHistory, guard)
	if err != nil {
		log.Printf("❌ [FSM] Erro no Orchestrator loop: %v", err)
		return ProcessResult{Success: false, Reason: "orchestrator_failed"}
	}

	totalPromptTokens = int(usage.PromptTokens)
	totalCompletionTokens = int(usage.CandidatesTokens)

	if botResponse == "" {
		botResponse = "⚠️ Desculpe, não consegui processar sua dúvida agora. Por favor, tente reformular sua pergunta ou tente novamente em instantes."
	}

	// 4. Final Response Delivery, Logging and History Storage
	sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
	recordLog(sbClient, profile, body, botResponse, gemClient.Config.Model, modelUsed, totalPromptTokens, totalCompletionTokens, finalIntent, nil, startTime, true, trace)
	
	if historyManager != nil {
		historyManager.AddMessage(phone, "user", body)
		historyManager.AddMessage(phone, "model", botResponse)
	}

	return ProcessResult{Success: true, Reason: "agent_responded"}
}
