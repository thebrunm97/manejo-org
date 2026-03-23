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
func ProcessMessage(ctx context.Context, from string, body string, msgID string, isAudio bool, sbClient *supabase.Client, groqClient *groq.Client, wpClient *whatsapp.Client, gemClient *gemini.Client, ttsClient *tts.Orchestrator, mcpServer *mcp.Server, historyManager *history.Manager) ProcessResult {
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
	profile, errP := sbClient.GetProfileByPhone(phone)
	if errP != nil {
		log.Printf("🚫 [FSM] Perfil não encontrado ou sem PMO ativo para %s: %v", phone, errP)
	}

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

		sendFeedback(wpClient, ttsClient, from, "❌ Não consegui encontrar o seu cadastro no sistema PMO. Se você tem um código de pareamento, digite: CONECTAR <codigo>", respondWithAudio)
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

	// If intent is "duvida" or "configurar_infraestrutura", use Gemini with MCP Tool Calling
	if extracted.Intencao == "duvida" || extracted.Intencao == "configurar_infraestrutura" {
		log.Printf("🧠 [FSM] Intenção '%s' detectada. Iniciando Tool Calling para PMO %d...", extracted.Intencao, pmoID)

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

		// Fix: Sub-timeout for the Gemini tool loop (30s) derived from parent ctx
		toolCtx, toolCancel := context.WithTimeout(ctx, 30*time.Second)
		defer toolCancel()
		tools := mcpServer.GetToolDeclarations()

		resp, session, err := gemClient.GenerateContentWithTools(toolCtx, body, geminiHistory, tools)
		if err != nil {
			log.Printf("❌ [FSM] Erro inicial no Gemini Tool Calling: %v", err)
			return handleDuvidaFallback(wpClient, ttsClient, from, gemClient, body, respondWithAudio, sbClient, profile, startTime, promptTokens, completionTokens, finalIntent)
		}

		// Log Gemini usage for first turn
		if resp != nil && resp.UsageMetadata != nil {
			log.Printf("📊 [Telemetry] Gravando consumo Gemini (turn 1) para usuário %s", profile.ID)
			_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
				UserID:           profile.ID,
				TokensPrompt:     int(resp.UsageMetadata.PromptTokenCount),
				TokensCompletion: int(resp.UsageMetadata.CandidatesTokenCount),
				TotalTokens:      int(resp.UsageMetadata.TotalTokenCount),
				ModeloIA:         gemClient.Config.Model,
				Acao:             "duvida",
				Status:           "success",
			})
		}

		// Tool Loop (limited to 5 turns to avoid infinite loops)
		for i := 0; i < 5; i++ {
			if len(resp.Candidates) == 0 {
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
				// No more tools requested, we have a final text answer
				if extracted.Intencao == "configurar_infraestrutura" {
					// ABORT: Prevent JSON leakage or plain text advice for infrastructure
					botResponse = "⚠️ O meu sistema de engenharia está com instabilidade no momento e não consegui executar a obra. Por favor, aguarde alguns minutos e tente novamente."
					sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
					recordLog(sbClient, profile, body, botResponse, gemClient.Config.Model+"-mcp-aborted", promptTokens, completionTokens, finalIntent, nil, startTime, false)
					return ProcessResult{Success: false, Reason: "infrastructure_aborted_safety"}
				}

				var textResp strings.Builder
				for _, part := range candidate.Content.Parts {
					if t, ok := part.(genai.Text); ok {
						textResp.WriteString(string(t))
					}
				}
				if extracted.Intencao == "configurar_infraestrutura" {
					botResponse = fmt.Sprintf("🏗️ *Engenharia da Fazenda:*\n\n%s", textResp.String())
				} else {
					botResponse = fmt.Sprintf("📚 *Consultor Orgânico RESPONDE:*\n\n%s", textResp.String())
				}
				sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)

				// Save to History (User Query + Bot Answer)
				if historyManager != nil {
					historyManager.AddMessage(from, "user", body)
					historyManager.AddMessage(from, "model", textResp.String())
				}

				recordLog(sbClient, profile, body, botResponse, gemClient.Config.Model+"-mcp", promptTokens, completionTokens, finalIntent, nil, startTime, true)
				return ProcessResult{Success: true, Reason: "expert_answered_mcp"}
			}

			// Handle Tool Calls
			var toolResponses []genai.Part
			for _, tc := range toolCalls {
				log.Printf("🛠️ [FSM] Gemini solicitou tool: %s com args: %v", tc.Name, tc.Args)

				// Injeção de Segurança Mestra: Injetar pmo_id e user_id da sessão INCONDICIONALMENTE.
				// Secure by default — mesmo tools futuros estarão protegidos.
				tc.Args["pmo_id"] = float64(pmoID)
				tc.Args["user_id"] = profile.ID

				result, err := mcpServer.CallTool(tc.Name, tc.Args)
				if err != nil {
					log.Printf("⚠️ [FSM] Erro ao executar tool %s: %v", tc.Name, err)
					result = fmt.Sprintf("Erro ao executar ferramenta: %v", err)
				}

				toolResponses = append(toolResponses, genai.FunctionResponse{
					Name:     tc.Name,
					Response: map[string]interface{}{"result": result},
				})
			}

			// Send responses back to Gemini
			resp, err = session.SendMessage(toolCtx, toolResponses...)
			if err != nil {
				log.Printf("❌ [FSM] Erro ao enviar resultado da tool para o Gemini: %v", err)
				break
			}

			// Log Gemini usage for this turn
			if resp != nil && resp.UsageMetadata != nil {
				log.Printf("📊 [Telemetry] Gravando consumo Gemini (follow-up) para usuário %s", profile.ID)
				_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
					UserID:           profile.ID,
					TokensPrompt:     int(resp.UsageMetadata.PromptTokenCount),
					TokensCompletion: int(resp.UsageMetadata.CandidatesTokenCount),
					TotalTokens:      int(resp.UsageMetadata.TotalTokenCount),
					ModeloIA:         gemClient.Config.Model,
					Acao:             "duvida",
					Status:           "success",
				})
			}
		}

		// If loop finished without returning, something went wrong or too complex
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

	// Step 7: Compliance Check
	if extracted.AlertaOrganico {
		produtoAlvo := extracted.InsumoCultura
		if extracted.InsumoAplicado != "" {
			produtoAlvo = extracted.InsumoAplicado
		}
		log.Printf("🚨 [FSM] ALERTA ORGÂNICO ATIVADO! Produto: %s. Operação abortada.", produtoAlvo)
		finalIntent = "alerta_conformidade"

		botResponse = fmt.Sprintf("🚨 *ALERTA DE NÃO-CONFORMIDADE!*\n\n⚠️ O uso de *%s* parece desrespeitar as normas orgânicas (Lei 10.831 e IN 46).\n\nO registro no caderno de campo foi **BLOQUEADO**. Por favor, consulte o seu inspetor.", produtoAlvo)
		if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
			log.Printf("❌ [FSM] Falha ao enviar alerta via WPP: %v", err)
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, false)
		return ProcessResult{Success: false, Reason: "organic_compliance_failure"}
	}

	// Step 8: Save to Caderno de Campo
	if extracted.Intencao == "registro" {
		// Look up canteiros BEFORE inserting, so we can save them in the JSONB DetalhesTecnicos
		var canteiroIDs []string
		if len(extracted.Localizacao.Canteiros) > 0 {
			ids, err := sbClient.LookupCanteiroIDs(pmoID, profile.ID, extracted.Localizacao.Talhao, extracted.Localizacao.Canteiros)
			if err != nil {
				log.Printf("⚠️ [FSM] Erro ao buscar IDs dos canteiros (não crítico): %v", err)
			} else {
				canteiroIDs = ids
			}
		}

		record := supabase.CadernoCampoInsert{
			PmoID:              pmoID,
			UsuarioID:          profile.ID,
			TipoAtividade:      extracted.Atividade,
			Produto:            extracted.InsumoCultura,
			TalhaoCanteiro:     fmtLocalizacao(extracted.Localizacao),
			QuantidadeValor:    parseToFloat(extracted.Quantidade),
			QuantidadeUnidade:  extracted.Unidade,
			ObservacaoOriginal: body,
			SecaoOrigem:        "wppconnect",
			DetalhesTecnicos:   make(map[string]interface{}),
			HouveDescartes:     extracted.HouveDescartes,
			QtdDescartes:       parseToFloat(extracted.QtdDescartes),
			Canteiros:          canteiroIDs,
			InsumoAplicado:     extracted.InsumoAplicado,
		}

		// Mapeamento especial para Compra/Aquisição (Tabela Outro no Frontend)
		if record.TipoAtividade == "Compra/Aquisição" {
			record.TipoAtividade = "Outro" // Alinhamento com ActivityType.OUTRO
			
			// Normalização de Unidade solicitada: mudas -> unid
			if strings.ToLower(record.QuantidadeUnidade) == "mudas" || strings.ToLower(record.QuantidadeUnidade) == "muda" {
				record.QuantidadeUnidade = "unid"
			}

			// Popular Detalhes Técnicos para paridade com o Frontend React (ManualRecordDialog.tsx)
			record.DetalhesTecnicos["tipo_registro"] = "compra"
			record.DetalhesTecnicos["subtipo"] = "Compra de Insumo/Produto"
			record.DetalhesTecnicos["fornecedor"] = extracted.Fornecedor
			record.DetalhesTecnicos["tipo_origem"] = "compra"
			record.DetalhesTecnicos["origem"] = "Compra" // Solicitado pelo usuário
			record.DetalhesTecnicos["quantidade"] = record.QuantidadeValor
			record.DetalhesTecnicos["unidade"] = record.QuantidadeUnidade
			record.DetalhesTecnicos["numero_documento"] = "" // Opcional no momento

			// Sprint 1: Mapear para colunas nativas da tabela caderno_campo
			record.Fornecedor = extracted.Fornecedor
			// NotaFiscal extraída pelo Groq pode vir em campos variados, mas o ideal é mapear se houver
			// Se o Groq extrair NumeroDocumento, mapeamos aqui
			// record.NotaFiscal = ... 
			
			log.Printf("🛒 [FSM] Mapeando Compra: Fornecedor=%s, Qtd=%v %s", extracted.Fornecedor, record.QuantidadeValor, record.QuantidadeUnidade)
		}

		// GUARDRAIL DE SEGURANÇA (Double Check): Se a quantidade for zero, aborta.
		if record.QuantidadeValor <= 0 {
			log.Printf("⚠️ [FSM] Abortando registro com quantidade zero após processamento.")
			botResponse = "Por favor, informe a quantidade exata para o registro do seu caderno 🌱."
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, "guardrail_final", nil, startTime, false)
			return ProcessResult{Success: false, Reason: "missing_quantity_final"}
		}

		cadernoID, err := sbClient.InsertCadernoCampo(record)
		if err != nil {
			log.Printf("❌ [FSM] Falha ao salvar no Caderno de Campo: %v", err)
			botResponse = "❌ Falha técnica ao salvar no banco. Controle o sistema."
			if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
				log.Printf("❌ [FSM] Falha ao enviar mensagem de erro de DB via WPP: %v", err)
			}
			extraidoMap := map[string]interface{}{
				"tipo_atividade":     extracted.Atividade,
				"insumo_cultura":     extracted.InsumoCultura,
				"quantidade_valor":   extracted.Quantidade,
				"quantidade_unidade": extracted.Unidade,
				"houve_descartes":    extracted.HouveDescartes,
				"qtd_descartes":      extracted.QtdDescartes,
				"talhao_canteiro":    fmtLocalizacao(extracted.Localizacao),
			}
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, extraidoMap, startTime, false)
			return ProcessResult{Success: false, Reason: "db_insert_error"}
		}

		log.Printf("💾 [FSM] Registro salvo com sucesso no Caderno de Campo! (ID: %s)", cadernoID)

		// 5b. Tentar vincular canteiros (N:N) silenciosamente (Best-Effort)
		canteirosVinculados := 0
		if len(canteiroIDs) > 0 {
			if err := sbClient.InsertCanteiroVinculos(cadernoID, canteiroIDs); err != nil {
				log.Printf("⚠️ [FSM] Erro ao vincular canteiros (não crítico): %v", err)
			} else {
				canteirosVinculados = len(canteiroIDs)
			}
		}

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

		botResponse = fmt.Sprintf("✅ *Registro Salvo com Sucesso!*\n\n*Atividade:* %s\n*Item:* %s\n*Qtd:* %v %s\n*%s:* %s\n\n",
			extracted.Atividade, extracted.InsumoCultura, extracted.Quantidade, extracted.Unidade, localOuFornecedorLabel, strings.ToUpper(localOuFornecedorValue))

		if canteirosVinculados > 0 {
			botResponse += fmt.Sprintf("_Vinculado a %d canteiro(s)._\n", canteirosVinculados)
		}
		botResponse += "_Seu caderno eletrônico está em dia._ 🌱"

		if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
			log.Printf("❌ [FSM] Falha ao enviar confirmação de registro via WPP: %v", err)
		}

		// Success Logging
		extraidoMap := map[string]interface{}{
			"tipo_atividade":     extracted.Atividade,
			"insumo_cultura":     extracted.InsumoCultura,
			"quantidade_valor":   extracted.Quantidade,
			"quantidade_unidade": extracted.Unidade,
			"houve_descartes":    extracted.HouveDescartes,
			"qtd_descartes":      extracted.QtdDescartes,
			"talhao_canteiro":    fmtLocalizacao(extracted.Localizacao),
			"fornecedor":         extracted.Fornecedor,
		}

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

		// Mapeamento para struct do Supabase
		limpezaRecord := supabase.PmoLimpezaInsert{
			PmoID:            pmoID,
			DataLimpeza:      time.Now().Format("2006-01-02"),
			ItemArea:         extracted.ItemArea,
			TipoLimpeza:      extracted.TipoLimpeza,
			ProdutoUtilizado: extracted.ProdutoUtilizado,
			Dosagem:          extracted.Dosagem,
			Responsavel:      extracted.Responsavel,
			Observacao:       body,
		}

		if limpezaRecord.Responsavel == "" {
			limpezaRecord.Responsavel = "Produtor"
		}

		err := sbClient.InsertPMOLimpeza(limpezaRecord)
		if err != nil {
			log.Printf("❌ [FSM] Falha ao salvar no Controle de Limpeza: %v", err)
			botResponse = "❌ Falha técnica ao salvar sua limpeza. Tente novamente."
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			return ProcessResult{Success: false, Reason: "db_limpeza_error"}
		}

		botResponse = fmt.Sprintf("✅ *Registro de Limpeza Salvo com Sucesso!*\n\n*Item:* %s\n*Tipo:* %s\n*Responsável:* %s\n\n_Conforme Formulário 04 SEBRAE._ 🧽",
			extracted.ItemArea, extracted.TipoLimpeza, limpezaRecord.Responsavel)
		
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

		// Look up canteiros
		var canteiroIDs []string
		if len(canteiros) > 0 {
			ids, _ := sbClient.LookupCanteiroIDs(pmoID, profile.ID, talhao, canteiros)
			canteiroIDs = ids
		}

		record := supabase.CadernoCampoInsert{
			PmoID:              pmoID,
			UsuarioID:          profile.ID,
			TipoAtividade:      atividade,
			Produto:            insumo,
			TalhaoCanteiro:     fmtLocalizacao(groq.Localizacao{Talhao: talhao, Canteiros: canteiros}),
			QuantidadeValor:    qtd,
			QuantidadeUnidade:  unidade,
			ObservacaoOriginal: "Contexto restaurado + Resposta: " + body,
			SecaoOrigem:        "wppconnect_fsm_recovery",
			DetalhesTecnicos:   make(map[string]interface{}),
			Canteiros:          canteiroIDs,
		}

		cadernoID, err := sbClient.InsertCadernoCampo(record)
		if err != nil {
			log.Printf("❌ [FSM] Erro ao salvar registro recuperado: %v", err)
			sendFeedback(wpClient, ttsClient, from, "❌ Erro ao salvar o registro. Tente novamente.", respondAudio)
			return ProcessResult{Success: false, Reason: "db_error_recovery"}
		}

		// Vincular canteiros
		if len(canteiroIDs) > 0 {
			_ = sbClient.InsertCanteiroVinculos(cadernoID, canteiroIDs)
		}

		localOuFornecedorLabel := "Local"
		localOuFornecedorValue := record.TalhaoCanteiro

		if atividade == "Compra/Aquisição" {
			localOuFornecedorLabel = "Fornecedor"
			// No estado recuperado, o fornecedor deve estar no ctx ou no record.DetalhesTecnicos se reconstruído
			f, _ := ctx["fornecedor"].(string)
			if f == "" {
				f = "NÃO INFORMADO"
			}
			localOuFornecedorValue = f
		}

		botResponse := fmt.Sprintf("✅ *Registro Completo e Salvo!*\\n\\n*Atividade:* %s\\n*Item:* %s\\n*Qtd:* %v %s\\n*%s:* %s\\n\\n_Contexto recuperado com sucesso._ 🌱",
			atividade, insumo, qtd, unidade, localOuFornecedorLabel, strings.ToUpper(localOuFornecedorValue))
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

	record := supabase.CadernoCampoInsert{
		PmoID:              pmoID,
		UsuarioID:          profile.ID,
		TipoAtividade:      "Outro", // ActivityType.OUTRO
		Produto:            insumo,
		TalhaoCanteiro:     "NÃO INFORMADO",
		QuantidadeValor:    qtd,
		QuantidadeUnidade:  unidade,
		ObservacaoOriginal: "Compra registrada via atendimento ativo. Fornecedor: " + body,
		SecaoOrigem:        "wppconnect_fsm_recovery_compra",
		DetalhesTecnicos:   make(map[string]interface{}),
	}

	// Detalhes Técnicos para o Frontend
	record.DetalhesTecnicos["tipo_registro"] = "compra"
	record.DetalhesTecnicos["subtipo"] = "Compra de Insumo/Produto"
	record.DetalhesTecnicos["fornecedor"] = fornecedor
	record.DetalhesTecnicos["tipo_origem"] = "compra"
	record.DetalhesTecnicos["origem"] = "Compra"
	record.DetalhesTecnicos["quantidade"] = qtd
	record.DetalhesTecnicos["unidade"] = unidade
	record.DetalhesTecnicos["numero_documento"] = ""

	cadernoID, err := sbClient.InsertCadernoCampo(record)
	if err != nil {
		log.Printf("❌ [FSM] Erro ao salvar compra recuperada: %v", err)
		sendFeedback(wpClient, ttsClient, from, "❌ Erro ao salvar a compra. Tente novamente.", respondAudio)
		return ProcessResult{Success: false, Reason: "db_error_compra_recovery"}
	}

	log.Printf("💾 [FSM] Compra salva com sucesso! (ID: %s)", cadernoID)

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
