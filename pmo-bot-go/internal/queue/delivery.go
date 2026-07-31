package queue

// delivery.go — Camada 5 do Harness de Produção.
//
// Responsável por garantir que o usuário SEMPRE receba a resposta,
// mesmo em falhas transientes de rede ou TTS.
//
// Estratégia de Retry:
//   - 3 tentativas com backoff linear (1s, 3s, 5s)
//   - Fallback automático: TTS falhou na tentativa 2 → degrada para texto
//   - Nunca propaga erro para o caller principal (falha de entrega ≠ falha de processamento)

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
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

// SendWithRetry tenta entregar a resposta ao usuário com backoff e fallback.
//
// Política de fallback TTS→Texto:
//   Na tentativa 2, se a mensagem era para ser áudio e TTS falhou,
//   degrada silenciosamente para envio de texto na próxima tentativa.
//   O usuário recebe a resposta (mesmo que em formato diferente).
func SendWithRetry(ctx context.Context, wp ports.MessageSender, ttsClient *tts.Orchestrator, to, msg string, asAudio bool) error {
	cfg := defaultDeliveryConfig()
	return sendWithConfig(ctx, wp, ttsClient, to, msg, asAudio, cfg)
}

// sendWithConfig é a implementação interna testável.
func sendWithConfig(ctx context.Context, wp ports.MessageSender, ttsClient *tts.Orchestrator, to, msg string, asAudio bool, cfg DeliveryConfig) error {
	var lastErr error
	currentAsAudio := asAudio

	for attempt := 0; attempt < cfg.MaxAttempts; attempt++ {
		select {
		case <-ctx.Done():
			return fmt.Errorf("delivery: contexto cancelado após %d tentativas", attempt)
		default:
		}

		var err error
		if currentAsAudio && ttsClient != nil {
			err = sendAsAudio(ctx, wp, ttsClient, to, msg)
		} else {
			err = wp.SendMessage(to, msg)
		}

		if err == nil {
			if attempt > 0 {
				log.Printf("✅ [Delivery] Entregue na tentativa %d (áudio=%v) to=%s",
					attempt+1, currentAsAudio, to)
			}
			return nil
		}

		lastErr = err
		log.Printf("⚠️  [Delivery] Tentativa %d/%d falhou (áudio=%v): %v — to=%s",
			attempt+1, cfg.MaxAttempts, currentAsAudio, err, to)

		// Fallback de TTS na tentativa 2: degrada para texto
		if currentAsAudio && attempt == 1 {
			log.Printf("🔄 [Delivery] Degradando TTS→Texto (attempt=%d)", attempt+1)
			currentAsAudio = false
		}

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
func sendAsAudio(ctx context.Context, wp ports.MessageSender, ttsClient *tts.Orchestrator, to, text string) error {
	if ttsClient == nil {
		return fmt.Errorf("tts_client_nil")
	}

	ttsCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	// GenerateSpeech returns raw MP3 bytes
	audioBytes, err := ttsClient.GenerateSpeech(ttsCtx, text)
	if err != nil {
		return fmt.Errorf("tts_synthesis_failed: %w", err)
	}

	audioBase64 := base64.StdEncoding.EncodeToString(audioBytes)

	// Força `ptt: true` para garantir que o cliente leia como voice note (microfone azul)
	if err := wp.SendVoice(to, audioBase64, true); err != nil {
		return fmt.Errorf("send_voice_failed: %w", err)
	}
	return nil
}
