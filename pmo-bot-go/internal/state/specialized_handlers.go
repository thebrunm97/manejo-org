package state

import (
	"context"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"strings"
)

// ActiveOutputJudge is the package-level output governance judge.
// Set once at startup via SetOutputJudge; nil disables output governance.
// Thread-safe for reads after initialization (set before any goroutine starts).
var ActiveOutputJudge guardrails.OutputJudge

// ActiveHITLController is the package-level HITL approval controller.
// Set once at startup via SetHITL; nil disables HITL (development/test mode).
var ActiveHITLController guardrails.HITLHandler

// SetOutputJudge configures the package-level output judge.
// Must be called before the first ProcessMessage invocation.
func SetOutputJudge(judge guardrails.OutputJudge) {
	ActiveOutputJudge = judge
}

// SetHITL configures the package-level HITL controller.
// Must be called before the first ProcessMessage invocation.
func SetHITL(h guardrails.HITLHandler) {
	ActiveHITLController = h
}

// handleDuvidaFallback is the specialist multi-agent entry point.
// It uses modular prompts, filtered tools, loop protection, and short-term memory injection.
func handleDuvidaFallback(ctx context.Context, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, from string, gemClient *gemini.Client, body string, respondWithAudio bool, sbClient *supabase.Client, profile *supabase.Profile, startTime time.Time, promptTokens int, completionTokens int, finalIntent string, tools []llm.FerramentaAgnostica, guard *mcp.LoopGuard, historyManager *history.Manager, mcpServer *mcp.Server) (string, ProcessResult) {
	log.Printf("🤖 [FSM] Iniciando Fluxo Especialista (Intent: %s)", finalIntent)

	// 1. Prepare Specialized Context
	phone, _ := sbClient.ResolvePhone(from)
	modality := profile.ModalidadePredominante
	if modality == "" {
		modality = "NÃO DEFINIDA"
	}
	specPrompt := gemini.GetPromptForIntent(llm.Intent(finalIntent), modality, profile.TemProducaoParalela)

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
	orchestrator.OutputJudge = ActiveOutputJudge // wire output governance (nil = disabled)
	orchestrator.HITL = ActiveHITLController     // wire HITL controller (nil = disabled)
	orchestrator.Phone = phone                   // needed for HITL WhatsApp confirmation
	
	botResponse, newHistory, trace, usage, modelUsed, err := orchestrator.ExecuteAgenticLoop(ctx, profile, specPrompt, body, tools, agnosticHistory, guard)
	if err != nil {
		log.Printf("❌ [CRITICAL FSM ERROR] Orchestrator Loop failed: %v", err)
		return "⚠️ Ocorreu um erro interno ao processar sua dúvida. Por favor, tente novamente.", ProcessResult{Success: false, Reason: "orchestrator_failed"}
	}

	totalPromptTokens = int(usage.PromptTokens)
	totalCompletionTokens = int(usage.CandidatesTokens)

	if botResponse == "" {
		log.Printf("⚠️ [FSM] Resposta do bot vazia após execução do orquestrador. Usando fallback amigável.")
		botResponse = "✅ Operação registrada no sistema com sucesso!"
	} else {
		trimmed := strings.TrimSpace(botResponse)
		// Check for specific emojis that signal a non-technical header message
		excludePrefixes := []string{"✅", "❌", "🗑️", "⏳", "⚠️"}
		shouldOmitHeader := false
		for _, prefix := range excludePrefixes {
			if strings.HasPrefix(trimmed, prefix) {
				shouldOmitHeader = true
				break
			}
		}

		if shouldOmitHeader {
			botResponse = trimmed // Keep clean confirmation/error
		} else {
			botResponse = "🌿 *Consulta Técnica:*\n\n" + trimmed
		}
	}

	// 4. Logging and History Storage (No direct sendFeedback)
	extraction := map[string]interface{}{
		"intent": finalIntent,
		"query":  body,
		"trace":  trace, // Include trace in training log for better debugging
	}
	recordLog(sbClient, profile, body, botResponse, gemClient.Config.Model, modelUsed, totalPromptTokens, totalCompletionTokens, finalIntent, extraction, startTime, true, trace)
	
	if historyManager != nil {
		historyManager.AppendAgnosticHistory(phone, newHistory)
	}

	return botResponse, ProcessResult{Success: true, Reason: "agent_responded"}
}
