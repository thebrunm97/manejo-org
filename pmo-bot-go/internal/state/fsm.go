package state // State machine and intent routing logic.

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/Flagsmith/flagsmith-go-client/v3"
)

// ProcessResult gives insight into what happened (useful for tests/metrics)
type ProcessResult struct {
	Success       bool
	Reason        string
	TransactionID interface{}
}

// ProcessMessage orchestrates the flow:
// LID -> Phone -> Profile -> Media Handling -> State Logic -> Extraction -> Intent Routing
func ProcessMessage(ctx context.Context, msg ports.IncomingMessage, sbClient *supabase.Client, groqClient *groq.Client, wpClient ports.MessageSender, llmClient llm.LLMProvider, ttsClient *tts.Orchestrator, mcpServer *mcp.Server, historyManager *history.Manager, flgClient *flagsmith.Client) (res ProcessResult) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [FSM-PANIC] Erro interno catastrófico: %v", r)
			res = ProcessResult{Success: false, Reason: "internal_panic"}
		}
	}()

	startTime := time.Now()
	var respondWithAudio = false

	// 0. Ultra-Low Latency Greeting Guard (Immediate response for text greetings)
	if !msg.IsAudio && !msg.IsImage && msg.Body != "" {
		cleanBody := strings.ToUpper(strings.TrimSpace(msg.Body))
		greetings := map[string]bool{
			"OI": true, "OLA": true, "OLÁ": true, "BOM DIA": true, 
			"BOA TARDE": true, "BOA NOITE": true, "EAI": true, "EAÍ": true,
			"HELLO": true, "HI": true,
		}
		// Match pure greeting or greeting with exclamation/dot
		base := strings.TrimRight(cleanBody, "!.")
		if greetings[base] {
			log.Printf("⚡ [FSM] Ultra-Fast Greeting Guard: intercepted '%s'", cleanBody)
			wpClient.SendMessage(msg.From, "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?")
			return ProcessResult{Success: true, Reason: "greeting_guard_ultra"}
		}
	}

	// 1. Context Resolution & Authentication
	phone, _ := sbClient.ResolvePhone(msg.From)
	profile, _ := sbClient.GetProfileByPhone(phone)

	body := msg.Body

	// 2. Multimodal Parts Collection
	var routerText string

	// 2a. Media Processing (Audio/Image)
	if msg.IsAudio {
		log.Printf("[AUDIO-DEBUG] Iniciando processamento de áudio (ID: %s)", msg.ID)
		audioBytes, err := wpClient.DownloadAudio(msg.ID, msg.RawPayload)
		if err != nil {
			log.Printf("[AUDIO-DEBUG] Falha ao baixar áudio: %v", err)
			sendFeedback(wpClient, ttsClient, msg.From, "Desculpe, não consegui ouvir o seu áudio. Pode repetir ou digitar?", false)
			return ProcessResult{Success: false, Reason: "audio_download_failed"}
		}

		log.Printf("[AUDIO-DEBUG] Áudio baixado com %d bytes", len(audioBytes))
		transcription, err := groqClient.Transcribe(ctx, groq.AudioTranscriptionRequest{FileData: audioBytes, FileName: "audio.ogg"})
		if err != nil {
			log.Printf("[AUDIO-DEBUG] Falha na transcrição Groq/Whisper: %v", err)
			sendFeedback(wpClient, ttsClient, msg.From, "Desculpe, não consegui ouvir o seu áudio. Pode repetir ou digitar?", false)
			return ProcessResult{Success: false, Reason: "audio_transcription_failed"}
		}

		cleanText := strings.TrimSpace(transcription.Text)
		if cleanText == "" {
			log.Printf("[AUDIO-DEBUG] Transcrição vazia recebida do Whisper")
			sendFeedback(wpClient, ttsClient, msg.From, "Desculpe, não consegui ouvir o seu áudio. Pode repetir ou digitar?", false)
			return ProcessResult{Success: false, Reason: "empty_audio_content"}
		}

		log.Printf("[AUDIO-DEBUG] Transcrição concluída: \"%s\"", cleanText)
		routerText = cleanText
		body = cleanText
		respondWithAudio = true
	} else if msg.IsImage {
		imageBytes, mimeType, err := wpClient.DownloadImage(msg.ID, msg.RawPayload)
		if err == nil {
			// Keep legacy description for NER compatibility
			description, _, err := llmClient.DescribeImage(ctx, imageBytes, mimeType)
			if err == nil {
				body = description
			}
			// If there's a caption, prepend it
			if msg.Body != "" {
				routerText = msg.Body + "\n\n" + body
			} else {
				routerText = body
			}
		}
	} else if body != "" {
		routerText = body
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
		state, ctxState, _ := historyManager.GetFSMState(phone)
		if state != StateInitial {
			return handleActiveState(state, ctxState, body, msg.From, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, startTime, llmClient.ModelName(), llmClient, mcpServer)
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
	var unifiedRes llm.UnifiedIntentResult
	var routerModel string
	var err error

	{
		// Isolated local context with 10s timeout for the Router only
		routerCtx, routerCancel := context.WithTimeout(ctx, 10*time.Second)
		unifiedRes, routerModel, err = llmClient.ClassifyIntent(routerCtx, routerText)
		routerCancel()
	}

	if err != nil {
		log.Printf("⚠️ [FSM] Router Unificado falhou (timeout ou erro): %v. Usando fallback.", err)
		unifiedRes = llm.UnifiedIntentResult{
			Intent:   llm.IntentRAG,
			Entities: []llm.AcaoEstruturada{{Intencao: "duvida"}},
		}
	}

	// 3. Defensive Override for farm selection patterns (ensures tools are injected even if router stalls)
	msgLower := strings.ToLower(body)
	isSelection := strings.Contains(msgLower, "selecionar") || strings.Contains(msgLower, "fazenda") || strings.Contains(msgLower, "trabalhar na")
	if isSelection && (unifiedRes.Intent == llm.IntentRAG || unifiedRes.Intent == llm.IntentChat || unifiedRes.Confidence < 0.8) {
		log.Printf("🛡️ [FSM] Defensive Override: Intent '%s' forçado para DATABASE (Padrão de seleção detectado)", unifiedRes.Intent)
		unifiedRes.Intent = llm.IntentDatabase
	}

	// 4. Dynamic Tool Filtering
	filteredTools := mcpServer.GetToolsForIntent(string(unifiedRes.Intent))
	log.Printf("🧭 [FSM] Intent: %s | Entities: %d | Guard: ON", unifiedRes.Intent, len(unifiedRes.Entities))

	// 3. Fast-Track: Simple Chat Logic
	if unifiedRes.Intent == llm.IntentChat && len(unifiedRes.Entities) == 0 {
		log.Printf("⚡ [FSM] Fast-Track: Mensagem de CHAT simples.")
		botResponse := "Olá! Sou o assistente do ManejoORG. Como posso ajudar você hoje?"
		sendFeedback(wpClient, ttsClient, msg.From, botResponse, respondWithAudio)
		recordLog(sbClient, profile, body, botResponse, string(routerModel), string(routerModel), 0, 0, "chat_fast", nil, startTime, true, nil)
		return ProcessResult{Success: true, Reason: "chat_fast"}
	}

	// 4. Perceived Latency: Immediate ACK for complex requests or RAG/DOUBTS
	isComplex := len(unifiedRes.Entities) > 1 || unifiedRes.Intent == llm.IntentRAG
	// Self-check for single-entity doubts
	if !isComplex && len(unifiedRes.Entities) == 1 && unifiedRes.Entities[0].Intencao == "duvida" {
		isComplex = true
	}
	
	if isComplex {
		log.Printf("⏳ [FSM] Enviando ACK imediato para solicitação complexa")
		go wpClient.SendMessage(msg.From, "⏳ Um momento... Estou processando seus registros e consultando a base de dados.")
	}

	// 5. Parallel Processing: Manage Goroutines with Limit & Context Cancellation
	var finalResponses []string
	var lastRes ProcessResult

	// 5a. Zero-Entity Guard: CHAT/RAG/DUVIDA messages may return no structured entities.
	if len(unifiedRes.Entities) == 0 {
		log.Printf("💬 [FSM] Zero entities detected (Intent: %s). Routing to chat/duvida handler.", unifiedRes.Intent)
		synthetic := llm.AcaoEstruturada{Intencao: "duvida"}
		if unifiedRes.Intent == llm.IntentChat {
			synthetic.Intencao = "saudacao"
		}
		resMsg, res := dispatchEntity(ctx, synthetic, profile, sbClient, wpClient, llmClient, ttsClient, mcpServer, historyManager, phone, body, respondWithAudio, startTime, unifiedRes.Intent, filteredTools, guard, routerModel)
		if resMsg != "" {
			finalResponses = append(finalResponses, resMsg)
		}
		lastRes = res
	} else {
		// 5b. Best-Effort Parallel Entity Loop.
		// Uses WaitGroup + semaphore instead of errgroup.WithContext, so a failed entity
		// does NOT cancel the shared context and kill sibling goroutines that are still running.
		const workerLimit = 3
		sem := make(chan struct{}, workerLimit)
		var wg sync.WaitGroup

		count := len(unifiedRes.Entities)
		// Pre-allocate slices: each goroutine writes only to its own index,
		// so no mutex is needed for the writes themselves.
		tempResponses := make([]string, count)
		tempResults := make([]ProcessResult, count)

		for i, entity := range unifiedRes.Entities {
			i, entity := i, entity // Capture loop variables to avoid closure bugs
			wg.Add(1)
			go func() {
				defer wg.Done()
				sem <- struct{}{}        // acquire slot (blocks if workerLimit reached)
				defer func() { <-sem }() // always release slot on exit

				log.Printf("📑 [FSM-WORKER] Processando Ação %d/%d: %s", i+1, count, entity.Intencao)
				resMsg, res := dispatchEntity(ctx, entity, profile, sbClient, wpClient, llmClient, ttsClient, mcpServer, historyManager, phone, body, respondWithAudio, startTime, unifiedRes.Intent, filteredTools, guard, routerModel)

				// Index-based writes are goroutine-safe: each i is unique.
				tempResponses[i] = resMsg
				tempResults[i] = res
				if !res.Success {
					log.Printf("⚠️ [FSM-WORKER] Ação %d/%d falhou (motivo: %s). Continuando demais workers.", i+1, count, res.Reason)
				}
			}()
		}

		wg.Wait() // wait for ALL workers to complete, regardless of partial failures

		// 5c. Aggregation: Collect results in order; stop displaying once we hit a failure
		// that requires user input (e.g., interview state). Successes that ran before the
		// failure are still surfaced to the user via the header.
		for i := 0; i < count; i++ {
			if tempResponses[i] != "" {
				finalResponses = append(finalResponses, tempResponses[i])
			}

			lastRes = tempResults[i]

			if !tempResults[i].Success {
				// If there are subsequent entities in the batch, save them as pending
				if historyManager != nil && i+1 < count {
					pending := unifiedRes.Entities[i+1:]
					currState, currCtx, _ := historyManager.GetFSMState(phone)
					historyManager.SetFSMState(phone, currState, currCtx, pending)
				}

				// Prepend confirmed successes so the user knows what was already saved.
				if len(finalResponses) > 1 {
					header := "✅ Processados com sucesso:\n" + strings.Join(finalResponses[:len(finalResponses)-1], "\n\n") + "\n\n---\n\n"
					finalResponses[len(finalResponses)-1] = header + finalResponses[len(finalResponses)-1]
				}
				sendFeedback(wpClient, ttsClient, msg.From, finalResponses[len(finalResponses)-1], respondWithAudio)
				return lastRes
			}
		}
	}

	// 6. Consolidated Success Feedback
	if len(finalResponses) > 0 {
		aggregatedResponse := strings.Join(finalResponses, "\n\n---\n\n")
		sendFeedback(wpClient, ttsClient, msg.From, aggregatedResponse, respondWithAudio)
		return lastRes
	}

	// 7. Hard fallback: aggregatedResponse is empty after all processing.
	// This should never happen in production, but protects against silent failures.
	log.Printf("⚠️ [FSM] Nenhuma resposta gerada após processamento completo (Intent: %s). Enviando fallback.", unifiedRes.Intent)
	sendFeedback(wpClient, ttsClient, msg.From, "Desculpe, não consegui processar sua mensagem. Pode tentar novamente?", respondWithAudio)
	return ProcessResult{Success: false, Reason: "empty_aggregated_response"}
}

// dispatchEntity routes a single action to its respective handler and returns the response string
func dispatchEntity(ctx context.Context, entity llm.AcaoEstruturada, profile *supabase.Profile, sbClient *supabase.Client, wpClient ports.MessageSender, llmClient llm.LLMProvider, ttsClient *tts.Orchestrator, mcpServer *mcp.Server, historyManager *history.Manager, phone string, body string, respondWithAudio bool, startTime time.Time, routedIntent llm.Intent, filteredTools []llm.FerramentaAgnostica, guard *mcp.LoopGuard, routerModel string) (string, ProcessResult) {
	// Map AcaoEstruturada to groq.ExtractionResult for handler compatibility
	extracted := &groq.ExtractionResult{
		Intencao:          entity.Intencao,
		Atividade:         entity.Atividade,
		InsumoCultura:     entity.InsumoCultura,
		InsumoAplicado:    entity.InsumoAplicado,
		InsumoGenerico:    entity.InsumoGenerico,
		Quantidade:        entity.Quantidade,
		Unidade:           entity.Unidade,
		Localizacao:       entity.Localizacao,
		Data:              entity.Data,
		AlertaOrganico:    entity.AlertaOrganico,
		HouveDescartes:    entity.HouveDescartes,
		QtdDescartes:      entity.QtdDescartes,
		NecessitaMaisInfo: entity.NecessitaMaisInfo,
		PerguntaAoUsuario: entity.PerguntaAoUsuario,
		Fornecedor:        entity.Fornecedor,
		NotaFiscal:        entity.NotaFiscal,
		Marca:             entity.Marca,
		Composicao:        entity.Composicao,
		Procedencia:       entity.Procedencia,
		ItemArea:          entity.ItemArea,
		TipoLimpeza:       entity.TipoLimpeza,
		ProdutoUtilizado:  entity.ProdutoUtilizado,
		Dosagem:           entity.Dosagem,
		Responsavel:       entity.Responsavel,
		Lote:              entity.Lote,
		Cliente:           entity.Cliente,
		ValorTotal:        entity.ValorTotal,
	}

	switch extracted.Intencao {
	case "registro":
		if parseToFloat(extracted.Quantidade) <= 0 && extracted.Atividade != "Compra/Aquisição" {
			item := extracted.InsumoCultura
			if item == "" {
				item = extracted.InsumoAplicado
			}
			var botResponse string
			if item != "" {
				botResponse = fmt.Sprintf("Qual a quantidade exata de *%s* utilizada?", item)
			} else {
				botResponse = "Qual a quantidade exata utilizada?"
			}
			if historyManager != nil { historyManager.SetFSMState(phone, StateAguardandoQuantidade, toMap(extracted), nil) }
			return botResponse, ProcessResult{Success: false, Reason: "missing_quantity"}
		}
		return finalizeRegistration(ctx, extracted, profile, sbClient, wpClient, ttsClient, phone, body, respondWithAudio, startTime, historyManager, phone, routerModel)

	case "limpeza":
		return handleLimpeza(ctx, extracted, profile, sbClient, wpClient, ttsClient, phone, body, respondWithAudio, startTime, routerModel, routerModel, 0, 0)

	case "registro_financeiro":
		return handleRegistroFinanceiro(ctx, extracted, profile, sbClient, wpClient, ttsClient, phone, respondWithAudio)

	case "assumir_cota":
		// Note: handleAssumirCota might need similar refactor if used in loops, but for now we focus on records
		return handleAssumirCota(ctx, extracted, profile, sbClient, wpClient, llmClient, ttsClient, phone, body, respondWithAudio, startTime, routerModel, routerModel)

	case "duvida":
		return handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(routedIntent), filteredTools, guard, historyManager, mcpServer)

	case "saudacao":
		return "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?", ProcessResult{Success: true, Reason: "greeting"}

	default:
		// Resilience: If the router detected CHAT intent but extraction failed or produced unknown actions,
		// we should still provide a friendly greeting instead of failing.
		if routedIntent == llm.IntentChat {
			return "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?", ProcessResult{Success: true, Reason: "greeting_fallback"}
		}
		
		if routedIntent == llm.IntentRAG || routedIntent == llm.IntentDatabase {
				return handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(routedIntent), filteredTools, guard, historyManager, mcpServer)
		}
		return "", ProcessResult{Success: true, Reason: "ignored"}
	}
}

// handleActiveState dispatches turn-2 messages to their respective handlers
// handleActiveState dispatches turn-2 messages to their respective handlers
func handleActiveState(state string, ctxState map[string]interface{}, body string, from string, phone string, profile *supabase.Profile, respondWithAudio bool, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, historyManager *history.Manager, startTime time.Time, modelConfigured string, llmClient llm.LLMProvider, mcpServer *mcp.Server) ProcessResult {
	ctx := context.Background()
	var botResponse string
	var res ProcessResult

	// 1. Fetch pending entities before executing the handler (because the handler might clear the FSM state)
	var pending []llm.AcaoEstruturada
	if historyManager != nil {
		_, _, pending = historyManager.GetFSMState(phone)
	}

	switch state {
	case StateAguardandoQuantidade:
		botResponse, res = handleAguardandoQuantidade(ctx, body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, ctxState, startTime, modelConfigured)
	case StateAguardandoCompra:
		botResponse, res = handleAguardandoCompra(ctx, body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, ctxState, startTime, modelConfigured)
	default:
		return ProcessResult{Success: false, Reason: "unknown_state"}
	}

	// 2. If the current action succeeded, consume pending entities
	if res.Success && len(pending) > 0 {
		responses := []string{botResponse}

		for len(pending) > 0 {
			next := pending[0]
			pending = pending[1:]

			log.Printf("🔄 [FSM-PENDING] Consumindo ação pendente do batch: %s", next.Intencao)
			resMsg, nextRes := dispatchEntity(ctx, next, profile, sbClient, wpClient, llmClient, ttsClient, mcpServer, historyManager, phone, "", respondWithAudio, startTime, llm.IntentDatabase, nil, nil, modelConfigured)

			if nextRes.Success {
				if resMsg != "" {
					responses = append(responses, resMsg)
				}
				res = nextRes
			} else {
				// The next entity needs more info and has set the FSM state.
				// Save the remaining entities back to history.
				if historyManager != nil {
					currState, currCtx, _ := historyManager.GetFSMState(phone)
					historyManager.SetFSMState(phone, currState, currCtx, pending)
				}

				activity := next.Atividade
				if activity == "" {
					activity = next.Intencao
				}
				activityDisplay := activity
				if len(activity) > 0 {
					activityDisplay = strings.ToUpper(activity[:1]) + strings.ToLower(activity[1:])
				}

				item := next.InsumoCultura
				if item == "" {
					item = next.InsumoAplicado
				}

				var transition string
				if item != "" {
					transition = fmt.Sprintf("📅 *Agora, em relação ao registro de %s (%s):*", item, activityDisplay)
				} else {
					transition = fmt.Sprintf("📅 *Agora, em relação ao registro de %s:*", activityDisplay)
				}

				if resMsg != "" {
					resMsg = transition + "\n" + resMsg
				}
				responses = append(responses, resMsg)
				res = nextRes
				botResponse = strings.Join(responses, "\n\n---\n\n")
				if botResponse != "" {
					sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
				}
				return res
			}
		}

		botResponse = strings.Join(responses, "\n\n---\n\n")
	}

	if botResponse != "" {
		sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
	}
	return res
}
