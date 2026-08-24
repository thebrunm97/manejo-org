package state // State machine and intent routing logic.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/Flagsmith/flagsmith-go-client/v3"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"golang.org/x/sync/errgroup"
)

// ProcessResult gives insight into what happened (useful for tests/metrics)
type ProcessResult struct {
	Success       bool
	Reason        string
	TransactionID interface{}
}

type RouterConfig struct {
	EnableFastRouter       bool
	EnableFastRouterShadow bool
	FastRouterTimeoutMS    int
}

var sessionMu sync.Map // map[phone]*sync.Mutex — one lock per session

// getSessionMutex returns a dedicated mutex for each phone/session.
func getSessionMutex(phone string) *sync.Mutex {
	mu, _ := sessionMu.LoadOrStore(phone, &sync.Mutex{})
	return mu.(*sync.Mutex)
}

// ProcessMessage orchestrates the flow:
// LID -> Phone -> Profile -> Media Handling -> State Logic -> Extraction -> Intent Routing
func ProcessMessage(ctx context.Context, msg ports.IncomingMessage, sbClient *supabase.Client, groqClient *groq.Client, wpClient ports.MessageSender, llmClient llm.LLMProvider, ttsClient ports.Synthesizer, mcpServer *mcp.Server, historyManager *history.Manager, flgClient *flagsmith.Client, routerCfg RouterConfig) (res ProcessResult) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [FSM-PANIC] Erro interno catastrófico: %v", r)
			res = ProcessResult{Success: false, Reason: "internal_panic"}
		}
	}()

	startTime := time.Now()
	if msg.RawPayloadID != "" {
		ctx = context.WithValue(ctx, "raw_payload_id", msg.RawPayloadID)
	}
	if msg.RawPayloadID != "" {
		ctx = context.WithValue(ctx, "raw_payload_id", msg.RawPayloadID)
	}
	var respondWithAudio = ports.ResolveResponseMode(msg)

	// Resolve phone early to log greetings correctly
	var phone string
	if sbClient != nil {
		phone, _ = sbClient.ResolvePhone(msg.From)
	}

	// 0. Mutex Locking for Concurrency Safety (State-Level Lock)
	// We lock based on the resolved phone, or fallback to msg.From.
	lockKey := msg.From
	if phone != "" {
		lockKey = phone
	}
	mu := getSessionMutex(lockKey)
	mu.Lock()
	defer mu.Unlock()

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
			if sbClient != nil && phone != "" {
				go func() {
					dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					_ = sbClient.InsertMessage(dbCtx, supabase.MessageInsert{
						Phone:   phone,
						Content: msg.Body,
						Role:    "user",
					})
					_ = sbClient.InsertMessage(dbCtx, supabase.MessageInsert{
						Phone:   phone,
						Content: "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?",
						Role:    "assistant",
					})
				}()
			}
			return ProcessResult{Success: true, Reason: "greeting_guard_ultra"}
		}
	}

	// 0.1 Comando de preferência de formato (DT-29).
	//
	// Vem logo depois do greeting guard e antes de qualquer chamada de LLM,
	// pelo mesmo motivo: interpretar "modo texto" com um modelo gastaria uma
	// chamada, uma cota e alguns segundos para reconhecer duas palavras fixas.
	//
	// Fica fora do bloco do greeting guard porque a condição é diferente: um
	// produtor pode perfeitamente MANDAR um áudio dizendo "modo texto", e
	// nesse caso o comando chega aqui já transcrito, com IsAudio falso.
	if msg.Body != "" && !msg.IsImage {
		if res, tratado := handlePreferenceCommand(msg.Body, msg.From, phone, sbClient, wpClient, ttsClient); tratado {
			return res
		}
	}

	// 1. Context Resolution & Authentication
	profile, _ := sbClient.GetProfileByPhone(phone)

	body := msg.Body

	// 2. Multimodal Parts Collection
	var routerText string

	// 2a. Media Processing (Audio/Image)
	if msg.IsAudio {
		log.Printf("[AUDIO-DEBUG] Iniciando processamento de áudio (ID: %s)", msg.ID)
		audioBytes, audioMimeType, err := wpClient.DownloadAudio(msg.ID, msg.RawPayload)
		if err != nil {
			log.Printf("[AUDIO-DEBUG] Falha ao baixar áudio: %v", err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Desculpe, não consegui ouvir o seu áudio. Pode repetir ou digitar?", false)
			return ProcessResult{Success: false, Reason: "audio_download_failed"}
		}

		log.Printf("[AUDIO-DEBUG] Áudio baixado com %d bytes, mime: %s", len(audioBytes), audioMimeType)
		// TODO(fase-5-ou-switchover): usar audioMimeType para derivar FileName dinamicamente,
		// igual ao groq_audio_adapter.go, quando este caminho for substituído por domain.ProcessAudioMessage.
		// Enquanto isso, audioMimeType é capturado (garante compilação e telemetria) mas NÃO altera o comportamento.
		transcription, err := groqClient.Transcribe(ctx, groq.AudioTranscriptionRequest{FileData: audioBytes, FileName: "audio.ogg", Language: "pt"})
		if err != nil {
			log.Printf("[AUDIO-DEBUG] Falha na transcrição Groq/Whisper: %v", err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Desculpe, não consegui ouvir o seu áudio. Pode repetir ou digitar?", false)
			return ProcessResult{Success: false, Reason: "audio_transcription_failed"}
		}

		cleanText := strings.TrimSpace(transcription.Text)
		if cleanText == "" {
			log.Printf("[AUDIO-DEBUG] Transcrição vazia recebida do Whisper")
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Desculpe, não consegui ouvir o seu áudio. Pode repetir ou digitar?", false)
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

	// Persist incoming user message to database
	if sbClient != nil && phone != "" && body != "" {
		dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = sbClient.InsertMessage(dbCtx, supabase.MessageInsert{
			Phone:   phone,
			Content: body,
			Role:    "user",
		})
		cancel()
	}

	// 3. Unauthenticated Flow
	if profile == nil {
		// O vínculo por código continua sendo o caminho de quem JÁ tem conta
		// no portal web — é verificado primeiro justamente para que o
		// onboarding não sequestre esse fluxo.
		if strings.HasPrefix(strings.ToUpper(body), "CONECTAR ") {
			code := strings.TrimSpace(body[9:])
			if err := sbClient.LinkDeviceToWeb(phone, code); err == nil {
				sendFeedback(sbClient, wpClient, ttsClient, msg.From, "✅ Aparelho vinculado com sucesso!", respondWithAudio)
				return ProcessResult{Success: true, Reason: "device_linked"}
			}
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "❌ Código inválido ou expirado. Confira no portal e tente de novo.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "invalid_link_code"}
		}

		// DT-58 — cadastro pelo próprio WhatsApp. Antes daqui saía
		// "Vincule via portal web" e o fluxo morria, obrigando quem só usa
		// WhatsApp a abrir um navegador para existir no sistema.
		if res, tratado := HandleOnboarding(ctx, msg, phone, body, respondWithAudio,
			sbClient, wpClient, ttsClient, llmClient, historyManager); tratado {
			return res
		}

		sendFeedback(sbClient, wpClient, ttsClient, msg.From, "❌ WhatsApp não vinculado. Vincule via portal web.", respondWithAudio)
		return ProcessResult{Success: false, Reason: "profile_not_found"}
	}

	bodyLower := strings.ToLower(strings.TrimSpace(body))

	// 3.1 Auto-Seleção Silenciosa & Forçada
	if profile.PmoAtivoID == 0 && bodyLower != "/trocar" && bodyLower != "/fazenda" {
		state, _, _ := historyManager.GetFSMState(phone)
		if state != StateAguardandoFazenda {
			propriedades, err := sbClient.GetPropriedadesDoUsuario(profile.ID)
			if err == nil {
				if len(propriedades) == 1 {
					_ = sbClient.UpdateActivePMO(profile.ID, propriedades[0].ID)
					if propriedades[0].PropriedadeID > 0 {
						_ = sbClient.UpdateActivePropriedade(profile.ID, propriedades[0].PropriedadeID, &propriedades[0].ID)
					}
					profile.PmoAtivoID = propriedades[0].ID
					log.Printf("[UX] Auto-select aplicado para usuário de propriedade única (PMO: %d)", propriedades[0].ID)
				} else if len(propriedades) > 1 {
					// Force menu selection
					bodyLower = "/trocar"
				}
			}
		}
	}

	// 4. State Management (Active Interviews)
	if historyManager != nil {
		state, ctxState, _ := historyManager.GetFSMState(phone)
		if state != StateInitial {
			return handleActiveState(state, ctxState, body, msg.From, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, startTime, llmClient.ModelName(), llmClient, mcpServer)
		}
	}

	// 5. Direct Commands (Quota, Status)
	if isSaldoQuery(body) {
		u, l, _ := sbClient.CheckSaldo(profile.ID)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, fmt.Sprintf("🪙 Créditos: %d/%d", u, l), respondWithAudio)
		return ProcessResult{Success: true, Reason: "status_checked"}
	}

	// 5.1 Seleção de Fazenda (/trocar)
	if bodyLower == "/trocar" || bodyLower == "/fazenda" {
		propriedades, err := sbClient.GetPropriedadesDoUsuario(profile.ID)
		if err != nil || len(propriedades) == 0 {
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "❌ Não encontrei nenhuma propriedade associada ao seu número. Por favor, contate o suporte.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "no_properties_found"}
		}

		if len(propriedades) == 1 {
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, fmt.Sprintf("🌱 Você possui apenas uma propriedade cadastrada: *%s*. Ela já está selecionada automaticamente para você!", propriedades[0].Nome), respondWithAudio)
			return ProcessResult{Success: true, Reason: "single_property_auto_selected"}
		}

		var menuBuilder strings.Builder
		menuBuilder.WriteString("📍 *Suas Propriedades:*\n")
		var pmoOptions []map[string]interface{}
		for i, p := range propriedades {
			menuBuilder.WriteString(fmt.Sprintf("%d️⃣ %s\n", i+1, p.Nome))
			pmoOptions = append(pmoOptions, map[string]interface{}{
				"index":          i + 1,
				"id":             p.ID,
				"nome":           p.Nome,
				"propriedade_id": p.PropriedadeID,
			})
		}
		menuBuilder.WriteString("\n👉 Responda com o número da fazenda que deseja acessar.")

		if historyManager != nil {
			historyManager.SetFSMState(phone, StateAguardandoFazenda, map[string]interface{}{"options": pmoOptions}, nil)
		}
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, menuBuilder.String(), respondWithAudio)
		return ProcessResult{Success: true, Reason: "fazenda_menu_sent"}
	}
	// 6. Intent Extraction (NER) & Intent Classification (Router) - Parallelized via errgroup
	var authQuota bool
	var unifiedRes llm.UnifiedIntentResult
	var routerModel string
	var agentDomain string = "general"
	var fastRouterRes RouterResult
	var fastRouterErr error

	g, gCtx := errgroup.WithContext(ctx)

	g.Go(func() error {
		var quotaErr error
		authQuota, _, quotaErr = sbClient.CheckAndDeductQuota(profile.ID, profile.PmoAtivoID, respondWithAudio)
		if quotaErr != nil {
			log.Printf("⚠️ [FSM] Falha ao descontar/verificar quota: %v", quotaErr)
		}
		return nil // Não aborta classificação em caso de falha de conexão na quota
	})

	g.Go(func() error {
		var routerErr error
		fastRouterTimeoutMS := 3000
		if routerCfg.FastRouterTimeoutMS > 0 {
			fastRouterTimeoutMS = routerCfg.FastRouterTimeoutMS
		}

		if routerCfg.EnableFastRouter {
			routerCtx, routerCancel := context.WithTimeout(gCtx, time.Duration(fastRouterTimeoutMS)*time.Millisecond)
			defer routerCancel()
			log.Printf("🚀 [FSM] Usando Fast Router para classificação (Timeout: %dms)", fastRouterTimeoutMS)
			startFast := time.Now()
			fastRouterRes, fastRouterErr = EvaluateWithLLM(routerCtx, llmClient, routerText)
			fastLatency := time.Since(startFast).Milliseconds()

			if routerCfg.EnableFastRouterShadow {
				log.Printf("👻 [FSM] Shadow Mode: FastRouter result = %+v, err = %v", fastRouterRes, fastRouterErr)
				// RUN LEGACY
				startLegacy := time.Now()
				legacyCtx, legacyCancel := context.WithTimeout(gCtx, 30*time.Second)
				defer legacyCancel()
				unifiedRes, routerModel, routerErr = llmClient.ClassifyIntent(legacyCtx, routerText)
				legacyLatency := time.Since(startLegacy).Milliseconds()
				
				log.Printf("telemetry event=shadow_router_evaluated conversation_id=%s fast_latency_ms=%d legacy_latency_ms=%d", phone, fastLatency, legacyLatency)
				
				fastIntent := "unknown"
				if fastRouterErr == nil {
					fastIntent = string(fastRouterRes.PrimaryIntent)
				}
				
				legacyIntent := "unknown"
				if routerErr == nil && len(unifiedRes.Intents) > 0 {
					legacyIntent = string(unifiedRes.Intents[0])
				}
				
				diverged := (fastIntent != legacyIntent)
				if diverged {
					log.Printf("telemetry event=shadow_router_diverged conversation_id=%s fast_intent=%s legacy_intent=%s", phone, fastIntent, legacyIntent)
				}
				
				log.Printf("telemetry event=router_decision_made router=legacy decision=%s shadow_enabled=true diverged=%t conversation_id=%s", legacyIntent, diverged, phone)

				if routerErr != nil {
					log.Printf("⚠️ [FSM] Router Unificado falhou (timeout ou erro): %v. Usando fallback.", routerErr)
					unifiedRes = llm.UnifiedIntentResult{
						Intents:  []llm.Intent{llm.IntentRAG},
						Entities: []llm.AcaoEstruturada{{Intencao: "duvida"}},
					}
				}
			} else {
				if fastRouterErr != nil {
					log.Printf("⚠️ [FSM] Fast Router falhou: %v. Usando fallback seguro (Sem escrita).", fastRouterErr)
					log.Printf("telemetry event=router_decision_made router=fast decision=RAG_FALLBACK shadow_enabled=false diverged=false conversation_id=%s", phone)
					unifiedRes = llm.UnifiedIntentResult{
						Intents:  []llm.Intent{llm.IntentRAG},
						Entities: []llm.AcaoEstruturada{{Intencao: "duvida"}},
					}
				} else {
					routerModel = llmClient.ModelName()
					unifiedRes = llm.UnifiedIntentResult{
						Intents: []llm.Intent{llm.Intent(fastRouterRes.PrimaryIntent)},
					}
					log.Printf("telemetry event=router_decision_made router=fast decision=%s shadow_enabled=false diverged=false conversation_id=%s", string(fastRouterRes.PrimaryIntent), phone)
					if fastRouterRes.SecondaryIntent != nil && *fastRouterRes.SecondaryIntent != "" {
						unifiedRes.Intents = append(unifiedRes.Intents, llm.Intent(*fastRouterRes.SecondaryIntent))
					}
				}
			}
		} else {
			// Legacy Mode
			startLegacy := time.Now()
			legacyCtx, legacyCancel := context.WithTimeout(gCtx, 30*time.Second)
			defer legacyCancel()
			unifiedRes, routerModel, routerErr = llmClient.ClassifyIntent(legacyCtx, routerText)
			
			legacyIntent := "unknown"
			if routerErr == nil && len(unifiedRes.Intents) > 0 {
				legacyIntent = string(unifiedRes.Intents[0])
			} else if routerErr != nil {
				legacyIntent = "RAG_FALLBACK"
			}
			log.Printf("telemetry event=router_decision_made router=legacy decision=%s shadow_enabled=false diverged=false conversation_id=%s latency_ms=%d", legacyIntent, phone, time.Since(startLegacy).Milliseconds())

			if routerErr != nil {
				log.Printf("⚠️ [FSM] Router Unificado falhou (timeout ou erro): %v. Usando fallback.", routerErr)
				unifiedRes = llm.UnifiedIntentResult{
					Intents:  []llm.Intent{llm.IntentRAG},
					Entities: []llm.AcaoEstruturada{{Intencao: "duvida"}},
				}
			}
		}
		return nil
	})

	g.Go(func() error {
		triageCtx, triageCancel := context.WithTimeout(gCtx, 10*time.Second)
		defer triageCancel()

		sysPrompt := `Você é um Triador Especialista de intenções ultrarrápido para um sistema agrícola (ManejoORG).
O seu único objetivo é ler a mensagem do produtor e classificar a qual DOMÍNIO ela pertence.

DOMÍNIOS PERMITIDOS:
- "agronomy": Dúvidas sobre plantio, pragas, adubação, colheita, clima, ou RAG agronômico.
- "finance": Registros de compras, vendas, lucros, despesas, ou relatórios financeiros.
- "support": Dúvidas sobre como usar a plataforma, problemas técnicos ou reset de senha.
- "general": Saudações casuais, conversas fora de contexto ou intenções indefinidas.

REGRA ABSOLUTA DE SAÍDA:
Você DEVE retornar EXCLUSIVAMENTE um objeto JSON válido, sem markdown, sem justificações e sem formatação adicional. O objeto deve conter exatamente a chave "agent_domain".`

		resp, _, err := llmClient.AskSimple(triageCtx, routerText, sysPrompt)
		if err != nil {
			log.Printf("⚠️ [FSM] Triador falhou: %v", err)
			return nil
		}

		var parsed struct {
			AgentDomain string `json:"agent_domain"`
		}

		// Clean possible markdown
		cleanResp := strings.TrimSpace(resp)
		if strings.HasPrefix(cleanResp, "```json") {
			cleanResp = strings.TrimPrefix(cleanResp, "```json")
			cleanResp = strings.TrimSuffix(cleanResp, "```")
		} else if strings.HasPrefix(cleanResp, "```") {
			cleanResp = strings.TrimPrefix(cleanResp, "```")
			cleanResp = strings.TrimSuffix(cleanResp, "```")
		}
		cleanResp = strings.TrimSpace(cleanResp)

		if err := json.Unmarshal([]byte(cleanResp), &parsed); err != nil {
			log.Printf("⚠️ [FSM] Falha no parse do JSON do Triador: %v", err)
		} else {
			domain := strings.ToLower(parsed.AgentDomain)
			if domain == "agronomy" || domain == "finance" || domain == "support" {
				agentDomain = domain
			}
		}
		return nil
	})

	_ = g.Wait()

	log.Printf("⏱️ [TRACING] Sub-passo: Setup Inicial: %v", time.Since(startTime))

	if !authQuota {
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, "🪙 Limite esgotado.", false)
		return ProcessResult{Success: false, Reason: "quota_exceeded"}
	}

	// NEW: Architecture Hardening (Phase 4)
	// 1. LoopGuard Initialization (per-request)
	guard := mcp.NewLoopGuard(2)

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
			resMsg, res := handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, "CHAT", filteredTools, guard, historyManager, mcpServer, agentDomain, fastRouterRes)
			if resMsg != "" {
				sendFeedback(sbClient, wpClient, ttsClient, msg.From, resMsg, respondWithAudio)
			}
			return res
		}

		botResponse := "Olá! Sou o assistente do ManejoORG. Como posso ajudar você hoje?"
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, botResponse, respondWithAudio)
		recordLog(sbClient, profile, body, botResponse, string(routerModel), string(routerModel), 0, 0, 0, 0, "chat_fast", nil, startTime, true, nil)
		return ProcessResult{Success: true, Reason: "chat_fast"}
	}

	// 4. Perceived Latency: Immediate ACK for complex requests (RAG, DATABASE, REGISTRO_FINANCEIRO)
	isComplex := false
	for _, it := range unifiedRes.Intents {
		if it != llm.IntentChat {
			isComplex = true
			break
		}
	}

	if isComplex {
		log.Printf("⏳ [FSM] Enviando ACK imediato para solicitação complexa (RAG/Mutação)")
		go wpClient.SendMessage(msg.From, "⏳ Processando sua solicitação...")
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
		var filteredTools []llm.FerramentaAgnostica
		if routerCfg.EnableFastRouter && fastRouterErr == nil && fastRouterRes.Confidence > 0 && !routerCfg.EnableFastRouterShadow {
			log.Printf("🛡️ [FSM] Aplicando FilterToolsByRouterResult (FastRouter) para intenção: %s", intent)
			allTools := mcpServer.GetAllMCPTools()
			allowed := FilterToolsByRouterResult(fastRouterRes, allTools)
			for _, t := range allowed {
				filteredTools = append(filteredTools, t.Definition)
			}
		} else {
			filteredTools = mcpServer.GetToolsForIntent(string(intent))
		}

		// 3. Executar o loop de agente isolado para esta intenção
		resMsg, res := handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(intent), filteredTools, guard, historyManager, mcpServer, agentDomain, fastRouterRes)

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
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, aggregatedResponse, respondWithAudio)
		return lastRes
	}

	if lastRes.Reason == "hitl_pending" {
		return lastRes
	}

	// 7. Hard fallback: aggregatedResponse is empty after all processing.
	log.Printf("⚠️ [FSM] Nenhuma resposta gerada após processamento completo. Enviando fallback.")
	sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Desculpe, não consegui processar sua mensagem. Pode tentar novamente?", respondWithAudio)
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
func dispatchEntity(ctx context.Context, entity llm.AcaoEstruturada, profile *supabase.Profile, sbClient *supabase.Client, wpClient ports.MessageSender, llmClient llm.LLMProvider, ttsClient ports.Synthesizer, mcpServer *mcp.Server, historyManager *history.Manager, phone string, body string, respondWithAudio bool, startTime time.Time, routedIntent llm.Intent, filteredTools []llm.FerramentaAgnostica, guard *mcp.LoopGuard, routerModel string, agentDomain string, fastRouterRes RouterResult) (string, ProcessResult) {
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
			if historyManager != nil {
				historyManager.SetFSMState(phone, StateAguardandoQuantidade, toMap(extracted), nil)
			}
			return botResponse, ProcessResult{Success: false, Reason: "missing_quantity"}
		}
		return finalizeRegistration(ctx, extracted, profile, sbClient, wpClient, ttsClient, phone, body, respondWithAudio, startTime, historyManager, phone, routerModel)

	case "limpeza":
		return handleLimpeza(ctx, extracted, profile, sbClient, wpClient, ttsClient, phone, body, respondWithAudio, startTime, routerModel, routerModel, 0, 0)

	case "registro_financeiro":
		return handleRegistroFinanceiro(ctx, extracted, profile, sbClient, wpClient, ttsClient, phone, respondWithAudio, historyManager)

	case "assumir_cota":
		// Note: handleAssumirCota might need similar refactor if used in loops, but for now we focus on records
		return handleAssumirCota(ctx, extracted, profile, sbClient, wpClient, llmClient, ttsClient, phone, body, respondWithAudio, startTime, routerModel, routerModel)

	case "duvida":
		return handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(routedIntent), filteredTools, guard, historyManager, mcpServer, agentDomain, fastRouterRes)

	case "saudacao":
		return "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?", ProcessResult{Success: true, Reason: "greeting"}

	default:
		// Resilience: If the router detected CHAT intent but extraction failed or produced unknown actions,
		// we should still provide a friendly greeting instead of failing.
		if routedIntent == llm.IntentChat {
			return "Olá! Sou o assistente do ManejoORG. Como posso ajudar com seu registro ou dúvida hoje?", ProcessResult{Success: true, Reason: "greeting_fallback"}
		}

		if routedIntent == llm.IntentRAG || routedIntent == llm.IntentDatabase {
			return handleDuvidaFallback(ctx, wpClient, ttsClient, phone, llmClient, body, respondWithAudio, sbClient, profile, startTime, 0, 0, string(routedIntent), filteredTools, guard, historyManager, mcpServer, agentDomain, fastRouterRes)
		}
		return "", ProcessResult{Success: true, Reason: "ignored"}
	}
}

// handleActiveState dispatches turn-2 messages to their respective handlers
// handleActiveState dispatches turn-2 messages to their respective handlers
func handleActiveState(state string, ctxState map[string]interface{}, body string, from string, phone string, profile *supabase.Profile, respondWithAudio bool, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient ports.Synthesizer, historyManager *history.Manager, startTime time.Time, modelConfigured string, llmClient llm.LLMProvider, mcpServer *mcp.Server) ProcessResult {
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
	case StateAguardandoFazenda:
		botResponse, res = handleAguardandoFazenda(ctx, body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, ctxState, startTime, modelConfigured)
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
			resMsg, nextRes := dispatchEntity(ctx, next, profile, sbClient, wpClient, llmClient, ttsClient, mcpServer, historyManager, phone, "", respondWithAudio, startTime, llm.IntentDatabase, nil, nil, modelConfigured, "general", RouterResult{})

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
					sendFeedback(sbClient, wpClient, ttsClient, from, botResponse, respondWithAudio)
				}
				return res
			}
		}

		botResponse = strings.Join(responses, "\n\n---\n\n")
	}

	if botResponse != "" {
		sendFeedback(sbClient, wpClient, ttsClient, from, botResponse, respondWithAudio)
	}
	return res
}

// isSaldoQuery checks if the message is a conversational inquiry about AI credits/limit.
func isSaldoQuery(body string) bool {
	upper := strings.ToUpper(strings.TrimSpace(body))
	clean := strings.TrimRight(upper, "?!.")

	// Exact commands or common variations
	if clean == "/SALDO" || clean == "SALDO" || clean == "SALDOS" ||
		clean == "CREDITO" || clean == "CREDITOS" || clean == "CRÉDITO" || clean == "CRÉDITOS" ||
		clean == "LIMITE" || clean == "LIMITES" {
		return true
	}

	// Conversational matching (short sentences only to avoid false positives)
	if len(clean) < 40 {
		hasQueryWord := strings.Contains(clean, "QUANTOS") ||
			strings.Contains(clean, "QUAL") ||
			strings.Contains(clean, "QUANTO") ||
			strings.Contains(clean, "MEU") ||
			strings.Contains(clean, "MEUS") ||
			strings.Contains(clean, "TENHO") ||
			strings.Contains(clean, "VER") ||
			strings.Contains(clean, "CONSULTAR")

		hasSaldoWord := strings.Contains(clean, "SALDO") ||
			strings.Contains(clean, "CREDITO") ||
			strings.Contains(clean, "CRÉDITO") ||
			strings.Contains(clean, "LIMITE")

		if hasQueryWord && hasSaldoWord {
			// Avoid false positives from recording payment terms like "comprei no credito"
			isPayment := strings.Contains(clean, "COMPREI") ||
				strings.Contains(clean, "PAGUEI") ||
				strings.Contains(clean, "VENDI") ||
				strings.Contains(clean, "PAGAMENTO") ||
				strings.Contains(clean, "COMPRA") ||
				strings.Contains(clean, "VENDA") ||
				strings.Contains(clean, "PRAZO")

			if !isPayment {
				return true
			}
		}
	}

	return false
}
