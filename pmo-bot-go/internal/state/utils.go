package state

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/pricing"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

const (
	StateInitial              = ""
	StateAguardandoQuantidade = "aguardando_quantidade"
	StateAguardandoCompra     = "aguardando_compra"
	StateAguardandoFazenda    = "aguardando_fazenda"
	StateAguardandoRateio     = "aguardando_rateio"
)

// sendFeedback responde ao produtor via WhatsApp, em texto e/ou áudio.
//
// O texto é SEMPRE enviado, mesmo quando há áudio: o produtor pode estar em
// lugar onde não dá para ouvir, e sem o texto a resposta seria inacessível. O
// áudio é um acréscimo, nunca um substituto — por isso ele vai primeiro (chega
// como a resposta "principal") e o texto logo em seguida, como apoio.
//
// Consequência importante: uma falha no TTS deixou de ser um caminho de erro.
// Antes exigia um fallback explícito para texto; agora o texto já está garantido
// e a falha apenas degrada a experiência, sem perder a resposta.
func sendFeedback(sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient ports.Synthesizer, from string, message string, respondWithAudio bool) error {
	// O texto é o canal garantido e vai primeiro: a síntese leva dezenas de
	// segundos, e mandar o áudio antes deixaria o produtor sem resposta nesse
	// intervalo — ou sem nenhuma, se o TTS falhasse.
	err := wpClient.SendMessage(from, message)

	if respondWithAudio && ttsClient != nil {
		// Sem sanitizar, o motor lê a formatação ("asterisco asterisco Consulta
		// Técnica") e narra o nome de cada emoji. A mensagem escrita acima
		// mantém a formatação intacta; só o áudio usa a versão limpa.
		spoken := utils.SanitizeForSpeech(message)
		if strings.TrimSpace(spoken) == "" {
			return err
		}

		log.Printf("🔊 [FSM] Gerando áudio para resposta...")
		ttsCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		defer cancel()

		// Decide ANTES de sintetizar se o texto pode sair para um provedor
		// externo. O roteador recusa mandar requisição sensível para a nuvem,
		// mas só consegue fazê-lo se este campo for preenchido de verdade.
		sensitive, reason := guardrails.ClassifySpeechSensitivity(spoken)
		if sensitive {
			log.Printf("🔒 [FSM] TTS restrito ao provedor local (motivo=%s)", reason)
		}

		req := ports.SynthesisRequest{
			Text:      spoken,
			Sensitive: sensitive,
		}
		art, errSpeech := ttsClient.Synthesize(ttsCtx, req)
		if errSpeech != nil {
			if errors.Is(errSpeech, ports.ErrSynthesizerSaturated) {
				telemetry.TTSFallbackStarvationTotal.Inc()
				log.Printf("⚠️ [FSM] TTS Fallback triggered due to starvation — to=%s", from)
			} else {
				log.Printf("⚠️ [FSM] Falha no TTS, texto já foi entregue: %v", errSpeech)
			}
		} else {
			b64 := base64.StdEncoding.EncodeToString(art.Data)
			if errVoice := wpClient.SendVoice(from, b64, true); errVoice != nil {
				log.Printf("⚠️ [FSM] Falha ao enviar áudio, texto já foi entregue: %v", errVoice)
			} else {
				log.Printf("✅ [FSM] Áudio enviado (%s, %s, %d bytes)", art.Source, art.Format, len(art.Data))
			}
		}
	}

	// Persist outgoing assistant message in a non-blocking goroutine
	if sbClient != nil && message != "" {
		go func() {
			phone, _ := sbClient.ResolvePhone(from)
			if phone != "" {
				dbCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = sbClient.InsertMessage(dbCtx, supabase.MessageInsert{
					Phone:   phone,
					Content: message,
					Role:    "assistant",
				})
			}
		}()
	}

	return err
}

// CalculateAICost estima o custo em USD de uma chamada ao LLM.
//
// Delega ao catálogo multi-fornecedor em internal/pricing, gerado por
// cmd/pricing-refresh a partir de uma fonte pública e verificável.
//
// A implementação anterior era um `switch` com preços digitados à mão e tinha
// dois defeitos que tornavam o relatório de custo inutilizável:
//
//  1. Os valores estavam defasados. Cobrava gemini-3.1-flash-lite a
//     US$0,075/US$0,30 por 1M quando o preço real é US$0,250/US$1,500 —
//     subestimando a entrada em 3,3x e a saída em 5x.
//  2. Retornava ZERO para qualquer modelo fora da família Gemini. Desde que o
//     sistema passou a escalar para a OpenRouter, todo o gasto do fallback
//     simplesmente não aparecia.
//
// Modelo desconhecido agora recebe uma estimativa conservadora (cara), não
// zero: subestimar custo desconhecido induz a decisão errada de arquitetura,
// enquanto superestimar apenas provoca uma conferência.
func CalculateAICost(model string, pTokens, cTokens int) float64 {
	est := pricing.Cost(model, pTokens, cTokens)
	if !est.Exact && model != "" {
		log.Printf("⚠️ [Custo] Modelo %q ausente do catálogo — usando estimativa conservadora. Rode `go run ./cmd/pricing-refresh` para atualizar.", model)
	}
	return est.CostUSD
}

// recordLog is a helper to centralize all logging to Supabase (Telemetry + Process Log)
func recordLog(sbClient ports.LogPersister, profile *supabase.Profile, msgIn string, msgOut string, modelConfigured string, modelEffective string, pTokens int, cTokens int, intent string, extraction map[string]interface{}, startTime time.Time, success bool, raciocinio interface{}) {
	if sbClient == nil || profile == nil {
		return
	}
	if c, ok := sbClient.(*supabase.Client); ok && c == nil {
		return
	}

	go func() {
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

		// 3. Log de Treinamento (Feedback Loop) - Garante que mesmo sem extração estruturada, o log exista
		if success {
			finalExtraction := extraction
			if finalExtraction == nil {
				// Synth extraction for RAG/Doubts
				finalExtraction = map[string]interface{}{
					"intent": intent,
					"query":  msgIn,
				}
			}

			_ = sbClient.InsertLogTreinamento(supabase.LogTreinamentoInsert{
				PmoID:         pmoIDPtr,
				UserID:        profile.ID,
				TextoUsuario:  msgIn,
				JsonExtraido:  finalExtraction,
				TipoAtividade: intent,
				ModeloIA:      modelEffective,
			})
		}
	}()
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
