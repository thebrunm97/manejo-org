package state // State machine and intent routing logic.

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/generative-ai-go/genai"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/whatsapp"
)

// ProcessResult gives insight into what happened (useful for tests/metrics)
type ProcessResult struct {
	Success       bool
	Reason        string
	TransactionID interface{}
}

// ProcessMessage orchestrates the flow:
// LID -> Phone -> Profile -> Media Handling -> State Logic -> Extraction -> Intent Routing
func ProcessMessage(ctx context.Context, from string, body string, msgID string, isAudio bool, isImage bool, sbClient *supabase.Client, groqClient *groq.Client, wpClient *whatsapp.Client, gemClient *gemini.Client, ttsClient *tts.Orchestrator, mcpServer *mcp.Server, historyManager *history.Manager) (res ProcessResult) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [FSM-PANIC] Erro interno catastrófico: %v", r)
			res = ProcessResult{Success: false, Reason: "internal_panic"}
		}
	}()

	startTime := time.Now()
	var botResponse string
	var aiModel = "groq-llama-3.3-70b" 
	var respondWithAudio = false

	// 1. Context Resolution & Authentication
	phone, _ := sbClient.ResolvePhone(from)
	profile, _ := sbClient.GetProfileByPhone(phone)

	// 2. Media Processing (Audio/Image)
	if isAudio {
		audioBytes, err := wpClient.DownloadAudio(msgID)
		if err == nil {
			transcription, err := groqClient.Transcribe(ctx, groq.AudioTranscriptionRequest{FileData: audioBytes, FileName: "audio.ogg"})
			if err == nil {
				body = transcription.Text
				respondWithAudio = true
				aiModel = "groq-whisper"
			}
		}
	} else if isImage {
		imageBytes, mimeType, err := wpClient.DownloadImage(msgID)
		if err == nil {
			description, err := gemClient.DescribeAgronomicImage(ctx, imageBytes, mimeType)
			if err == nil {
				body = description
				aiModel = "gemini-flash-vision"
			}
		}
	}

	// 3. Unauthenticated Flow
	if profile == nil {
		if strings.HasPrefix(strings.ToUpper(body), "CONECTAR ") {
			code := strings.TrimSpace(body[9:])
			if err := sbClient.LinkDeviceToWeb(phone, code); err == nil {
				wpClient.SendMessage(from, "✅ Aparelho vinculado com sucesso!")
				return ProcessResult{Success: true, Reason: "device_linked"}
			}
		}
		sendFeedback(wpClient, ttsClient, from, "❌ WhatsApp não vinculado. Vincule via portal web.", respondWithAudio)
		return ProcessResult{Success: false, Reason: "profile_not_found"}
	}

	// 4. State Management (Active Interviews)
	if historyManager != nil {
		state, ctxState := historyManager.GetFSMState(phone)
		if state != StateInitial {
			return handleActiveState(state, ctxState, body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, startTime)
		}
	}

	// 5. Direct Commands (Quota, Status)
	upperBody := strings.ToUpper(strings.TrimSpace(body))
	if upperBody == "/SALDO" {
		u, l, _ := sbClient.CheckSaldo(profile.ID)
		sendFeedback(wpClient, ttsClient, from, fmt.Sprintf("🪙 Créditos: %d/%d", u, l), respondWithAudio)
		return ProcessResult{Success: true, Reason: "status_checked"}
	}

	// 6. Intent Extraction (NER)
	authQuota, _, _ := sbClient.CheckAndDeductQuota(profile.ID, profile.PmoAtivoID, respondWithAudio)
	if !authQuota {
		sendFeedback(wpClient, ttsClient, from, "🪙 Limite esgotado.", false)
		return ProcessResult{Success: false, Reason: "quota_exceeded"}
	}

	// NEW: Architecture Hardening (Phase 4)
	// 1. LoopGuard Initialization (per-request)
	guard := mcp.NewLoopGuard(2)

	// 2. High-Level Intent Classification (Router)
	routerCtx, routerCancel := context.WithTimeout(ctx, 10*time.Second)
	defer routerCancel()

	routed, err := gemClient.ClassifyIntent(routerCtx, body)
	if err != nil {
		log.Printf("⚠️ [FSM] Router falhou: %v. Usando fallback.", err)
	}

	// 3. Dynamic Tool Filtering
	filteredTools := mcpServer.GetToolsForIntent(routed.Intent)
	log.Printf("🧭 [FSM] Intent: %s | Tools: %d | Guard: ON", routed.Intent, len(filteredTools))

	extracted, err := groqClient.Extract(body)
	if err != nil {
		return ProcessResult{Success: false, Reason: "llm_error"}
	}

	// 7. Intent Routing
	switch extracted.Intencao {
	case "registro":
		// Choke Point: Missing Quantity
		if parseToFloat(extracted.Quantidade) <= 0 && extracted.Atividade != "Compra/Aquisição" {
			botResponse = "Qual a quantidade exata utilizada?"
			if historyManager != nil { historyManager.SetFSMState(phone, StateAguardandoQuantidade, toMap(extracted)) }
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			return ProcessResult{Success: false, Reason: "missing_quantity"}
		}
		return finalizeRegistration(ctx, extracted, profile, sbClient, wpClient, ttsClient, from, body, respondWithAudio, startTime, historyManager, phone)

	case "limpeza":
		return handleLimpeza(ctx, extracted, profile, sbClient, wpClient, ttsClient, from, body, respondWithAudio, startTime, aiModel, extracted.TokensPrompt, extracted.TokensCompletion)

	case "registro_financeiro":
		return handleRegistroFinanceiro(ctx, extracted, profile, sbClient, wpClient, ttsClient, from, respondWithAudio)

	case "assumir_cota":
		return handleAssumirCota(ctx, extracted, profile, sbClient, wpClient, gemClient, ttsClient, from, body, respondWithAudio, startTime)

	case "duvida":
		// Multi-Agent Flow: Pass parameters to specialized handler
		return handleDuvidaFallback(wpClient, ttsClient, from, gemClient, body, respondWithAudio, sbClient, profile, startTime, extracted.TokensPrompt, extracted.TokensCompletion, string(routed.Intent), filteredTools, guard, historyManager, mcpServer)

	case "saudacao":
		sendFeedback(wpClient, ttsClient, from, "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?", respondWithAudio)
		return ProcessResult{Success: true, Reason: "greeting"}

	default:
		// If Router identified a DATABASE task but Groq didn't catch the NER 'registro', 
		// we can still route to the agentic flow if intent is RAG or DATABASE.
		if routed.Intent == "RAG" {
			return handleDuvidaFallback(wpClient, ttsClient, from, gemClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(routed.Intent), filteredTools, guard, historyManager, mcpServer)
		}
		return ProcessResult{Success: true, Reason: "ignored"}
	}
}
