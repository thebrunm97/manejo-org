package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
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

const (
	StateInitial              = ""
	StateAguardandoQuantidade = "aguardando_quantidade"
	StateAguardandoCompra     = "aguardando_compra"
)

// ProcessResult gives insight into what happened (useful for tests/metrics)
type ProcessResult struct {
	Success bool
	Reason  string
}

// ProcessMessage orchestrates the flow:
// LID -> Phone -> PMO ID -> LLM Extraction -> Organic Alert Check -> Save to Supabase -> Feedback
func ProcessMessage(ctx context.Context, from string, body string, msgID string, isAudio bool, isImage bool, sbClient *supabase.Client, groqClient *groq.Client, wpClient *whatsapp.Client, gemClient *gemini.Client, ttsClient *tts.Orchestrator, mcpServer *mcp.Server, historyManager *history.Manager) (res ProcessResult) {
	// Panic Recovery inside the logic layer
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [FSM-PANIC] Erro interno catastrófico: %v", r)
			res = ProcessResult{Success: false, Reason: "internal_panic"}
		}
	}()

	log.Printf("🧵 [FSM] Iniciando fluxo para mensagem de: %s (isAudio=%v)", from, isAudio)

	// Variables for tracking the process outcome and logging
	startTime := time.Now()
	var botResponse string
	var finalIntent string
	var aiModel = "llama-3.3-70b-versatile" // Default Groq model
	var promptTokens int
	var completionTokens int
	var respondWithAudio = false

	// Step 1: Resolve the sender's phone number as early as possible
	phone, err := sbClient.ResolvePhone(from)
	if err != nil {
		log.Printf("⚠️ [FSM] Erro ao resolver LID/telefone (%s): %v", from, err)
		phone = from
	}

	// Step 2: Resolve profile to have UserID for all consumption logs
	profile, _ := sbClient.GetProfileByPhone(phone)

	if isAudio {
		log.Printf("🎤 [FSM] Áudio detectado. Baixando media %s...", msgID)
		audioBytes, err := wpClient.DownloadAudio(msgID)
		if err != nil {
			log.Printf("❌ [FSM] Falha ao baixar áudio: %v", err)
			wpClient.SendMessage(from, "⚠️ Não consegui baixar seu áudio. Tente enviar de novo ou digite a mensagem.")
			return ProcessResult{Success: false, Reason: "audio_download_error"}
		}

		log.Printf("⬇️ [FSM] Áudio baixado (%d bytes). Iniciando transcrição Whisper...", len(audioBytes))

		ctxSTT, cancelSTT := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelSTT()

		sttReq := groq.AudioTranscriptionRequest{
			FileData: audioBytes,
			FileName: "audio.ogg",
		}

		transcription, err := groqClient.Transcribe(ctxSTT, sttReq)
		if err != nil {
			log.Printf("❌ [FSM] Falha na transcrição STT: %v", err)
			wpClient.SendMessage(from, "⚠️ Não consegui entender seu áudio. Pode digitar a mensagem?")
			return ProcessResult{Success: false, Reason: "audio_transcription_error"}
		}

		// Log immediate Whisper consumption if profile exists
		if profile != nil {
			log.Printf("📊 [Telemetry] Gravando consumo Whisper para usuário %s", profile.ID)
			_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
				UserID:   profile.ID,
				ModeloIA: "groq-whisper",
				Acao:     "stt",
				Status:   "success",
			})
		}

		body = transcription.Text
		respondWithAudio = true
		aiModel = "whisper-large-v3-turbo"
		log.Printf("📝 [FSM] Transcrição concluída: \"%s\"", body)
	}

	if isImage {
		log.Printf("📸 [FSM] Imagem detectada. Baixando media %s...", msgID)
		imageBytes, mimeType, err := wpClient.DownloadImage(msgID)
		if err != nil {
			log.Printf("❌ [FSM] Falha ao baixar imagem: %v", err)
			wpClient.SendMessage(from, "⚠️ Não consegui baixar sua imagem. Tente enviar de novo.")
			return ProcessResult{Success: false, Reason: "image_download_error"}
		}

		log.Printf("👁️ [FSM] Imagem baixada (%d bytes). Solicitando visão agronômica (gemini-2.5-flash)...", len(imageBytes))

		description, err := gemClient.DescribeAgronomicImage(ctx, imageBytes, mimeType)
		if err != nil {
			log.Printf("❌ [FSM] Falha na análise de visão: %v", err)
			wpClient.SendMessage(from, "⚠️ Tive um problema ao analisar sua foto. Pode tentar novamente?")
			return ProcessResult{Success: false, Reason: "vision_analysis_error"}
		}

		// Log vision consumption
		if profile != nil {
			log.Printf("📊 [Telemetry] Gravando consumo Gemini Vision para usuário %s", profile.ID)
			_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
				UserID:   profile.ID,
				ModeloIA: "gemini-2.5-flash",
				Acao:     "vision_description",
				Status:   "success",
			})
		}

		body = description
		aiModel = "gemini-2.5-flash-vision"
		log.Printf("📝 [FSM] Descrição da imagem concluída: \"%s\"", body)
	}

	// Step 2b: Intercept FSM State before general extractions
	if historyManager != nil && profile != nil {
		state, ctx := historyManager.GetFSMState(phone)
		if state != StateInitial {
			log.Printf("🔄 [FSM] Estado ativo detectado: %s", state)
			return handleActiveState(state, ctx, body, from, phone, profile, respondWithAudio, sbClient, wpClient, ttsClient, historyManager, startTime)
		}
	}

	// Step 2c: Handle unauthenticated flow (Link Device)
	if profile == nil {
		// Let's check if the user is trying to connect their device
		if strings.HasPrefix(strings.ToUpper(body), "CONECTAR ") {
			code := strings.TrimSpace(body[9:])
			errLink := sbClient.LinkDeviceToWeb(phone, code)
			if errLink != nil {
				wpClient.SendMessage(from, fmt.Sprintf("❌ Erro ao vincular aparelho: %v\n\nVerifique se o código está correto ou se já expirou no portal web.", errLink))
				return ProcessResult{Success: false, Reason: "link_device_failed"}
			}
			wpClient.SendMessage(from, "✅ Aparelho vinculado ao sistema com sucesso! Agora você já pode me enviar seus registros de manejo e dúvidas.")
			return ProcessResult{Success: true, Reason: "device_linked"}
		}

		unlinkedMsg := "❌ *WhatsApp Não Vinculado*\n\n" +
			"Olá! Para conectar seu WhatsApp ao *ManejoORG*, siga estes passos rápidos:\n\n" +
			"1️⃣ Acesse o sistema em 🌐 *https://manejo-org.vercel.app/*\n" +
			"2️⃣ No seu *Dashboard*, vá na seção *Assistente Inteligente* e clique em *Conectar WhatsApp*\n" +
			"3️⃣ Clique em *Gerar Código de Conexão*\n\n" +
			"Depois é só voltar aqui e me enviar: *CONECTAR <seu-codigo>*\n\n" +
			"_(O código gerado expira após o uso. Se você ainda não tem uma conta, cadastre-se no site!)_ 🌱"

		sendFeedback(wpClient, ttsClient, from, unlinkedMsg, respondWithAudio)
		return ProcessResult{Success: false, Reason: "profile_not_found"}
	}
	pmoID := profile.PmoAtivoID
	log.Printf("✅ [FSM] Usuário %s (%s) associado ao PMO ID %d", profile.Nome, phone, pmoID)

	// Step 3: Zero-IA Command Interceptor
	upperBody := strings.ToUpper(strings.TrimSpace(body))
	if upperBody == "/SALDO" {
		usados, limite, errSaldo := sbClient.CheckSaldo(profile.ID)
		if errSaldo != nil {
			log.Printf("❌ [FSM] Erro crasso ao consultar Saldo: %v", errSaldo)
			sendFeedback(wpClient, ttsClient, from, "❌ Não consegui acessar seu saldo no momento.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "saldo_error"}
		}

		// If limit is very high, assume unlimited.
		if limite >= 99999 {
			sendFeedback(wpClient, ttsClient, from, fmt.Sprintf("🪙 Você usou %d créditos diários até agora. Seu plano é Ilimitado.", usados), respondWithAudio)
		} else {
			restantes := limite - usados
			if restantes < 0 {
				restantes = 0
			}
			sendFeedback(wpClient, ttsClient, from, fmt.Sprintf("🪙 Você tem %d créditos restantes hoje. (Usados: %d/%d)", restantes, usados, limite), respondWithAudio)
		}
		return ProcessResult{Success: true, Reason: "saldo_checked"}
	}

	if strings.HasPrefix(upperBody, "CONECTAR ") {
		code := strings.TrimSpace(body[9:])
		errLink := sbClient.LinkDeviceToWeb(phone, code)
		if errLink != nil {
			wpClient.SendMessage(from, fmt.Sprintf("❌ Erro ao vincular aparelho: %v\n\nVerifique se o código está correto ou se já expirou no portal web.", errLink))
			return ProcessResult{Success: false, Reason: "link_device_failed"}
		}
		wpClient.SendMessage(from, "✅ Aparelho vinculado ao sistema com sucesso!")
		return ProcessResult{Success: true, Reason: "device_linked"}
	}

	// Step 4: Validate Quota before burning expensive IA Tokens
	authorized, _, errQuota := sbClient.CheckAndDeductQuota(profile.ID, pmoID, respondWithAudio)
	if errQuota != nil {
		log.Printf("⚠️ [FSM] Erro ao validar quota, permitindo best-effort: %v", errQuota)
	} else if !authorized {
		sendFeedback(wpClient, ttsClient, from, "🪙 Seus créditos esgotaram! Acesse o painel web para atualizar seu plano e continuar usando a Inteligência Artificial.", false) // Force Text
		return ProcessResult{Success: false, Reason: "quota_exceeded"}
	}

	// Step 5: Call Groq LLM for entity extraction
	extracted, err := groqClient.Extract(body)
	if err != nil {
		log.Printf("❌ [FSM] Falha na extração NER: %v", err)
		if err := sendFeedback(wpClient, ttsClient, from, "⚠️ Ocorreu um erro técnico ao processar sua mensagem. Tente novamente.", respondWithAudio); err != nil {
			log.Printf("❌ [FSM] Falha ao enviar mensagem de erro LLM via WPP: %v", err)
		}
		return ProcessResult{Success: false, Reason: "llm_error"}
	}

	// Fallback 🚨: Se o Groq falhar em retornar o schema raiz mas retornar insumos (ou nada)
	if extracted.Intencao == "" {
		log.Printf("⚠️ [FSM-FALLBACK] Groq retornou intenção vazia (Possível quebra de schema raiz). Forçando 'duvida'.")
		extracted.Intencao = "duvida"
	}

	// Log immediate Groq Llama extraction consumption
	log.Printf("📊 [Telemetry] Gravando consumo Groq Llama para usuário %s", profile.ID)
	_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
		UserID:           profile.ID,
		TokensPrompt:     extracted.TokensPrompt,
		TokensCompletion: extracted.TokensCompletion,
		TotalTokens:      extracted.TokensPrompt + extracted.TokensCompletion,
		ModeloIA:         "groq-llama-3.3-70b",
		Acao:             extracted.Intencao,
		Status:           "success",
	})

	promptTokens = extracted.TokensPrompt
	completionTokens = extracted.TokensCompletion
	finalIntent = extracted.Intencao

	// Step 5b: CHOKE POINT — Barreira universal para registros (Fast-Track Prevention).
	// Se a IA sinalizou que faltam dados (NecessitaMaisInfo) OU se a intenção for registro e a quantidade for zero.
	qtdFloat := parseToFloat(extracted.Quantidade)
	if extracted.Intencao == "registro" {
		log.Printf("🛡️ [FSM-CHOKE] Avaliando registro: Atividade=%s, Qtd=%v (float: %v), NeedsInfo=%v", extracted.Atividade, extracted.Quantidade, qtdFloat, extracted.NecessitaMaisInfo)

		if extracted.NecessitaMaisInfo || qtdFloat <= 0 {
			log.Printf("🛑 [FSM] Choke Point disparado! Bloqueando registro sem quantidade. Salvando estado...")
			botResponse = "Recebi seu pedido, mas para o cadastro oficial no caderno eletrônico, por favor me diga: Qual foi a quantidade exata (ex: 50 mudas, 2 kg)?"
			if extracted.PerguntaAoUsuario != "" {
				botResponse = fmt.Sprintf("🌱 %s", extracted.PerguntaAoUsuario)
			}
			
			// SALVAR ESTADO: Guardando o que já extraímos
			if historyManager != nil {
				ctxMap := toMap(extracted)
				historyManager.SetFSMState(phone, StateAguardandoQuantidade, ctxMap)
			}
			
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, "guardrail_choke", nil, startTime, false)
			return ProcessResult{Success: false, Reason: "missing_quantity_choke"}
		}

		if extracted.Atividade == "Compra/Aquisição" {
			// Se já temos o fornecedor e a quantidade, podemos tentar o fast-track (Gravação Direta)
			// Caso contrário, usamos o Choke Point para entrevista ativa.
			if extracted.Fornecedor == "" || extracted.Fornecedor == "NÃO INFORMADO" {
				log.Printf("🛑 [FSM] Choke Point disparado! Redirecionando Compra para entrevista ativa. Salvando estado...")
				botResponse = "Entendi que você fez uma compra! Para o registro oficial, de quem você comprou (fornecedor) e o material é orgânico?"
				
				if historyManager != nil {
					ctxMap := toMap(extracted)
					historyManager.SetFSMState(phone, StateAguardandoCompra, ctxMap)
				}
				
				sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
				recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, "compra_needs_info_choke", nil, startTime, false)
				return ProcessResult{Success: false, Reason: "compra_needs_info_choke"}
			}
			log.Printf("⚡ [FSM] Compra com info completa detectada. Seguindo para gravação direta.")
		}
	}

	// Filter out non-actionable intents
	if extracted.Intencao == "ignorar" || extracted.Intencao == "saudacao" {
		log.Printf("⏭️ [FSM] Intenção '%s'.", extracted.Intencao)
		if extracted.Intencao == "saudacao" {
			botResponse = "Olá! Sou seu assistente de Caderno de Campo Orgânico 🌱.\nDiga o que você plantou, aplicou hoje, ou qual é sua dúvida sobre orgânicos."
			if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
				log.Printf("❌ [FSM] Falha ao enviar saudação via WPP: %v", err)
			}
		} else if extracted.Intencao == "ignorar" {
			// UX Improvement: No more silence when the model doesn't understand or loses context
			botResponse = "Desculpe, como o meu sistema acabou de ser atualizado, acabei perdendo o histórico da nossa conversa. Pode repetir a sua dúvida completa?"
			if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
				log.Printf("❌ [FSM] Falha ao enviar resposta de 'ignorar' via WPP: %v", err)
			}
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, true)
		return ProcessResult{Success: true, Reason: "ignored_intent"}
	}

	// Phase 4: Hierarchical Multi-Agent Integration
	if extracted.Intencao == "duvida" || extracted.Intencao == "configurar_infraestrutura" {
		log.Printf("🧠 [FSM] Modo multi-agente ativado para: %s", extracted.Intencao)

		// 1. Classificação de Intenção (Orquestrador)
		result, err := gemClient.ClassifyIntent(ctx, body)
		if err != nil {
			log.Printf("⚠️ [FSM] Erro na classificação de intenção, usando fallback RAG: %v", err)
			result = gemini.RouterResult{Intent: gemini.IntentRAG}
		}

		// 2. Seleção de Especialista e Ferramentas
		specialistPrompt := gemini.GetPromptForIntent(result.Intent)
		tools := mcpServer.GetToolsForIntent(result.Intent)
		log.Printf("🤖 [ORCHESTRATOR] Roteado para especialista %v (%d ferramentas)", result.Intent, len(tools))

		// Prepare History for Gemini
		var geminiHistory []*genai.Content
		if historyManager != nil {
			rawHistory := historyManager.GetHistory(from)
			for _, h := range rawHistory {
				geminiHistory = append(geminiHistory, &genai.Content{
					Role:  h.Role,
					Parts: []genai.Part{genai.Text(h.Content)},
				})
			}
		}

		// Sub-timeout for the Gemini tool loop (90s)
		toolCtx, toolCancel := context.WithTimeout(ctx, 90*time.Second)
		defer toolCancel()

		// 3. Chamada Inicial ao Especialista
		resp, session, err := gemClient.GenerateContentWithTools(toolCtx, body, geminiHistory, tools, specialistPrompt)
		if err != nil {
			log.Printf("❌ [FSM] Erro no Especialista Gemini: %v", err)
			return handleDuvidaFallback(wpClient, ttsClient, from, gemClient, body, respondWithAudio, sbClient, profile, startTime, promptTokens, completionTokens, finalIntent)
		}

		// Log Gemini usage
		if resp != nil && resp.UsageMetadata != nil {
			log.Printf("📊 [Telemetry] Consumo Gemini (Turn 1) - Prompt: %d, Completion: %d", resp.UsageMetadata.PromptTokenCount, resp.UsageMetadata.CandidatesTokenCount)
			_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
				UserID:           profile.ID,
				TokensPrompt:     int(resp.UsageMetadata.PromptTokenCount),
				TokensCompletion: int(resp.UsageMetadata.CandidatesTokenCount),
				TotalTokens:      int(resp.UsageMetadata.TotalTokenCount),
				ModeloIA:         gemClient.Config.Model,
				Acao:             string(result.Intent),
				Status:           "success",
			})
		}

		// 4. Loop de Ferramentas com Middlewares (LoopGuard)
		lg := mcp.NewLoopGuard(2) // Máximo 2 repetições dos mesmos argumentos
		for i := 0; i < 5; i++ {
			if resp == nil || len(resp.Candidates) == 0 {
				log.Printf("⚠️ [FSM] Gemini respondeu vazio no turno %d", i+1)
				break
			}

			candidate := resp.Candidates[0]
			var toolCalls []*genai.FunctionCall
			for _, part := range candidate.Content.Parts {
				if fnCall, ok := part.(genai.FunctionCall); ok {
					toolCalls = append(toolCalls, &fnCall)
				}
			}

			if len(toolCalls) == 0 {
				// Resposta final em texto
				var textResp strings.Builder
				for _, part := range candidate.Content.Parts {
					if t, ok := part.(genai.Text); ok {
						textResp.WriteString(string(t))
					}
				}
				
				prefix := "📚 *Consultor Orgânico:* "
				if result.Intent == gemini.IntentDatabase {
					prefix = "🏗️ *Operador de Dados:* "
				}
				botResponse = prefix + textResp.String()
				
				if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
					log.Printf("❌ [FSM] Falha ao enviar resposta multi-agente via WPP: %v", err)
					return ProcessResult{Success: false, Reason: "send_feedback_error"}
				}

				if historyManager != nil {
					historyManager.AddMessage(from, "user", body)
					historyManager.AddMessage(from, "model", textResp.String())
				}

				recordLog(sbClient, profile, body, botResponse, gemClient.Config.Model+"-multi-agent", promptTokens, completionTokens, finalIntent, nil, startTime, true)
				return ProcessResult{Success: true, Reason: "multi_agent_answered"}
			}

			// Execução de Ferramentas
			var toolParts []genai.Part
			for _, tc := range toolCalls {
				log.Printf("🛠️ [FSM] Especialista solicitou tool: %s", tc.Name)

				// Injeção de Segurança
				tc.Args["pmo_id"] = float64(pmoID)
				tc.Args["user_id"] = profile.ID

				result, err := mcpServer.CallToolWithGuard(lg, tc.Name, tc.Args)
				if err != nil {
					log.Printf("⚠️ [FSM] LoopGuard ou Erro na Tool %s: %v", tc.Name, err)
					result = fmt.Sprintf("Erro/Bloqueio: %v", err)
				}

				// Curto-Prazo (System Note)
				if err == nil && historyManager != nil {
					historyManager.InjectSystemNote(from, fmt.Sprintf("Tool %s executada com sucesso.", tc.Name))
				}

				toolParts = append(toolParts, genai.FunctionResponse{
					Name:     tc.Name,
					Response: map[string]interface{}{"result": result},
				})
			}

			resp, err = session.SendMessage(toolCtx, toolParts...)
			if err != nil {
				log.Printf("❌ [FSM] Erro no loop de ferramentas: %v", err)
				break
			}
		}

		return handleDuvidaFallback(wpClient, ttsClient, from, gemClient, body, respondWithAudio, sbClient, profile, startTime, promptTokens, completionTokens, finalIntent)
	}

	// Step 6: Strict Input Validation for Manejo Activities
	if extracted.Intencao == "registro" && extracted.InsumoGenerico {
		insumoName := extracted.InsumoAplicado
		if insumoName == "" {
			insumoName = "insumo genérico"
		}
		log.Printf("⚠️ [FSM] Insumo genérico detectado (%s). Solicitando especificação.", insumoName)
		finalIntent = "pedido_especificidade"

		botResponse = fmt.Sprintf("Recebido! Mas para garantir a rastreabilidade, poderia especificar que tipo de *%s* você utilizou? (Ex: Esterco, Bokashi, Biofertilizante caseiro?)", insumoName)
		if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
			log.Printf("❌ [FSM] Falha ao enviar pedido de especificação via WPP: %v", err)
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, false)
		return ProcessResult{Success: false, Reason: "generic_input_blocked"}
	}

	// Step 7: Compliance Check (Ajustado para ser Orientador)
	if extracted.AlertaOrganico {
		produtoAlvo := extracted.InsumoAplicado
		if produtoAlvo == "" {
			produtoAlvo = extracted.InsumoCultura
		}

		// Blacklist Crítica: Se for um desses, bloqueamos o registro.
		blacklistCritica := []string{"GLIFOSATO", "UREIA", "UREIA", "NPK", "SULFATODEAMONIO", "2,4-D", "HERBICIDA", "VENENO"}
		isProibidoEscancarado := false
		produtoUpper := strings.ToUpper(strings.ReplaceAll(produtoAlvo, " ", ""))
		for _, b := range blacklistCritica {
			if strings.Contains(produtoUpper, b) {
				isProibidoEscancarado = true
				break
			}
		}

		if isProibidoEscancarado {
			log.Printf("🚨 [FSM] BLOQUEIO CRÍTICO ATIVADO! Produto: %s. Operação abortada.", produtoAlvo)
			finalIntent = "alerta_conformidade"
			botResponse = fmt.Sprintf("🚨 *ALERTA DE NÃO-CONFORMIDADE!*\n\n⚠️ O uso de *%s* parece desrespeitar as normas orgânicas (Lei 10.831 e IN 46).\n\nO registro no caderno de campo foi **BLOQUEADO**. Por favor, consulte o seu inspetor.", produtoAlvo)
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, false)
			return ProcessResult{Success: false, Reason: "organic_compliance_block"}
		}

		// Se chegou aqui, é um "alerta suave" ou dúvida (ex: Termofosfato Master)
		log.Printf("⚠️ [FSM] Alerta orgânico suave detectado para %s. Permitindo registro com aviso.", produtoAlvo)
		// Marcamos para adicionar o aviso na resposta final, mas deixamos seguir para o Step 8.
		extracted.AlertaOrganico = false // Resetamos para o Step 8 prosseguir, mas mantemos o contexto de que houve alerta
		msgAvisoPrecaucao := "\n\n⚠️ *Nota de Precaução:* Como este produto pode ter restrições de uso, lembre-se de confirmar se este lote específico é aprovado pela sua certificadora."
		
		// Injetamos o aviso nos detalhes para que possa ser usado depois se necessário, 
		// ou simplesmente concatenamos na resposta final no Step 8.
		extracted.PerguntaAoUsuario = msgAvisoPrecaucao 
	}

	// Step 8: Save to Caderno de Campo via RPC
	if extracted.Intencao == "registro" {
		atividade := extracted.Atividade
		if extracted.Data == "" {
			extracted.Data = time.Now().Format("2006-01-02")
		}
		var resp map[string]interface{}
		var err error

		if atividade == "Compra/Aquisição" {
			log.Printf("🛒 [FSM] Usando RPC de Compra para: %s", extracted.InsumoCultura)
			rpcArgs := map[string]interface{}{
				"pmo_id_arg":             pmoID,
				"user_id_arg":            profile.ID,
				"produto_arg":            extracted.InsumoCultura,
				"quantidade_valor_arg":   parseToFloat(extracted.Quantidade),
				"quantidade_unidade_arg": extracted.Unidade,
				"fornecedor_arg":         extracted.Fornecedor,
				"nota_fiscal_arg":        extracted.NotaFiscal,
				"marca_arg":              extracted.Marca,
				"data_compra_arg":        time.Now().Format("2006-01-02"),
			}
			resp, err = sbClient.RegistrarCompraInsumoRPC(ctx, rpcArgs)
		} else {
			log.Printf("🚜 [FSM] Usando RPC Unificada (Operacao de Campo) para: %s", atividade)
			
			// Build a rich, unified payload
			payload := map[string]interface{}{
				"data":                extracted.Data,
				"produto":             extracted.InsumoCultura, // Alias for 'especies', etc.
				"quantidade_valor":    parseToFloat(extracted.Quantidade),
				"quantidade_unidade":  extracted.Unidade,
				"talhao_nome":         extracted.Localizacao.Talhao,
				"canteiro_ids":        extracted.Localizacao.Canteiros,
				"fornecedor":          extracted.Fornecedor,
				"nota_fiscal":         extracted.NotaFiscal,
				"insumo":              extracted.InsumoAplicado,
				"metodo_aplicacao":    atividade,
				"observacao_original": body,
				// Specialized fields for backward compatibility with SQL CASE logic
				"item_area":         extracted.Localizacao.Talhao,
				"tipo_limpeza":      "Geral",
				"produto_utilizado": extracted.InsumoAplicado,
				"especies":          extracted.InsumoCultura,
				"origem":            extracted.Fornecedor,
				"quantidade":        fmt.Sprintf("%v %s", extracted.Quantidade, extracted.Unidade),
				"sistema_organico":  true,
				"insumo_aplicado":   extracted.InsumoAplicado, // used by Manejo
				"fonte":             extracted.Fornecedor,    // used by Manejo
				"talhoes_aplicados": []string{extracted.Localizacao.Talhao},
			}

			resp, err = sbClient.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
				"pmo_id_arg":  pmoID,
				"user_id_arg": profile.ID,
				"tipo_arg":    atividade,
				"payload_arg": payload,
				"lote_arg":    extracted.Lote,
				"cliente_arg": extracted.Cliente,
				"valor_arg":   extracted.ValorTotal,
			})
		}

		if err != nil {
			log.Printf("❌ [FSM] Falha ao chamar RPC de Registro: %v", err)
			botResponse = "❌ Falha técnica ao salvar no banco. Controle o sistema."
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, false)
			return ProcessResult{Success: false, Reason: "rpc_error"}
		}

		if status, ok := resp["status"].(string); ok && status == "error" {
			log.Printf("❌ [FSM] Erro retornado pela RPC: %v", resp["message"])
			botResponse = fmt.Sprintf("⚠️ Erro no registro: %v", resp["message"])
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			return ProcessResult{Success: false, Reason: "rpc_db_error"}
		}

		// Compatibilidade entre RPCs (id vs compra_id)
		id := resp["id"]
		if id == nil {
			id = resp["compra_id"]
		}
		lote, _ := resp["lote"].(string)

		log.Printf("💾 [FSM] Registro salvo com sucesso! ID: %v, Lote: %s", id, lote)

		// Send Confirmation Message
		localOuFornecedorLabel := "Local"
		localOuFornecedorValue := fmtLocalizacao(extracted.Localizacao)

		if extracted.Atividade == "Compra/Aquisição" {
			localOuFornecedorLabel = "Fornecedor"
			localOuFornecedorValue = extracted.Fornecedor
			if localOuFornecedorValue == "" {
				localOuFornecedorValue = "NÃO INFORMADO"
			}
		}

		botResponse = fmt.Sprintf("✅ *Registro Salvo com Sucesso!*\n\n*Atividade:* %s\n", extracted.Atividade)

		if extracted.Atividade == "Manejo" && extracted.InsumoAplicado != "" {
			itemCultura := extracted.InsumoCultura
			if itemCultura == "" || itemCultura == "N/A" || itemCultura == "todas" {
				itemCultura = ""
			} else {
				itemCultura = fmt.Sprintf("*Cultura:* %s\n", itemCultura)
			}
			botResponse += fmt.Sprintf("%s*Insumo:* %s\n", itemCultura, extracted.InsumoAplicado)
		} else {
			botResponse += fmt.Sprintf("*Item:* %s\n", extracted.InsumoCultura)
		}

		botResponse += fmt.Sprintf("*Qtd:* %v %s\n*%s:* %s", extracted.Quantidade, extracted.Unidade, localOuFornecedorLabel, strings.ToUpper(localOuFornecedorValue))

		if extracted.NotaFiscal != "" {
			botResponse += fmt.Sprintf("\n*Nota Fiscal:* %s", extracted.NotaFiscal)
		}
		botResponse += "\n\n"

		if lote != "" {
			botResponse += fmt.Sprintf("*Lote:* %s\n", lote)
		}
		
		if len(extracted.Localizacao.Canteiros) > 0 {
			botResponse += fmt.Sprintf("_Vinculado a %d canteiro(s)._\n", len(extracted.Localizacao.Canteiros))
		}
		botResponse += "_Seu caderno eletrônico está em dia._ 🌱"

		// Se houver um aviso de precaução vindo do Step 7, anexamos aqui.
		if extracted.PerguntaAoUsuario != "" && strings.Contains(extracted.PerguntaAoUsuario, "Nota de Precaução") {
			botResponse += extracted.PerguntaAoUsuario
		}

		if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
			log.Printf("❌ [FSM] Falha ao enviar confirmação de registro: %v", err)
		}

		// Success Logging
		extraidoMap := toMap(extracted)
		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, extraidoMap, startTime, true)
		return ProcessResult{Success: true, Reason: "record_saved"}
	}

	// Step 8b: Save to Limpeza (SEBRAE Form 04)
	if extracted.Intencao == "limpeza" {
		log.Printf("🧽 [FSM] Processando intenção de LIMPEZA: Item=%s, Responsável=%s", extracted.ItemArea, extracted.Responsavel)

		// Choke Point: Se não informou o item limpo
		if extracted.ItemArea == "" || extracted.ItemArea == "NÃO INFORMADO" || extracted.ItemArea == "Não Informado" {
			botResponse = "O que você limpou e como foi a limpeza? 🧽 (Ex: Lavei o trator, varri o galpão)"
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, "limpeza_needs_info", nil, startTime, false)
			return ProcessResult{Success: false, Reason: "limpeza_missing_item_choke"}
		}

		payload := map[string]interface{}{
			"item_area":         extracted.ItemArea,
			"tipo_limpeza":      extracted.TipoLimpeza,
			"produto_utilizado": extracted.ProdutoUtilizado,
			"dosagem":           extracted.Dosagem,
			"responsavel":       extracted.Responsavel,
			"observacao":        body,
			"data":              time.Now().Format("2006-01-02"),
		}

		if payload["responsavel"] == "" {
			payload["responsavel"] = "Produtor"
		}

		res, err := sbClient.RegistrarOperacaoCampoRPC(context.Background(), map[string]interface{}{
			"pmo_id_arg":   pmoID,
			"user_id_arg":  profile.ID,
			"tipo_arg":     "Limpeza",
			"payload_arg":  payload,
		})

		if err != nil {
			log.Printf("❌ [FSM] Falha ao salvar no Controle de Limpeza via RPC: %v", err)
			botResponse = "❌ Falha técnica ao salvar sua limpeza. Tente novamente."
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			return ProcessResult{Success: false, Reason: "db_limpeza_error"}
		}

		if status, ok := res["status"].(string); ok && status == "error" {
			log.Printf("❌ [FSM] Erro retornado pela RPC de Limpeza: %v", res["message"])
			botResponse = fmt.Sprintf("⚠️ Erro no registro: %v", res["message"])
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			return ProcessResult{Success: false, Reason: "rpc_limpeza_db_error"}
		}

		botResponse = fmt.Sprintf("✅ *Registro de Limpeza Salvo com Sucesso!*\n\n*Item:* %s\n*Tipo:* %s\n*Responsável:* %s\n\n_Conforme Formulário 04 SEBRAE._ 🧽",
			extracted.ItemArea, extracted.TipoLimpeza, payload["responsavel"])
		
		sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
		
		extraidoMap := toMap(extracted)
		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, "limpeza", extraidoMap, startTime, true)
		return ProcessResult{Success: true, Reason: "limpeza_saved"}
	}

	recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, true)
	return ProcessResult{Success: true, Reason: "unhandled_intent"}
}

// recordLog is a helper to consistently log the bot's processing outcome to Audit and Training tables.
// NOTE: Financial consumption (LogConsumo) is now handled incrementally at the call site for Groq/Whisper/Gemini.
func recordLog(sbClient *supabase.Client, profile *supabase.Profile, userMsg, botResp, model string, promptTokens, completionTokens int, intent string, extracted map[string]interface{}, startTime time.Time, isSuccess bool) {
	// 1. Audit Log (requested/approved in Phase 2/3)
	if err := sbClient.InsertLogProcessamento(supabase.LogProcessamentoInsert{
		PmoID:            profile.PmoAtivoID,
		MensagemUsuario:  userMsg,
		RespostaBot:      botResp,
		ModeloIA:         model,
		TokensPrompt:     promptTokens,
		TokensCompletion: completionTokens,
		Intencao:         intent,
	}); err != nil {
		log.Printf("❌ [FSM] Erro ao gravar LogProcessamento: %v", err)
	}

	// 2. Training Log (Dashboard visibility)
	if err := sbClient.InsertLogTreinamento(supabase.LogTreinamentoInsert{
		PmoID:         profile.PmoAtivoID,
		UserID:        profile.ID,
		TextoUsuario:  userMsg,
		JsonExtraido:  extracted,
		TipoAtividade: intent,
		ModeloIA:      model,
	}); err != nil {
		log.Printf("❌ [FSM] Erro ao gravar LogTreinamento: %v", err)
	}
}

// fmtLocalizacao is a quick helper to combine talhao and canteiros
func fmtLocalizacao(loc groq.Localizacao) string {
	if loc.Talhao == "" || loc.Talhao == "NÃO INFORMADO" {
		return "NÃO INFORMADO"
	}
	if len(loc.Canteiros) > 0 {
		var formattedCanteiros []string
		for _, c := range loc.Canteiros {
			trimmed := strings.TrimSpace(c)
			if !strings.HasPrefix(strings.ToLower(trimmed), "canteiro") {
				formattedCanteiros = append(formattedCanteiros, "Canteiro "+trimmed)
			} else {
				formattedCanteiros = append(formattedCanteiros, trimmed)
			}
		}
		return loc.Talhao + "; " + strings.Join(formattedCanteiros, "; ")
	}
	return loc.Talhao
}

// sendFeedback applies hybrid outbound flow routing. Text stays Text. Audio goes to TTS then Voice message.
func sendFeedback(wpClient *whatsapp.Client, ttsClient *tts.Orchestrator, to string, text string, respondAudio bool) error {
	if !respondAudio {
		return wpClient.SendMessage(to, text)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	b64, err := ttsClient.GenerateSpeech(ctx, text)
	if err != nil {
		log.Printf("⚠️ [FSM] TTS desativado ou falhou, usando Card de Transcrição: %v", err)
		return wpClient.SendMessage(to, whatsapp.RenderVoiceText(text))
	}

	log.Printf("🔊 [FSM] Enviando Voice Note nativo...")
	err = wpClient.SendVoice(to, b64, true)
	if err != nil {
		log.Printf("❌ [FSM-FALLBACK] WPPConnect falhou ao enviar Áudio: %v. Usando Card de Transcrição.", err)
		return wpClient.SendMessage(to, whatsapp.RenderVoiceText(text))
	}

	return nil
}

// handleDuvidaFallback is a helper for cases where RAG fails but we still want to try answering
func handleDuvidaFallback(wpClient *whatsapp.Client, ttsClient *tts.Orchestrator, from string, gemClient *gemini.Client, body string, respondAudio bool, sbClient *supabase.Client, profile *supabase.Profile, startTime time.Time, pTokens, cTokens int, intent string) ProcessResult {
	aiModel := gemClient.Config.Model + "-fallback"
	answer, err := gemClient.AskExpert(body)
	if err != nil {
		botResponse := "⚠️ Tive um problema ao consultar as normas. Tente de novo."
		sendFeedback(wpClient, ttsClient, from, botResponse, respondAudio)
		return ProcessResult{Success: false, Reason: "expert_error"}
	}

	var botResponse string
	if intent == "configurar_infraestrutura" {
		botResponse = fmt.Sprintf("🏗️ *Engenharia da Fazenda (Base):*\n\n%s", answer)
	} else {
		botResponse = fmt.Sprintf("📚 *Consultor Orgânico RESPONDE (Base):*\n\n%s", answer)
	}
	sendFeedback(wpClient, ttsClient, from, botResponse, respondAudio)

	// Log consumption for AskExpert fallback
	_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
		UserID:   profile.ID,
		ModeloIA: aiModel,
		Acao:     intent,
		Status:   "success",
	})

	recordLog(sbClient, profile, body, botResponse, aiModel, pTokens, cTokens, intent, nil, startTime, true)
	return ProcessResult{Success: true, Reason: "expert_answered_fallback"}
}

// handleActiveState routes the message to the correct handler based on the FSM state
func handleActiveState(state string, ctx map[string]interface{}, body, from, phone string, profile *supabase.Profile, respondAudio bool, sbClient *supabase.Client, wpClient *whatsapp.Client, ttsClient *tts.Orchestrator, historyManager *history.Manager, startTime time.Time) ProcessResult {
	switch state {
	case StateAguardandoQuantidade:
		return handleAguardandoQuantidade(ctx, body, from, phone, profile, respondAudio, sbClient, wpClient, ttsClient, historyManager, startTime)
	case StateAguardandoCompra:
		return handleAguardandoCompra(ctx, body, from, phone, profile, respondAudio, sbClient, wpClient, ttsClient, historyManager, startTime)
	default:
		historyManager.ClearFSMState(phone)
		return ProcessResult{Success: false, Reason: "unknown_state_cleared"}
	}
}

func handleAguardandoQuantidade(ctx map[string]interface{}, body, from, phone string, profile *supabase.Profile, respondAudio bool, sbClient *supabase.Client, wpClient *whatsapp.Client, ttsClient *tts.Orchestrator, historyManager *history.Manager, startTime time.Time) ProcessResult {
	// 1. Extrair quantidade do body (Regex ou ParseFloat direto)
	qtd := parseToFloat(body)
	if qtd <= 0 {
		botResponse := "Ainda não consegui entender a quantidade. Por favor, diga apenas o número e a unidade (ex: 120 kg)."
		sendFeedback(wpClient, ttsClient, from, botResponse, respondAudio)
		return ProcessResult{Success: false, Reason: "still_missing_quantity"}
	}

	log.Printf("📥 [FSM] Quantidade recebida no estado: %v", qtd)

	// 2. Restaurar o ExtractionResult do contexto
	// Como ctx é map[string]interface{}, vamos remontar o objeto ou usar os campos diretamente
	intencao, _ := ctx["intencao"].(string)

	if intencao == "registro" {
		pmoID := profile.PmoAtivoID
		atividade, _ := ctx["atividade"].(string)
		insumo, _ := ctx["insumo_cultura"].(string)
		unidade, _ := ctx["unidade"].(string)
		localRaw, _ := ctx["localizacao"].(map[string]interface{})
		
		talhao, _ := localRaw["talhao"].(string)
		var canteiros []string
		if cants, ok := localRaw["canteiros"].([]interface{}); ok {
			for _, c := range cants {
				if s, ok := c.(string); ok {
					canteiros = append(canteiros, s)
				}
			}
		}

		rpcArgs := map[string]interface{}{
			"pmo_id_arg":             pmoID,
			"user_id_arg":            profile.ID,
			"atividade_arg":          atividade,
			"data_arg":               time.Now().Format("2006-01-02"),
			"produto_arg":            insumo,
			"quantidade_valor_arg":   qtd,
			"quantidade_unidade_arg": unidade,
			"talhao_nome_arg":        talhao,
			"canteiros_arg":          canteiros,
			"detalhes_arg": map[string]interface{}{
				"observacao_original": "Contexto restaurado + Resposta: " + body,
				"secao_origem":        "wppconnect_fsm_recovery",
			},
		}

		resp, err := sbClient.RegistrarAtividadeRPC(context.Background(), rpcArgs)
		if err != nil {
			log.Printf("❌ [FSM] Erro ao salvar registro recuperado via RPC: %v", err)
			sendFeedback(wpClient, ttsClient, from, "❌ Erro ao salvar o registro. Tente novamente.", respondAudio)
			return ProcessResult{Success: false, Reason: "rpc_error_recovery"}
		}

		if status, ok := resp["status"].(string); ok && status == "error" {
			log.Printf("❌ [FSM] Erro RPC no recovery: %v", resp["message"])
			sendFeedback(wpClient, ttsClient, from, fmt.Sprintf("⚠️ Erro no registro: %v", resp["message"]), respondAudio)
			return ProcessResult{Success: false, Reason: "rpc_db_error_recovery"}
		}

		_ = resp["id"]
		lote, _ := resp["lote"].(string)

		localOuFornecedorLabel := "Local"
		localOuFornecedorValue := fmtLocalizacao(groq.Localizacao{Talhao: talhao, Canteiros: canteiros})

		if atividade == "Compra/Aquisição" {
			localOuFornecedorLabel = "Fornecedor"
			f, _ := ctx["fornecedor"].(string)
			if f == "" {
				f = "NÃO INFORMADO"
			}
			localOuFornecedorValue = f
		}

		botResponse := fmt.Sprintf("✅ *Registro Completo e Salvo!*\n\n*Atividade:* %s\n*Item:* %s\n*Qtd:* %v %s\n*%s:* %s\n\n",
			atividade, insumo, qtd, unidade, localOuFornecedorLabel, strings.ToUpper(localOuFornecedorValue))
		
		if lote != "" {
			botResponse += fmt.Sprintf("*Lote:* %s\n", lote)
		}
		botResponse += "_Contexto recuperado com sucesso._ 🌱"

		sendFeedback(wpClient, ttsClient, from, botResponse, respondAudio)

		historyManager.ClearFSMState(phone)
		recordLog(sbClient, profile, body, botResponse, "fsm-recovery", 0, 0, "registro", ctx, startTime, true)
		return ProcessResult{Success: true, Reason: "record_saved_recovery"}
	}

	return ProcessResult{Success: false, Reason: "unhandled_recovery_logic"}
}

func handleAguardandoCompra(ctx map[string]interface{}, body, from, phone string, profile *supabase.Profile, respondAudio bool, sbClient *supabase.Client, wpClient *whatsapp.Client, ttsClient *tts.Orchestrator, historyManager *history.Manager, startTime time.Time) ProcessResult {
	log.Printf("📥 [FSM] Dados de compra (fornecedor) recebidos: %s", body)
	
	pmoID := profile.PmoAtivoID
	insumo, _ := ctx["insumo_cultura"].(string)
	qtdRaw := ctx["quantidade"]
	qtd := parseToFloat(qtdRaw)
	unidade, _ := ctx["unidade"].(string)

	// Normalização de Unidade: mudas -> unid
	if strings.ToLower(unidade) == "mudas" || strings.ToLower(unidade) == "muda" {
		unidade = "unid"
	}

	// O body desta mensagem é o Fornecedor (e possivelmente outras infos)
	fornecedor := body

	rpcArgs := map[string]interface{}{
		"pmo_id_arg":             pmoID,
		"user_id_arg":            profile.ID,
		"atividade_arg":          "Insumo",
		"data_arg":               time.Now().Format("2006-01-02"),
		"produto_arg":            insumo,
		"quantidade_valor_arg":   qtd,
		"quantidade_unidade_arg": unidade,
		"fornecedor_arg":         fornecedor,
		"detalhes_arg": map[string]interface{}{
			"observacao_original": "Compra registrada via atendimento ativo. Fornecedor: " + body,
			"secao_origem":        "wppconnect_fsm_recovery_compra",
		},
	}

	resp, err := sbClient.RegistrarAtividadeRPC(context.Background(), rpcArgs)
	if err != nil {
		log.Printf("❌ [FSM] Erro ao salvar compra recuperada via RPC: %v", err)
		sendFeedback(wpClient, ttsClient, from, "❌ Erro ao salvar a compra. Tente novamente.", respondAudio)
		return ProcessResult{Success: false, Reason: "rpc_error_compra_recovery"}
	}

	if status, ok := resp["status"].(string); ok && status == "error" {
		log.Printf("❌ [FSM] Erro RPC na compra: %v", resp["message"])
		sendFeedback(wpClient, ttsClient, from, fmt.Sprintf("⚠️ Erro no registro: %v", resp["message"]), respondAudio)
		return ProcessResult{Success: false, Reason: "rpc_db_error_compra_recovery"}
	}

	id := resp["id"]
	log.Printf("💾 [FSM] Compra salva com sucesso! (ID: %s)", id)

	botResponse := fmt.Sprintf("✅ *Compra de %s Gravada!*\n\n*Qtd:* %v %s\n*Fornecedor:* %s\n\n_Registro adicionado ao seu caderno._ 🌱",
		insumo, qtd, unidade, fornecedor)
	sendFeedback(wpClient, ttsClient, from, botResponse, respondAudio)

	historyManager.ClearFSMState(phone)
	recordLog(sbClient, profile, body, botResponse, "fsm-recovery-compra", 0, 0, "registro", ctx, startTime, true)
	return ProcessResult{Success: true, Reason: "compra_saved_recovery"}
}

// toMap conversion helper using JSON
func toMap(obj interface{}) map[string]interface{} {
	data, _ := json.Marshal(obj)
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	return m
}

func parseToFloat(val interface{}) float64 {
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case string:
		// Remover unidades se o LLM enviou junto
		v = strings.TrimSpace(v)
		v = strings.Split(v, " ")[0]
		f, _ := strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64)
		return f
	default:
		return 0
	}
}
