package state

import (
	"context"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/whatsapp"
)

// handleActiveState routes a message when the user is in a middle of an interview (FSM State != Initial)
func handleActiveState(state string, ctxMap map[string]interface{}, body string, from string, phone string, profile *supabase.Profile, respondWithAudio bool, sbClient *supabase.Client, wpClient *whatsapp.Client, ttsClient *tts.Orchestrator, historyManager *history.Manager, startTime time.Time) ProcessResult {
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

// handleDuvidaFallback is used when the complex multi-agent flow fails
func handleDuvidaFallback(wpClient *whatsapp.Client, ttsClient *tts.Orchestrator, from string, gemClient *gemini.Client, body string, respondWithAudio bool, sbClient *supabase.Client, profile *supabase.Profile, startTime time.Time, promptTokens int, completionTokens int, finalIntent string) ProcessResult {
	log.Printf("⚠️ [FSM] Usando Fallback RAG para dúvida do usuário.")
	
	ragResp, err := gemClient.AskExpert(body)
	if err != nil {
		log.Printf("❌ [FSM] Falha crítica no Fallback RAG: %v", err)
		sendFeedback(wpClient, ttsClient, from, "⚠️ No momento não consigo processar sua dúvida. Tente novamente mais tarde.", respondWithAudio)
		return ProcessResult{Success: false, Reason: "rag_fallback_failed"}
	}
	
	botResponse := "📚 *Assistente:* " + ragResp
	sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
	recordLog(sbClient, profile, body, botResponse, "gemini-flash-rag", promptTokens, completionTokens, finalIntent, nil, startTime, true)
	
	return ProcessResult{Success: true, Reason: "rag_answered"}
}
