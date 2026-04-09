package state

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

// handleLimpeza implements SEBRAE Form 04 logic for rural infrastructure cleaning
func handleLimpeza(ctx context.Context, ext *groq.ExtractionResult, profile *supabase.Profile, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, from string, body string, respondWithAudio bool, startTime time.Time, modelConfigured string, modelEffective string, pTokens int, cTokens int) ProcessResult {
	log.Printf("🧼 [FSM] Processando Intenção de Limpeza (Form 04)")
	
	pmoID := profile.PmoAtivoID
	dataLimpeza := ext.Data
	if dataLimpeza == "" {
		dataLimpeza = time.Now().Format("2006-01-02")
	}

	payload := map[string]interface{}{
		"data_limpeza":      dataLimpeza,
		"item_area":         ext.ItemArea,
		"tipo_limpeza":      ext.Atividade, // Corrected field name
		"produto_utilizado": ext.ProdutoUtilizado,
		"dosagem":           ext.Dosagem,
		"responsavel":       ext.Responsavel,
		"observacao":        body,
	}

	resp, err := sbClient.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
		"pmo_id_arg":  pmoID,
		"user_id_arg": profile.ID,
		"tipo_arg":    "Limpeza",
		"payload_arg": payload,
	})

	if err != nil {
		log.Printf("❌ [FSM] Falha ao registrar Limpeza: %v", err)
		sendFeedback(wpClient, ttsClient, from, "❌ Erro ao salvar registro de limpeza.", respondWithAudio)
		return ProcessResult{Success: false, Reason: "rpc_error"}
	}

	botResponse := fmt.Sprintf("✅ *Limpeza Registrada (Form 04)!*\n\n*Área/Item:* %s\n*Data:* %s\n*Produto:* %s\n*Responsável:* %s", 
		ext.ItemArea, dataLimpeza, ext.ProdutoUtilizado, ext.Responsavel)
	
	sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
	recordLog(sbClient, profile, body, botResponse, modelConfigured, modelEffective, pTokens, cTokens, "limpeza", toMap(ext), startTime, true, nil)
	
	return ProcessResult{Success: true, Reason: "limpeza_saved", TransactionID: resp["id"]}
}
