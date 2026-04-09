package state // State machine and intent routing logic.

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/Flagsmith/flagsmith-go-client/v3"
	"google.golang.org/genai"
)

// ProcessResult gives insight into what happened (useful for tests/metrics)
type ProcessResult struct {
	Success       bool
	Reason        string
	TransactionID interface{}
}

// ProcessMessage orchestrates the flow:
// LID -> Phone -> Profile -> Media Handling -> State Logic -> Extraction -> Intent Routing
func ProcessMessage(ctx context.Context, msg ports.IncomingMessage, sbClient *supabase.Client, groqClient *groq.Client, wpClient ports.MessageSender, gemClient *gemini.Client, ttsClient *tts.Orchestrator, mcpServer *mcp.Server, historyManager *history.Manager, flgClient *flagsmith.Client) (res ProcessResult) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [FSM-PANIC] Erro interno catastrófico: %v", r)
			res = ProcessResult{Success: false, Reason: "internal_panic"}
		}
	}()

	startTime := time.Now()
	var botResponse string
	var respondWithAudio = false

	// 1. Context Resolution & Authentication
	phone, _ := sbClient.ResolvePhone(msg.From)
	profile, _ := sbClient.GetProfileByPhone(phone)

	body := msg.Body

	// 2. Multimodal Parts Collection
	var initialParts []*genai.Part

	// 2a. Media Processing (Audio/Image)
	if msg.IsAudio {
		audioBytes, err := wpClient.DownloadAudio(msg.ID)
		if err == nil {
			transcription, err := groqClient.Transcribe(ctx, groq.AudioTranscriptionRequest{FileData: audioBytes, FileName: "audio.ogg"})
			if err == nil {
				initialParts = append(initialParts, &genai.Part{Text: transcription.Text})
				body = transcription.Text
				respondWithAudio = true
			}
		}
	} else if msg.IsImage {
		imageBytes, mimeType, err := wpClient.DownloadImage(msg.ID)
		if err == nil {
			// Add photo to parts for the router
			initialParts = append(initialParts, &genai.Part{InlineData: &genai.Blob{Data: imageBytes, MIMEType: mimeType}})
			
			// If there's a caption, add it as text
			if body != "" {
				initialParts = append(initialParts, &genai.Part{Text: body})
			}

			// Keep legacy description for NER compatibility (Phase 1/2) until router fully handles vision extraction
			description, _, err := gemClient.DescribeAgronomicImage(ctx, imageBytes, mimeType)
			if err == nil {
				body = description
			}
		}
	} else if body != "" {
		initialParts = append(initialParts, &genai.Part{Text: body})
	}

	// 3. Unauthenticated Flow
	if profile == nil {
		if strings.HasPrefix(strings.ToUpper(body), "CONECTAR ") {
			code := strings.TrimSpace(body[9:])
			if err := sbClient.LinkDeviceToWeb(phone, code); err == nil {
				wpClient.SendMessage(msg.From, "✅ Aparelho vinculado com sucesso!")
				return ProcessResult{Success: true, Reason: "device_linked"}
			}
		}
		sendFeedback(wpClient, ttsClient, msg.From, "❌ WhatsApp não vinculado. Vincule via portal web.", respondWithAudio)
		return ProcessResult{Success: false, Reason: "profile_not_found"}
	}

	// 4. State Management (Active Interviews)
	if historyManager != nil {
		state, ctxState := historyManager.GetFSMState(phone)
		if state != StateInitial {
			return handleActiveState(state, ctxState, body, msg.From, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, startTime, gemClient.Config.Model)
		}
	}

	// 5. Direct Commands (Quota, Status)
	upperBody := strings.ToUpper(strings.TrimSpace(body))
	if upperBody == "/SALDO" {
		u, l, _ := sbClient.CheckSaldo(profile.ID)
		sendFeedback(wpClient, ttsClient, msg.From, fmt.Sprintf("🪙 Créditos: %d/%d", u, l), respondWithAudio)
		return ProcessResult{Success: true, Reason: "status_checked"}
	}

	// 6. Intent Extraction (NER)
	authQuota, _, _ := sbClient.CheckAndDeductQuota(profile.ID, profile.PmoAtivoID, respondWithAudio)
	if !authQuota {
		sendFeedback(wpClient, ttsClient, msg.From, "🪙 Limite esgotado.", false)
		return ProcessResult{Success: false, Reason: "quota_exceeded"}
	}

	// NEW: Architecture Hardening (Phase 4)
	// 1. LoopGuard Initialization (per-request)
	guard := mcp.NewLoopGuard(2)

	// 2. High-Level Intent Classification (Router) & NER Extraction (Gemini Unified)
	unifiedRes, routerModel, err := gemClient.ClassifyIntent(ctx, initialParts)
	if err != nil {
		log.Printf("⚠️ [FSM] Router Unificado falhou: %v. Usando fallback.", err)
		unifiedRes = gemini.UnifiedIntentResult{Intent: gemini.IntentRAG, Intencao: "duvida"}
	}

	// Use UnifiedIntentResult directly as it has all needed fields
	routed := unifiedRes

	// Map UnifiedIntentResult back to groq.ExtractionResult for legacy compatibility
	var extracted = &groq.ExtractionResult{
		Intencao:          unifiedRes.Intencao,
		Atividade:         unifiedRes.Atividade,
		InsumoCultura:     unifiedRes.InsumoCultura,
		InsumoAplicado:    unifiedRes.InsumoAplicado,
		InsumoGenerico:    unifiedRes.InsumoGenerico,
		Quantidade:        unifiedRes.Quantidade,
		Unidade:           unifiedRes.Unidade,
		Localizacao:       unifiedRes.Localizacao,
		Data:              unifiedRes.Data,
		AlertaOrganico:    unifiedRes.AlertaOrganico,
		HouveDescartes:    unifiedRes.HouveDescartes,
		QtdDescartes:      unifiedRes.QtdDescartes,
		NecessitaMaisInfo: unifiedRes.NecessitaMaisInfo,
		PerguntaAoUsuario: unifiedRes.PerguntaAoUsuario,
		Fornecedor:        unifiedRes.Fornecedor,
		NotaFiscal:        unifiedRes.NotaFiscal,
		Marca:             unifiedRes.Marca,
		Composicao:        unifiedRes.Composicao,
		Procedencia:       unifiedRes.Procedencia,
		ItemArea:          unifiedRes.ItemArea,
		TipoLimpeza:       unifiedRes.TipoLimpeza,
		ProdutoUtilizado:  unifiedRes.ProdutoUtilizado,
		Dosagem:           unifiedRes.Dosagem,
		Responsavel:       unifiedRes.Responsavel,
		Lote:              unifiedRes.Lote,
		Cliente:           unifiedRes.Cliente,
		ValorTotal:        unifiedRes.ValorTotal,
	}

	// 3. Defensive Override for farm selection patterns (ensures tools are injected even if router stalls)
	msgLower := strings.ToLower(body)
	isSelection := strings.Contains(msgLower, "selecionar") || strings.Contains(msgLower, "fazenda") || strings.Contains(msgLower, "trabalhar na")
	if isSelection && (routed.Intent == "RAG" || routed.Intent == "CHAT" || routed.Confidence < 0.8) {
		log.Printf("🛡️ [FSM] Defensive Override: Intent '%s' forçado para DATABASE (Padrão de seleção detectado)", routed.Intent)
		routed.Intent = "DATABASE"
	}

	// 4. Dynamic Tool Filtering
	filteredTools := mcpServer.GetToolsForIntent(string(routed.Intent))
	log.Printf("🧭 [FSM] Intent: %s | Tools: %d | Guard: ON", routed.Intent, len(filteredTools))

	// 8. Intent Routing
	switch extracted.Intencao {
	case "registro":
		// Choke Point: Missing Quantity
		if parseToFloat(extracted.Quantidade) <= 0 && extracted.Atividade != "Compra/Aquisição" {
			botResponse = "Qual a quantidade exata utilizada?"
			if historyManager != nil { historyManager.SetFSMState(phone, StateAguardandoQuantidade, toMap(extracted)) }
			sendFeedback(wpClient, ttsClient, msg.From, botResponse, respondWithAudio)
			return ProcessResult{Success: false, Reason: "missing_quantity"}
		}
		return finalizeRegistration(ctx, extracted, profile, sbClient, wpClient, ttsClient, msg.From, body, respondWithAudio, startTime, historyManager, phone, gemClient.Config.Model)

	case "limpeza":
		return handleLimpeza(ctx, extracted, profile, sbClient, wpClient, ttsClient, msg.From, body, respondWithAudio, startTime, gemClient.Config.Model, routerModel, extracted.TokensPrompt, extracted.TokensCompletion)

	case "registro_financeiro":
		return handleRegistroFinanceiro(ctx, extracted, profile, sbClient, wpClient, ttsClient, msg.From, respondWithAudio)

	case "assumir_cota":
		return handleAssumirCota(ctx, extracted, profile, sbClient, wpClient, gemClient, ttsClient, msg.From, body, respondWithAudio, startTime, gemClient.Config.Model, routerModel)

	case "duvida":
		// Multi-Agent Flow: Pass parameters to specialized handler
		return handleDuvidaFallback(ctx, wpClient, ttsClient, msg.From, gemClient, body, respondWithAudio, sbClient, profile, startTime, extracted.TokensPrompt, extracted.TokensCompletion, string(routed.Intent), filteredTools, guard, historyManager, mcpServer)

	case "saudacao":
		sendFeedback(wpClient, ttsClient, msg.From, "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?", respondWithAudio)
		return ProcessResult{Success: true, Reason: "greeting"}

	default:
		// Se o Router identificou uma tarefa de DATABASE ou RAG, mas o Groq não pegou no NER 'registro',
		// ainda assim devemos enviar para o loop agentico para que ele use as tools.
		if routed.Intent == "RAG" || routed.Intent == "DATABASE" {
			log.Printf("🔀 [FSM] Redirecionando intent '%s' para Loop Agentico (Fallthrough)", routed.Intent)
			return handleDuvidaFallback(ctx, wpClient, ttsClient, msg.From, gemClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(routed.Intent), filteredTools, guard, historyManager, mcpServer)
		}
		return ProcessResult{Success: true, Reason: "ignored"}
	}
}

// handleActiveState dispatches turn-2 messages to their respective handlers
func handleActiveState(state string, ctxState map[string]interface{}, body string, from string, phone string, profile *supabase.Profile, respondWithAudio bool, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, historyManager *history.Manager, startTime time.Time, modelConfigured string) ProcessResult {
	ctx := context.Background()
	switch state {
	case StateAguardandoQuantidade:
		return handleAguardandoQuantidade(ctx, body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, ctxState, startTime, modelConfigured)
	case StateAguardandoCompra:
		return handleAguardandoCompra(ctx, body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, ctxState, startTime, modelConfigured)
	default:
		return ProcessResult{Success: false, Reason: "unknown_state"}
	}
}
