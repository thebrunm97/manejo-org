package state

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/whatsapp"
)

// ProcessResult gives insight into what happened (useful for tests/metrics)
type ProcessResult struct {
	Success bool
	Reason  string
}

// ProcessMessage orchestrates the flow:
// LID -> Phone -> PMO ID -> LLM Extraction -> Organic Alert Check -> Save to Supabase -> Feedback
func ProcessMessage(from string, body string, msgID string, isAudio bool, sbClient *supabase.Client, groqClient *groq.Client, wpClient *whatsapp.Client, gemClient *gemini.Client, ttsClient *tts.Orchestrator) ProcessResult {
	log.Printf("🧵 [FSM] Iniciando fluxo para mensagem de: %s (isAudio=%v)", from, isAudio)

	// Variables for tracking the process outcome and logging
	startTime := time.Now()
	var botResponse string
	var finalIntent string
	var aiModel = "llama-3.3-70b-versatile" // Default Groq model
	var promptTokens int
	var completionTokens int
	var respondWithAudio = false

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

		body = transcription.Text
		respondWithAudio = true
		aiModel = "whisper-large-v3-turbo" // Override log metrics so audio usage shows
		log.Printf("📝 [FSM] Transcrição concluída: \"%s\"", body)
	}

	// Step 1: Resolve the sender's phone number
	phone, err := sbClient.ResolvePhone(from)
	if err != nil {
		log.Printf("⚠️ [FSM] Erro ao resolver LID/telefone (%s): %v", from, err)
		phone = from
	}

	// Step 2: Ensure we know which farm (PMO) this user belongs to
	profile, err := sbClient.GetProfileByPhone(phone)
	if err != nil {
		log.Printf("🚫 [FSM] Usuário não encontrado ou sem PMO ativo: %s", phone)

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

	promptTokens = extracted.TokensPrompt
	completionTokens = extracted.TokensCompletion
	finalIntent = extracted.Intencao

	// Filter out non-actionable intents
	if extracted.Intencao == "ignorar" || extracted.Intencao == "saudacao" {
		log.Printf("⏭️ [FSM] Intenção '%s'.", extracted.Intencao)
		if extracted.Intencao == "saudacao" {
			botResponse = "Olá! Sou seu assistente de Caderno de Campo Orgânico 🌱.\nDiga o que você plantou, aplicou hoje, ou qual é sua dúvida sobre orgânicos."
			if err := sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio); err != nil {
				log.Printf("❌ [FSM] Falha ao enviar saudação via WPP: %v", err)
			}
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, true)
		return ProcessResult{Success: true, Reason: "ignored_intent"}
	}

	// If intent is "duvida", use Gemini to answer with Custom RAG
	if extracted.Intencao == "duvida" {
		log.Printf("🧠 [FSM] Dúvida detectada. Iniciando fluxo Custom RAG para PMO %d...", pmoID)

		// 1. Transformar a pergunta do agricultor num vetor usando o Gemini
		queryEmbedding, err := gemClient.GenerateEmbedding(body)
		if err != nil {
			log.Printf("❌ [FSM] Erro ao gerar embedding da pergunta: %v", err)
			return handleDuvidaFallback(wpClient, ttsClient, from, gemClient, body, respondWithAudio, sbClient, profile, startTime, promptTokens, completionTokens, finalIntent)
		}

		// 2. Procurar no Supabase os 3 parágrafos mais parecidos com a pergunta (Multitenant!)
		searchResults, err := sbClient.MatchFarmDocuments(pmoID, queryEmbedding, 0.5, 3)
		if err != nil {
			log.Printf("⚠️ [FSM] Erro na busca vetorial (usando fallback sem contexto): %v", err)
			return handleDuvidaFallback(wpClient, ttsClient, from, gemClient, body, respondWithAudio, sbClient, profile, startTime, promptTokens, completionTokens, finalIntent)
		}

		// 3. Montar o "Contexto" com identificação de origem
		contextText := ""
		if len(searchResults) > 0 {
			log.Printf("📚 [FSM] %d trechos encontrados. Injetando contexto no Gemini.", len(searchResults))
			for _, res := range searchResults {
				prefix := "[DADOS PRIVADOS DA SUA FAZENDA]"
				if res.IsGlobal {
					prefix = "[FONTE GERAL DO AGRO]"
				}
				contextText += fmt.Sprintf("%s (Documento: %s): %s\n\n", prefix, res.DocumentName, res.Content)
			}
		} else {
			log.Printf("🔍 [FSM] Nenhum documento específico encontrado para esta fazenda. Usando conhecimento base.")
		}

		// 4. Pedir ao Gemini para responder COM BASE nesse contexto (RAG)
		ragPrompt := body
		if contextText != "" {
			ragPrompt = fmt.Sprintf(`Você é a Ana, assistente técnica de campo. Use as informações abaixo para responder ao agricultor.

INSTRUÇÕES CRÍTICAS:
1. Comece sua resposta citando a origem da informação (ex: "De acordo com os manuais gerais..." ou "Conforme os registros da sua fazenda...").
2. Se a informação vier de "[FONTE GERAL DO AGRO]", trate como diretriz técnica ou lei.
3. Se vier de "[DADOS PRIVADOS DA SUA FAZENDA]", trate como histórico ou regra específica da propriedade dele.
4. Se a resposta não estiver nos dados abaixo, use seu conhecimento geral, mas deixe claro que não encontrou nos documentos específicos.

CONHECIMENTO DISPONÍVEL:
%s

PERGUNTA DO AGRICULTOR: %s`, contextText, body)
		}

		aiModel = "gemini-1.5-flash-rag"
		answer, err := gemClient.AskExpert(ragPrompt)
		if err != nil {
			log.Printf("❌ [FSM] Erro ao consultar Gemini RAG: %v", err)
			botResponse = "⚠️ Tive um problema ao consultar as normas. Tente de novo."
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, false)
			return ProcessResult{Success: false, Reason: "expert_error"}
		}

		log.Printf("✅ [FSM] Resposta RAG gerada. Enviando via WPPConnect.")
		botResponse = fmt.Sprintf("📚 *Consultor Orgânico RESPONDE:*\n\n%s", answer)
		sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, true)
		return ProcessResult{Success: true, Reason: "expert_answered_rag"}
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
			QuantidadeValor:    extracted.Quantidade,
			QuantidadeUnidade:  extracted.Unidade,
			ObservacaoOriginal: body,
			SecaoOrigem:        "wppconnect",
			DetalhesTecnicos:   make(map[string]interface{}),
			HouveDescartes:     extracted.HouveDescartes,
			QtdDescartes:       extracted.QtdDescartes,
			Canteiros:          canteiroIDs,
			InsumoAplicado:     extracted.InsumoAplicado,
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
		botResponse = fmt.Sprintf("✅ *Registro Salvo com Sucesso!*\n\n*Atividade:* %s\n*Item:* %s\n*Qtd:* %g %s\n*Local:* %s\n\n",
			extracted.Atividade, extracted.InsumoCultura, extracted.Quantidade, extracted.Unidade, fmtLocalizacao(extracted.Localizacao))

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
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, extraidoMap, startTime, true)
		return ProcessResult{Success: true, Reason: "record_saved"}
	}

	recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil, startTime, true)
	return ProcessResult{Success: true, Reason: "unhandled_intent"}
}

// recordLog is a helper to consistently log the bot's processing outcome to Audit and Training tables
func recordLog(sbClient *supabase.Client, profile *supabase.Profile, userMsg, botResp, model string, promptTokens, completionTokens int, intent string, extracted map[string]interface{}, startTime time.Time, isSuccess bool) {
	// 1. Audit Log (requested/approved in Phase 2/3)
	_ = sbClient.InsertLogProcessamento(supabase.LogProcessamentoInsert{
		PmoID:            profile.PmoAtivoID,
		UserID:           profile.ID,
		MensagemUsuario:  userMsg,
		RespostaBot:      botResp,
		ModeloIA:         model,
		TokensPrompt:     promptTokens,
		TokensCompletion: completionTokens,
		Intencao:         intent,
	})

	// 2. Training Log (Dashboard visibility)
	_ = sbClient.InsertLogTreinamento(supabase.LogTreinamentoInsert{
		PmoID:         profile.PmoAtivoID,
		TextoUsuario:  userMsg,
		JsonExtraido:  extracted,
		TipoAtividade: intent,
		UserID:        profile.ID,
		ModeloIA:      model,
	})

	// 3. Financial Audit Log (logs_consumo)
	var duracaoMs int64
	if !startTime.IsZero() {
		duracaoMs = time.Since(startTime).Milliseconds()
	}

	custoEstimado := (float64(promptTokens) / 1000.0 * 0.00059) + (float64(completionTokens) / 1000.0 * 0.00079)
	totalTokens := promptTokens + completionTokens
	status := "success"
	if !isSuccess {
		status = "error"
	}

	_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
		UserID:           profile.ID,
		TokensPrompt:     promptTokens,
		TokensCompletion: completionTokens,
		TotalTokens:      totalTokens,
		ModeloIA:         model,
		Acao:             intent,
		CustoEstimado:    custoEstimado,
		DuracaoMs:        duracaoMs,
		Status:           status,
	})
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
	aiModel := "gemini-1.5-flash-fallback"
	answer, err := gemClient.AskExpert(body)
	if err != nil {
		botResponse := "⚠️ Tive um problema ao consultar as normas. Tente de novo."
		sendFeedback(wpClient, ttsClient, from, botResponse, respondAudio)
		return ProcessResult{Success: false, Reason: "expert_error"}
	}

	botResponse := fmt.Sprintf("📚 *Consultor Orgânico RESPONDE (Base):*\n\n%s", answer)
	sendFeedback(wpClient, ttsClient, from, botResponse, respondAudio)
	recordLog(sbClient, profile, body, botResponse, aiModel, pTokens, cTokens, intent, nil, startTime, true)
	return ProcessResult{Success: true, Reason: "expert_answered_fallback"}
}
