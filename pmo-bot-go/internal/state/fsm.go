package state

import (
	"fmt"
	"log"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/whatsapp"
)

// ProcessResult gives insight into what happened (useful for tests/metrics)
type ProcessResult struct {
	Success bool
	Reason  string
}

// ProcessMessage orchestrates the flow:
// LID -> Phone -> PMO ID -> LLM Extraction -> Organic Alert Check -> Save to Supabase -> Feedback
func ProcessMessage(from string, body string, sbClient *supabase.Client, groqClient *groq.Client, wpClient *whatsapp.Client, gemClient *gemini.Client) ProcessResult {
	log.Printf("🧵 [FSM] Iniciando fluxo para mensagem de: %s", from)

	// Variables for tracking the process outcome and logging
	var botResponse string
	var finalIntent string
	var aiModel = "llama-3.3-70b-versatile" // Default Groq model
	var promptTokens int
	var completionTokens int

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
		wpClient.SendMessage(from, "❌ Não consegui encontrar o seu cadastro no sistema PMO. Verifique se o seu número está correto.")
		return ProcessResult{Success: false, Reason: "profile_not_found"}
	}
	pmoID := profile.PmoAtivoID
	log.Printf("✅ [FSM] Usuário %s (%s) associado ao PMO ID %d", profile.Nome, phone, pmoID)

	// Step 3: Call Groq LLM for entity extraction
	extracted, err := groqClient.Extract(body)
	if err != nil {
		log.Printf("❌ [FSM] Falha na extração NER: %v", err)
		wpClient.SendMessage(from, "⚠️ Ocorreu um erro técnico ao processar sua mensagem. Tente novamente.")
		if err := wpClient.SendMessage(from, "⚠️ Ocorreu um erro técnico ao processar sua mensagem. Tente novamente."); err != nil {
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
			if err := wpClient.SendMessage(from, botResponse); err != nil {
				log.Printf("❌ [FSM] Falha ao enviar saudação via WPP: %v", err)
			}
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil)
		return ProcessResult{Success: true, Reason: "ignored_intent"}
	}

	// If intent is "duvida", use Gemini to answer
	if extracted.Intencao == "duvida" {
		log.Printf("🧠 [FSM] Dúvida detectada. Consultando Especialista Gemini...")
		aiModel = "gemini-1.5-flash"
		answer, err := gemClient.AskExpert(body)
		if err != nil {
			log.Printf("❌ [FSM] Erro ao consultar Gemini: %v", err)
			botResponse = "⚠️ Tive um problema ao consultar as normas. Tente de novo."
			if err := wpClient.SendMessage(from, botResponse); err != nil {
				log.Printf("❌ [FSM] Falha ao enviar mensagem de erro do especialista via WPP: %v", err)
			}
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil)
			return ProcessResult{Success: false, Reason: "expert_error"}
		}

		log.Printf("✅ [FSM] Resposta gerada. Enviando via WPPConnect.")
		botResponse = fmt.Sprintf("📚 *Consultor Orgânico RESPONDE:*\n\n%s", answer)
		if err := wpClient.SendMessage(from, botResponse); err != nil {
			log.Printf("❌ [FSM] Falha ao enviar resposta especialista via WPP: %v", err)
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil)
		return ProcessResult{Success: true, Reason: "expert_answered"}
	}

	// Step 4: Compliance Check
	if extracted.AlertaOrganico {
		log.Printf("🚨 [FSM] ALERTA ORGÂNICO ATIVADO! Produto: %s. Operação abortada.", extracted.InsumoCultura)
		finalIntent = "alerta_conformidade"

		botResponse = fmt.Sprintf("🚨 *ALERTA DE NÃO-CONFORMIDADE!*\n\n⚠️ O uso de *%s* parece desrespeitar as normas orgânicas (Lei 10.831 e IN 46).\n\nO registro no caderno de campo foi **BLOQUEADO**. Por favor, consulte o seu inspetor.", extracted.InsumoCultura)
		if err := wpClient.SendMessage(from, botResponse); err != nil {
			log.Printf("❌ [FSM] Falha ao enviar alerta via WPP: %v", err)
		}

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil)
		return ProcessResult{Success: false, Reason: "organic_compliance_failure"}
	}

	// Step 5: Save to Caderno de Campo
	if extracted.Intencao == "registro" {
		record := supabase.CadernoCampoInsert{
			PmoID:              pmoID,
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
		}

		cadernoID, err := sbClient.InsertCadernoCampo(record)
		if err != nil {
			log.Printf("❌ [FSM] Falha ao salvar no Caderno de Campo: %v", err)
			botResponse = "❌ Falha técnica ao salvar no banco. Controle o sistema."
			if err := wpClient.SendMessage(from, botResponse); err != nil {
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
			recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, extraidoMap)
			return ProcessResult{Success: false, Reason: "db_insert_error"}
		}

		log.Printf("💾 [FSM] Registro salvo com sucesso no Caderno de Campo! (ID: %s)", cadernoID)

		// 5b. Tentar vincular canteiros (N:N) silenciosamente (Best-Effort)
		canteirosVinculados := 0
		if len(extracted.Localizacao.Canteiros) > 0 {
			canteiroIDs, err := sbClient.LookupCanteiroIDs(pmoID, extracted.Localizacao.Talhao, extracted.Localizacao.Canteiros)
			if err != nil {
				log.Printf("⚠️ [FSM] Erro ao buscar IDs dos canteiros (não crítico): %v", err)
			} else if len(canteiroIDs) > 0 {
				if err := sbClient.InsertCanteiroVinculos(cadernoID, canteiroIDs); err != nil {
					log.Printf("⚠️ [FSM] Erro ao vincular canteiros (não crítico): %v", err)
				} else {
					canteirosVinculados = len(canteiroIDs)
				}
			}
		}

		// Send Confirmation Message
		botResponse = fmt.Sprintf("✅ *Registro Salvo com Sucesso!*\n\n*Atividade:* %s\n*Item:* %s\n*Qtd:* %g %s\n*Local:* %s\n\n",
			extracted.Atividade, extracted.InsumoCultura, extracted.Quantidade, extracted.Unidade, fmtLocalizacao(extracted.Localizacao))

		if canteirosVinculados > 0 {
			botResponse += fmt.Sprintf("_Vinculado a %d canteiro(s)._\n", canteirosVinculados)
		}
		botResponse += "_Seu caderno eletrônico está em dia._ 🌱"

		if err := wpClient.SendMessage(from, botResponse); err != nil {
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

		recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, extraidoMap)
		return ProcessResult{Success: true, Reason: "record_saved"}
	}

	recordLog(sbClient, profile, body, botResponse, aiModel, promptTokens, completionTokens, finalIntent, nil)
	return ProcessResult{Success: true, Reason: "unhandled_intent"}
}

// recordLog is a helper to consistently log the bot's processing outcome to Audit and Training tables
func recordLog(sbClient *supabase.Client, profile *supabase.Profile, userMsg, botResp, model string, promptTokens, completionTokens int, intent string, extracted map[string]interface{}) {
	// 1. Audit Log (requested/approved in Phase 2/3)
	_ = sbClient.InsertLogProcessamento(supabase.LogProcessamentoInsert{
		PmoID:            profile.PmoAtivoID,
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
}

// fmtLocalizacao is a quick helper to combine talhao and canteiros
func fmtLocalizacao(loc groq.Localizacao) string {
	if loc.Talhao == "" || loc.Talhao == "NÃO INFORMADO" {
		return "NÃO INFORMADO"
	}
	if len(loc.Canteiros) > 0 {
		return loc.Talhao + ", Canteiro " + strings.Join(loc.Canteiros, ", ")
	}
	return loc.Talhao
}
