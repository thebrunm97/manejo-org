package state

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

const (
	StateInitial              = ""
	StateAguardandoQuantidade = "aguardando_quantidade"
	StateAguardandoCompra     = "aguardando_compra"
	StateAguardandoRateio     = "aguardando_rateio"
)

// sendFeedback encapsulates the logic of responding to the user via WhatsApp and/or TTS
func sendFeedback(wpClient ports.MessageSender, ttsClient *tts.Orchestrator, from string, message string, respondWithAudio bool) error {
	if respondWithAudio && ttsClient != nil {
		log.Printf("🔊 [FSM] Gerando áudio para resposta...")
		audioURL, err := ttsClient.GenerateSpeech(context.Background(), message)
		if err == nil {
			return wpClient.SendVoice(from, audioURL, false)
		}
		log.Printf("⚠️ [FSM] Falha no TTS, enviando texto como fallback: %v", err)
	}
	return wpClient.SendMessage(from, message)
}

// CalculateAICost returns the estimated cost in USD based on model and token usage
func CalculateAICost(model string, pTokens, cTokens int) float64 {
	// Reference prices per 1M tokens
	var inputPrice, outputPrice float64

	m := strings.ToLower(model)
	switch {
	case strings.Contains(m, "gemini-3.1") || strings.Contains(m, "flash-lite"):
		// Flash Lite is generally cheaper, but using Flash baseline for safety
		inputPrice = 0.075
		outputPrice = 0.30
	case strings.Contains(m, "gemini-2.0") || strings.Contains(m, "gemini-2.5") || strings.Contains(m, "flash"):
		inputPrice = 0.10
		outputPrice = 0.40
	case strings.Contains(m, "groq"):
		inputPrice = 0.05
		outputPrice = 0.05
	default:
		// Default to 1.5-flash prices if unknown but clearly Gemini
		if strings.Contains(m, "gemini") {
			inputPrice = 0.075
			outputPrice = 0.30
		} else {
			return 0
		}
	}

	cost := (float64(pTokens)/1000000.0)*inputPrice + (float64(cTokens)/1000000.0)*outputPrice
	return cost
}

// recordLog is a helper to centralize all logging to Supabase (Telemetry + Process Log)
func recordLog(sbClient *supabase.Client, profile *supabase.Profile, msgIn string, msgOut string, modelConfigured string, modelEffective string, pTokens int, cTokens int, intent string, extraction map[string]interface{}, startTime time.Time, success bool, raciocinio interface{}) {
	if sbClient == nil || profile == nil {
		return
	}

	duration := time.Since(startTime).Milliseconds()
	custo := CalculateAICost(modelEffective, pTokens, cTokens)

	// 1. Log de Processamento (Audit)
	var pmoIDPtr *int64
	if profile.PmoAtivoID > 0 {
		val := profile.PmoAtivoID
		pmoIDPtr = &val
	}

	_ = sbClient.InsertLogProcessamento(supabase.LogProcessamentoInsert{
		PmoID:             pmoIDPtr,
		MensagemUsuario:   msgIn,
		RespostaBot:       msgOut,
		ModeloConfigurado: modelConfigured,
		ModeloEfetivo:     modelEffective,
		TokensPrompt:      pTokens,
		TokensCompletion:  cTokens,
		Intencao:          intent,
		CustoDolar:        custo,
		RaciocinioAgente:  raciocinio,
	})

	// 2. Log de Consumo (Billing/Quota)
	_ = sbClient.InsertLogConsumo(supabase.LogConsumoInsert{
		UserID:           profile.ID,
		TokensPrompt:     pTokens,
		TokensCompletion: cTokens,
		TotalTokens:      pTokens + cTokens,
		ModeloIA:         modelEffective,
		Acao:             intent,
		CustoEstimado:    custo,
		Status:           "success",
		DuracaoMs:        duration,
	})

	// 3. Log de Treinamento (Feedback Loop) - Apenas se houver extração
	if extraction != nil && success {
		_ = sbClient.InsertLogTreinamento(supabase.LogTreinamentoInsert{
			PmoID:         pmoIDPtr,
			UserID:        profile.ID,
			TextoUsuario:  msgIn,
			JsonExtraido:  extraction,
			TipoAtividade: intent,
			ModeloIA:      modelEffective,
		})
	}
}

// parseToFloat captures both float64 and string from LLM interface{} output
func parseToFloat(val interface{}) float64 {
	switch v := val.(type) {
	case float64:
		return v
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	default:
		return 0
	}
}

// toMap converts a struct to a map[string]interface{} using JSON marshaling
func toMap(v interface{}) map[string]interface{} {
	var res map[string]interface{}
	b, _ := json.Marshal(v)
	_ = json.Unmarshal(b, &res)
	return res
}

// Blacklist de Termos Químicos (Apenas para Step 7 - Bloqueio Preventivo)
var blacklistCritica = []string{
	"GLIFOSATO", "ROUNDUP", "UREIA", "NPK", "QUIMICO", "VENENO", "AGROTOXICO", 
	"PARAQUAT", "MALATHION", "FIPRONIL", "IMIDACLOPRID", "DIMETOATO",
}

// isProibidoEscancarado returns true if the input contains any of the blacklist terms
func isProibidoEscancarado(input string) bool {
	upper := strings.ToUpper(strings.ReplaceAll(input, " ", ""))
	for _, term := range blacklistCritica {
		if strings.Contains(upper, term) {
			return true
		}
	}
	return false
}
