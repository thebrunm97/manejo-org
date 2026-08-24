package state

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// handleLimpeza implements SEBRAE Form 04 logic for rural infrastructure cleaning
func handleLimpeza(ctx context.Context, ext *groq.ExtractionResult, profile *supabase.Profile, sbClient *supabase.Client, _ ports.MessageSender, _ ports.Synthesizer, _ string, body string, _ bool, startTime time.Time, modelConfigured string, modelEffective string, pTokens int, cTokens int) (string, ProcessResult) {
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
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": profile.PropriedadeAtivaID,
		"user_id_arg":        profile.ID,
		"tipo_arg":           "Limpeza",
		"payload_arg":        payload,
	}, dataLimpeza)

	if err != nil {
		log.Printf("❌ [FSM] Falha técnica ao registrar Limpeza: %v", err)
		return "❌ Falha técnica ao acessar o banco de dados.", ProcessResult{Success: false, Reason: "rpc_http_error"}
	}

	if status, ok := resp["status"].(string); ok && status == "error" {
		return fmt.Sprintf("❌ Erro no Registro de Limpeza: %v", resp["message"]), ProcessResult{Success: false, Reason: "rpc_database_error"}
	}

	id := resp["id"]
	if id == nil {
		return "❌ Falha de Persistência: O registro de limpeza foi confirmado, mas não retornou um ID (Bloqueio de RLS?). Verifique se você tem permissão.", ProcessResult{Success: false, Reason: "silent_failure_id_null"}
	}

	botResponse := fmt.Sprintf("✅ *Limpeza Registrada!*\n\n*Área/Item:* %s\n*Data:* %s\n*Produto:* %s\n*Responsável:* %s\n*ID:* %v",
		ext.ItemArea, dataLimpeza, ext.ProdutoUtilizado, ext.Responsavel, id)

	recordLog(sbClient, profile, body, botResponse, modelConfigured, modelEffective, pTokens, cTokens, 0, 0, "limpeza", toMap(ext), startTime, true, nil)

	return botResponse, ProcessResult{Success: true, Reason: "limpeza_saved", TransactionID: id}
}
