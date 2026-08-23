package queue

// delivery.go — Camada 5 do Harness de Produção.
//
// Responsável por garantir que o usuário SEMPRE receba a resposta,
// mesmo em falhas transientes de rede ou TTS.
//
// Estratégia de Retry:
//   - 3 tentativas com backoff linear (1s, 3s, 5s)
//   - O TEXTO é o canal garantido e é o que decide sucesso/retry
//   - O ÁUDIO é um acréscimo best-effort, tentado uma única vez e nunca repetido
//   - Nunca propaga erro para o caller principal (falha de entrega ≠ falha de processamento)

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// DeliveryConfig configura o comportamento de entrega e retry.
type DeliveryConfig struct {
	MaxAttempts int             // Default: 3
	Backoff     []time.Duration // Default: [1s, 3s, 5s]
}

// defaultDeliveryConfig retorna a configuração padrão de entrega.
func defaultDeliveryConfig() DeliveryConfig {
	return DeliveryConfig{
		MaxAttempts: 3,
		Backoff:     []time.Duration{1 * time.Second, 3 * time.Second, 5 * time.Second},
	}
}

// SendWithRetry entrega a resposta ao usuário com backoff.
//
// Quando asAudio está ativo, o produtor recebe áudio E texto: o áudio como
// resposta principal e o texto logo em seguida, para quem não pode ouvir. Uma
// falha no TTS ou no envio do áudio degrada a experiência mas não a entrega —
// o texto continua garantido.
func SendWithRetry(ctx context.Context, wp ports.MessageSender, ttsClient ports.Synthesizer, to, msg string, asAudio bool) error {
	cfg := defaultDeliveryConfig()
	return sendWithConfig(ctx, wp, ttsClient, to, msg, asAudio, cfg)
}

// sendWithConfig é a implementação interna testável.
func sendWithConfig(ctx context.Context, wp ports.MessageSender, ttsClient ports.Synthesizer, to, msg string, asAudio bool, cfg DeliveryConfig) error {
	var lastErr error
	currentAsAudio := asAudio

	for attempt := 0; attempt < cfg.MaxAttempts; attempt++ {
		select {
		case <-ctx.Done():
			return fmt.Errorf("delivery: contexto cancelado após %d tentativas", attempt)
		default:
		}

		// O TEXTO vai primeiro, de propósito: a síntese no Piper leva dezenas de
		// segundos e, se o áudio fosse enviado antes, o produtor ficaria sem
		// resposta nenhuma nesse intervalo — e sem nada caso o TTS falhasse.
		// Com o texto na frente, a resposta chega imediatamente e o áudio é um
		// complemento que chega depois.
		err := wp.SendMessage(to, msg)

		if err == nil {
			if attempt > 0 {
				log.Printf("✅ [Delivery] Entregue na tentativa %d to=%s", attempt+1, to)
			}

			// Áudio é best-effort e só depois do texto garantido. Fica dentro do
			// bloco de sucesso para nunca ser enviado mais de uma vez, mesmo que
			// o texto tenha exigido retries.
			if currentAsAudio && ttsClient != nil {
				if errAudio := sendAsAudio(ctx, wp, ttsClient, to, msg); errAudio != nil {
					if errors.Is(errAudio, ports.ErrSynthesizerSaturated) {
						telemetry.TTSFallbackStarvationTotal.Inc()
						log.Printf("⚠️ [Delivery] TTS Fallback triggered due to starvation — to=%s", to)
					} else {
						log.Printf("⚠️  [Delivery] Áudio falhou (texto já entregue): %v — to=%s", errAudio, to)
					}
				}
			}
			return nil
		}

		lastErr = err
		log.Printf("⚠️  [Delivery] Tentativa %d/%d falhou: %v — to=%s",
			attempt+1, cfg.MaxAttempts, err, to)

		// Aguarda backoff antes da próxima tentativa (não aguarda na última)
		if attempt < cfg.MaxAttempts-1 && attempt < len(cfg.Backoff) {
			select {
			case <-ctx.Done():
				return fmt.Errorf("delivery: contexto cancelado durante backoff")
			case <-time.After(cfg.Backoff[attempt]):
			}
		}
	}

	// Todas as tentativas falharam — loga mas não propaga erro catastrófico
	// O processamento foi bem-sucedido; apenas a entrega falhou.
	log.Printf("❌ [Delivery] Falha permanente após %d tentativas to=%s: %v",
		cfg.MaxAttempts, to, lastErr)
	return fmt.Errorf("delivery: falhou após %d tentativas: %w", cfg.MaxAttempts, lastErr)
}

// sendAsAudio tenta enviar a resposta como áudio via TTS.
func sendAsAudio(ctx context.Context, wp ports.MessageSender, ttsClient ports.Synthesizer, to, text string) error {
	if ttsClient == nil {
		return fmt.Errorf("tts_client_nil")
	}

	// O Piper roda em CPU e leva ~15-30s numa resposta longa. Como o texto já
	// foi entregue neste ponto, podemos esperar com folga sem prejudicar o
	// produtor — um teto apertado só produziria áudio perdido por timeout.
	ttsCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	// Sem isto o motor lê a formatação em voz alta ("asterisco asterisco
	// Consulta Técnica") e narra o nome de cada emoji.
	spoken := utils.SanitizeForSpeech(text)
	if strings.TrimSpace(spoken) == "" {
		return fmt.Errorf("tts_empty_after_sanitize")
	}

	// O formato concreto (mp3/wav/ogg) depende do provider configurado; o
	// evolution-go detecta e reconverte para Opus, então aqui basta repassar.
	req := ports.SynthesisRequest{
		Text:      spoken,
		Sensitive: false, // Default false, deve ser sobreescrito pelo handler
	}
	art, err := ttsClient.Synthesize(ttsCtx, req)
	if err != nil {
		return fmt.Errorf("tts_synthesis_failed: %w", err)
	}

	audioBase64 := base64.StdEncoding.EncodeToString(art.Data)

	// Força `ptt: true` para garantir que o cliente leia como voice note (microfone azul)
	if err := wp.SendVoice(to, audioBase64, true); err != nil {
		return fmt.Errorf("send_voice_failed: %w", err)
	}
	return nil
}
