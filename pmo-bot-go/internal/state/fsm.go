package state // State machine and intent routing logic.

import (
	"context"
	"fmt"
	"log"
	"strings"
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
		routerCtx, routerCancel := context.WithTimeout(ctx, 30*time.Second)
		unifiedRes, routerModel, err = llmClient.ClassifyIntent(routerCtx, routerText)
		routerCancel()
	}

	if err != nil {
		log.Printf("⚠️ [FSM] Router Unificado falhou (timeout ou erro): %v. Usando fallback.", err)
		unifiedRes = llm.UnifiedIntentResult{
			Intents:  []llm.Intent{llm.IntentRAG},
			Entities: []llm.AcaoEstruturada{{Intencao: "duvida"}},
		}
	}

	// 3. Defensive Override for farm selection patterns (ensures tools are injected even if router stalls)
	msgLower := strings.ToLower(body)
	isSelection := strings.Contains(msgLower, "selecionar") || strings.Contains(msgLower, "fazenda") || strings.Contains(msgLower, "trabalhar na")
	if isSelection {
		hasDb := false
		for _, it := range unifiedRes.Intents {
			if it == llm.IntentDatabase {
				hasDb = true
				break
			}
		}
		if !hasDb || unifiedRes.Confidence < 0.8 {
			log.Printf("🛡️ [FSM] Defensive Override: Intents forçados para [DATABASE] (Padrão de seleção detectado)")
			unifiedRes.Intents = []llm.Intent{llm.IntentDatabase}
		}
	}

	log.Printf("🧭 [FSM] Intents: %v | Entities: %d | Guard: ON", unifiedRes.Intents, len(unifiedRes.Entities))

	// 3. Fast-Track: Simple Chat Logic
	if len(unifiedRes.Intents) == 1 && unifiedRes.Intents[0] == llm.IntentChat && len(unifiedRes.Entities) == 0 {
		log.Printf("⚡ [FSM] Fast-Track: Mensagem de CHAT simples.")

		// If the message looks like a confirmation word (SIM/NÃO) but no HITL
		// token exists, the producer may be confused or responding to an expired
		// request. Route to Orchestrator so the LLM can give a helpful reply
		// instead of the generic greeting.
		bodyNorm := strings.ToUpper(strings.TrimSpace(body))
		isApprovalWord := bodyNorm == "SIM" || bodyNorm == "NÃO" || bodyNorm == "NAO"
		if isApprovalWord {
			log.Printf("⚡ [FSM] Fast-Track: Palavra de aprovação sem HITL pendente — redirecionando ao Orchestrator para resposta contextual.")
			filteredTools := mcpServer.GetToolsForIntent("CHAT")
			resMsg, res := handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, "CHAT", filteredTools, guard, historyManager, mcpServer)
			if resMsg != "" {
				sendFeedback(wpClient, ttsClient, msg.From, resMsg, respondWithAudio)
			}
			return res
		}

		botResponse := "Olá! Sou o assistente do ManejoORG. Como posso ajudar você hoje?"
		sendFeedback(wpClient, ttsClient, msg.From, botResponse, respondWithAudio)
		recordLog(sbClient, profile, body, botResponse, string(routerModel), string(routerModel), 0, 0, "chat_fast", nil, startTime, true, nil)
		return ProcessResult{Success: true, Reason: "chat_fast"}
	}


	// 4. Perceived Latency: Immediate ACK for complex requests or RAG/DOUBTS
	isComplex := len(unifiedRes.Entities) > 1 || len(unifiedRes.Intents) > 1 || (len(unifiedRes.Intents) == 1 && unifiedRes.Intents[0] == llm.IntentRAG)
	// Self-check for single-entity doubts
	if !isComplex && len(unifiedRes.Entities) == 1 && unifiedRes.Entities[0].Intencao == "duvida" {
		isComplex = true
	}
	
	if isComplex {
		log.Printf("⏳ [FSM] Enviando ACK imediato para solicitação complexa")
		go wpClient.SendMessage(msg.From, "⏳ Um momento... Estou processando seus registros e consultando a base de dados.")
	}

	// 5. Sequential Processing of Intents
	var finalResponses []string
	var lastRes ProcessResult = ProcessResult{Success: true}

	for idxIntent, intent := range unifiedRes.Intents {
		log.Printf("📑 [FSM-LOOP] Processando Intenção %d/%d: %s", idxIntent+1, len(unifiedRes.Intents), intent)

		// Bug 3 Fix: Skip IntentChat when this is a mixed-intent message.
		// The Fast-Track above (line 193) already handles pure-chat messages.
		// In a multi-intent batch, a "saudação" entity would produce a generic greeting
		// that pollutes the consolidated response with "Olá! Sou o assistente...".
		if intent == llm.IntentChat && len(unifiedRes.Intents) > 1 {
			log.Printf("⏩ [FSM] Pulando IntentChat em mensagem mista (%d intents totais)", len(unifiedRes.Intents))
			continue
		}
		// 1. Verificar se há alguma entidade relacionada a esta intenção que precise de entrevista
		var interviewEntity *llm.AcaoEstruturada
		var interviewEntityIndex int = -1
		for idxEntity, entity := range unifiedRes.Entities {
			if entityMatchesIntent(entity.Intencao, intent) {
				isMissingQty := (entity.Intencao == "registro" || entity.Intencao == "registro_financeiro") &&
					parseToFloat(entity.Quantidade) <= 0 &&
					entity.Atividade != "Compra/Aquisição" &&
					entity.Intencao != "registro_financeiro" // financeiro puro usa valor_total, não quantidade

				if entity.NecessitaMaisInfo || entity.PerguntaAoUsuario != "" || isMissingQty {
					interviewEntity = &entity
					interviewEntityIndex = idxEntity
					break
				}
			}
		}

		if interviewEntity != nil {
			log.Printf("⏸️ [FSM] Ação pendente de informações (Entrevista para %s). Suspendendo loop.", interviewEntity.InsumoCultura)
			
			// Preparar pergunta da entrevista
			question := interviewEntity.PerguntaAoUsuario
			if question == "" {
				item := interviewEntity.InsumoCultura
				if item == "" {
					item = interviewEntity.InsumoAplicado
				}
				if item != "" {
					question = fmt.Sprintf("Qual a quantidade exata de *%s* utilizada?", item)
				} else {
					question = "Qual a quantidade exata utilizada?"
				}
			}

			// Salvar o estado da FSM e entidades pendentes
			if historyManager != nil {
				pending := unifiedRes.Entities[interviewEntityIndex:]
				historyManager.SetFSMState(phone, StateAguardandoQuantidade, toMap(interviewEntity), pending)
			}

			// Prepend sucessos anteriores, se houver
			if len(finalResponses) > 0 {
				header := "✅ Processados com sucesso:\n" + strings.Join(finalResponses, "\n\n") + "\n\n---\n\n"
				question = header + question
			}
			
			finalResponses = append(finalResponses, question)
			lastRes = ProcessResult{Success: false, Reason: "missing_quantity"}
			break // Interrompe o processamento das intenções seguintes
		}

		// 2. Descobrir as ferramentas MCP apenas para esta intenção
		filteredTools := mcpServer.GetToolsForIntent(string(intent))

		// 3. Executar o loop de agente isolado para esta intenção
		resMsg, res := handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(intent), filteredTools, guard, historyManager, mcpServer)
		
		if resMsg != "" {
			finalResponses = append(finalResponses, resMsg)
		}
		lastRes = res

		// Se a intenção falhou, interrompe
		if !res.Success {
			log.Printf("⚠️ [FSM] Intenção %s falhou. Motivo: %s", intent, res.Reason)
			break
		}
	}

	// 6. Consolidated Success Feedback
	if len(finalResponses) > 0 {
		aggregatedResponse := strings.Join(finalResponses, "\n\n---\n\n")
		sendFeedback(wpClient, ttsClient, msg.From, aggregatedResponse, respondWithAudio)
		return lastRes
	}

	if lastRes.Reason == "hitl_pending" {
		return lastRes
	}

	// 7. Hard fallback: aggregatedResponse is empty after all processing.
	log.Printf("⚠️ [FSM] Nenhuma resposta gerada após processamento completo. Enviando fallback.")
	sendFeedback(wpClient, ttsClient, msg.From, "Desculpe, não consegui processar sua mensagem. Pode tentar novamente?", respondWithAudio)
	return ProcessResult{Success: false, Reason: "empty_aggregated_response"}
}

// entityMatchesIntent resolves whether a extracted action's intention maps to a high-level intent
func entityMatchesIntent(entityIntencao string, intent llm.Intent) bool {
	switch intent {
	case llm.IntentDatabase:
		return entityIntencao == "registro" || entityIntencao == "limpeza" || entityIntencao == "propagacao" || entityIntencao == "compostagem"
	case llm.IntentFinance:
		return entityIntencao == "registro_financeiro"
	case llm.IntentRAG:
		return entityIntencao == "duvida"
	case llm.IntentChat:
		return entityIntencao == "saudacao"
	default:
		return false
	}
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
