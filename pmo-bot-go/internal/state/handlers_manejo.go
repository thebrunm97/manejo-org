package state

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

// handleAguardandoQuantidade processes the second turn of an active interview for quantity
func handleAguardandoQuantidade(ctx context.Context, body string, from string, phone string, profile *supabase.Profile, respondWithAudio bool, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, historyManager *history.Manager, extraction map[string]interface{}, startTime time.Time, modelConfigured string) ProcessResult {
	log.Printf("📥 [FSM-TURN2] Recebida quantidade: %s", body)
	
	// Convert interface map back to ExtractionResult (simplified)
	var ext groq.ExtractionResult
	// We can use toMap/json if needed, but for simplicity let's just use the data
	ext.Intencao = "registro"
	ext.Atividade, _ = extraction["atividade"].(string)
	ext.InsumoCultura, _ = extraction["insumo_cultura"].(string)
	ext.Unidade, _ = extraction["unidade"].(string)
	ext.Localizacao.Talhao, _ = extraction["localizacao"].(map[string]interface{})["talhao"].(string)
	
	ext.Quantidade = body // Turn 2 input
	
	// Recursively call the registration flow with the new data
	// Note: For now we'll implement the logic here to avoid circular complexity
	return finalizeRegistration(ctx, &ext, profile, sbClient, wpClient, ttsClient, from, body, respondWithAudio, startTime, historyManager, phone, modelConfigured)
}

// handleAguardandoCompra processes the second turn for purchase details (fornecedor)
func handleAguardandoCompra(ctx context.Context, body string, from string, phone string, profile *supabase.Profile, respondWithAudio bool, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, historyManager *history.Manager, extraction map[string]interface{}, startTime time.Time, modelConfigured string) ProcessResult {
	log.Printf("📥 [FSM-TURN2] Recebido fornecedor: %s", body)
	
	var ext groq.ExtractionResult
	ext.Intencao = "registro"
	ext.Atividade = "Compra/Aquisição"
	ext.InsumoCultura, _ = extraction["insumo_cultura"].(string)
	ext.Quantidade = extraction["quantidade"]
	ext.Unidade, _ = extraction["unidade"].(string)
	
	ext.Fornecedor = body // Turn 2 input
	
	return finalizeRegistration(ctx, &ext, profile, sbClient, wpClient, ttsClient, from, body, respondWithAudio, startTime, historyManager, phone, modelConfigured)
}

// finalizeRegistration is the common sink for all Manejo and Purchase recordings
func finalizeRegistration(ctx context.Context, ext *groq.ExtractionResult, profile *supabase.Profile, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, from string, originalBody string, respondWithAudio bool, startTime time.Time, historyManager *history.Manager, phone string, modelConfigured string) ProcessResult {
	pmoID := profile.PmoAtivoID
	
	// 1. Compliance Check (Spatial-Aware) - Reused from fsm.go
	if ext.AlertaOrganico || isProibidoEscancarado(ext.InsumoAplicado) || isProibidoEscancarado(ext.InsumoCultura) {
		// Strict Compliance Logic
		produtoAlvo := ext.InsumoAplicado
		if produtoAlvo == "" { produtoAlvo = ext.InsumoCultura }
		
		talhoesExtraidos := ext.Localizacao.TalhoesAplicados
		if len(talhoesExtraidos) == 0 && ext.Localizacao.Talhao != "" {
			talhoesExtraidos = []string{ext.Localizacao.Talhao}
		}

		if len(talhoesExtraidos) == 0 && profile.TemProducaoParalela {
			botResponse := "⚠️ Identifiquei um produto químico, mas como você possui produção paralela, preciso que especifique **em qual talhão** ele foi aplicado."
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			return ProcessResult{Success: false, Reason: "parallel_prod_missing_context"}
		}

		temOrganicoNoMeio := false
		if len(talhoesExtraidos) > 0 {
			for _, nomeExtraido := range talhoesExtraidos {
				for _, t := range profile.Talhoes {
					if strings.EqualFold(t.Nome, nomeExtraido) && t.ModalidadeProducao != "CONVENCIONAL" {
						temOrganicoNoMeio = true
						break
					}
				}
			}
		} else if profile.ModalidadePredominante != "CONVENCIONAL" {
			temOrganicoNoMeio = true
		}

		if temOrganicoNoMeio {
			botResponse := fmt.Sprintf("🚨 *ALERTA DE NÃO-CONFORMIDADE!*\n\n⚠️ O uso de *%s* é proibido em áreas orgânicas. Registro **BLOQUEADO**.", produtoAlvo)
			sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
			recordLog(sbClient, profile, originalBody, botResponse, modelConfigured, "fsm-v4", 0, 0, "alerta_conformidade", nil, startTime, false, nil)
			return ProcessResult{Success: false, Reason: "organic_compliance_block"}
		}
	}

	// 2. Database Recording (RPC)
	if ext.Data == "" { ext.Data = time.Now().Format("2006-01-02") }
	
	var err error

	if ext.Atividade == "Compra/Aquisição" {
		rpcArgs := map[string]interface{}{
			"pmo_id_arg":             pmoID,
			"user_id_arg":            profile.ID,
			"produto_arg":            ext.InsumoCultura,
			"quantidade_valor_arg":   parseToFloat(ext.Quantidade),
			"quantidade_unidade_arg": ext.Unidade,
			"fornecedor_arg":         ext.Fornecedor,
			"nota_fiscal_arg":        ext.NotaFiscal,
			"data_compra_arg":        ext.Data,
		}
		_, err = sbClient.RegistrarCompraInsumoRPC(ctx, rpcArgs)
	} else {
		payload := map[string]interface{}{
			"data":                ext.Data,
			"produto":             ext.InsumoCultura,
			"quantidade_valor":    parseToFloat(ext.Quantidade),
			"quantidade_unidade":  ext.Unidade,
			"talhao_nome":         ext.Localizacao.Talhao,
			"canteiro_ids":        ext.Localizacao.Canteiros,
			"fornecedor":          ext.Fornecedor,
			"insumo_aplicado":     ext.InsumoAplicado,
			"metodo_aplicacao":    ext.Atividade,
			"observacao_original": originalBody,
		}
		_, err = sbClient.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
			"pmo_id_arg":  pmoID,
			"user_id_arg": profile.ID,
			"tipo_arg":    ext.Atividade,
			"payload_arg": payload,
		})
	}

	if err != nil {
		sendFeedback(wpClient, ttsClient, from, "❌ Falha técnica ao salvar no banco.", respondWithAudio)
		return ProcessResult{Success: false, Reason: "rpc_error"}
	}

	// 3. Cleanup State and Feedback
	if historyManager != nil { historyManager.ClearFSMState(phone) }
	
	botResponse := fmt.Sprintf("✅ *Registro Salvo!*\n*Atividade:* %s\n*Item:* %s\n*Qtd:* %v %s", ext.Atividade, ext.InsumoCultura, ext.Quantidade, ext.Unidade)
	sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
	recordLog(sbClient, profile, originalBody, botResponse, modelConfigured, "fsm-v4", 0, 0, "registro", toMap(ext), startTime, true, nil)
	
	return ProcessResult{Success: true, Reason: "record_saved"}
}
