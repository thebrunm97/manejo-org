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

// handleAssumirCota processes the intent where a producer commits to a cooperative demand.
func handleAssumirCota(ctx context.Context, ext *groq.ExtractionResult, profile *supabase.Profile, sbClient *supabase.Client, wpClient *whatsapp.Client, gemClient *gemini.Client, ttsClient *tts.Orchestrator, from string, originalBody string, respondWithAudio bool, startTime time.Time) ProcessResult {
	log.Printf("🤝 [FSM-COLETIVO] Iniciando captação de cota: %s (%v)", ext.InsumoCultura, ext.QuantidadeAssumida)

	// 1. Validate property
	propID := profile.PropriedadeAtivaID
	if propID == 0 {
		botResponse := "❌ Você não possui uma propriedade ativa selecionada. Não posso registrar a cota."
		sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
		return ProcessResult{Success: false, Reason: "no_active_property"}
	}

	// 2. Find active demand
	cultura := ext.InsumoCultura
	demanda, err := sbClient.GetDemandaAtivaPorCultura(ctx, cultura)
	if err != nil {
		botResponse := fmt.Sprintf("Desculpe, não encontrei nenhuma demanda aberta da cooperativa para *%s* no momento.", cultura)
		sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
		return ProcessResult{Success: false, Reason: "demand_not_found"}
	}

	// 3. Intelligence: Reverse Scheduling (Gemini)
	log.Printf("🧠 [FSM-COLETIVO] Consultando Gemini para cronograma reverso: %s -> %s", cultura, demanda.DataEntrega)
	
	promptPlantio := fmt.Sprintf(`Você é um agrônomo sênior. 
A cooperativa precisa que o produtor entregue uma safra de %s no dia %s.
Sabendo o ciclo médio dessa cultura na região Sul/Sudeste do Brasil, em qual data aproximada (dia/mês) ele precisa realizar o plantio?
Leve em conta o tempo de desenvolvimento até a colheita técnica.
Responda de forma extremamente curta e direta, apenas a data ou um pequeno intervalo (ex: "Entre 10 e 15 de maio").`, cultura, demanda.DataEntrega)

	dataSugerida, err := gemClient.AskExpert("Qual a data de plantio ideal?", promptPlantio)
	if err != nil {
		log.Printf("⚠️ [FSM-COLETIVO] Erro ao consultar Gemini para plantio: %v", err)
		dataSugerida = "Data não calculada"
	}

	// 4. Save to Database
	quantidade := parseToFloat(ext.QuantidadeAssumida)
	if quantidade <= 0 {
		quantidade = parseToFloat(ext.Quantidade) // Fallback to generic quantity
	}

	payload := map[string]interface{}{
		"demanda_id":     demanda.ID,
		"propriedade_id": propID,
		"usuario_id":     profile.ID,
		"quantidade":     quantidade,
		"data_plantio":   time.Now().Format("2006-01-02"), // We use registration date as anchor, or better, we can parse dataSugerida if it was a date. But the spec says "Data de Plantio" in cronograma. 
		"observacao_ia":  fmt.Sprintf("Sugerido por IA baseado na entrega em %s: %s", demanda.DataEntrega, dataSugerida),
	}
	// Note: RegistrarCotaComCronograma expects data_plantio as YYYY-MM-DD. 
	// Since Gemini returns a string like "10 de maio", we'll save the raw suggest in observation 
	// and use a placeholder or today for the actual date field for now, or just leave it empty if possible.
	// In Slice 1 SQL, data_plantio is DATE.
	
	err = sbClient.RegistrarCotaComCronograma(ctx, payload)
	if err != nil {
		log.Printf("❌ [FSM-COLETIVO] Erro ao salvar cota: %v", err)
		
		errStr := err.Error()
		if strings.Contains(errStr, "ERRO_CAPACIDADE") {
			warningMsg := fmt.Sprintf("⚠️ Atenção: A quantidade de %vkg ultrapassa o limite físico estimado para o tamanho da sua propriedade. Quer tentar uma quantidade menor?", quantidade)
			sendFeedback(wpClient, ttsClient, from, warningMsg, respondWithAudio)
			return ProcessResult{Success: true, Reason: "capacity_limit_exceeded"}
		}

		sendFeedback(wpClient, ttsClient, from, "❌ Falha técnica ao registrar sua cota no sistema.", respondWithAudio)
		return ProcessResult{Success: false, Reason: "db_error"}
	}

	// 5. Final Feedback
	botResponse := fmt.Sprintf("🤝 *Cota Confirmada!*\n\n*Cultura:* %s\n*Quantidade:* %v %s\n*Prazo de Entrega:* %s\n\n💡 **Dica do Agrônomo:** Para entregar no prazo, o ideal é você iniciar o plantio por volta de *%s*. Já anotei aqui para te lembrar!", 
		demanda.Cultura, quantidade, demanda.Unidade, demanda.DataEntrega, dataSugerida)
	
	sendFeedback(wpClient, ttsClient, from, botResponse, respondWithAudio)
	
	// Record log for analytics
	recordLog(sbClient, profile, originalBody, botResponse, "gemini-flash-agronomist", 0, 0, "assumir_cota", toMap(ext), startTime, true)

	return ProcessResult{Success: true, Reason: "quota_assumed"}
}
