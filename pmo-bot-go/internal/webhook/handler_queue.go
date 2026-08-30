package webhook

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
)

// ProcessMessageFromQueue implements the same logic as handleWebhook but for messages
// pulled directly from a message queue (like RabbitMQ) rather than an HTTP webhook.
func (h *Handler) ProcessMessageFromQueue(ctx context.Context, payload *ports.IncomingMessage, rawBody []byte) error {
	// 4. Self-message filter
	if payload.IsFromMe {
		return nil
	}

	// 5. TTL check
	age := time.Since(payload.Timestamp).Seconds()
	if age > h.cfg.MaxMessageAge {
		log.Printf("⏳ TTL DROP: Mensagem de %.1fs atrás ignorada (Max: %.1fs)", age, h.cfg.MaxMessageAge)
		h.sendDebouncedWarning(ctx, payload.From)
		return nil
	}

	// 7. Skip non-text messages if not audio or image
	if payload.Body == "" && !payload.IsAudio && !payload.IsImage {
		return nil
	}

	// 8. Session-Level Mutex & Message Deduplication
	msgID := payload.ID
	if msgID != "" {
		if _, loaded := processedMu.LoadOrStore(msgID, time.Now()); loaded {
			return nil
		}

		rawPayloadID, err := h.cfg.SupabaseClient.InsertRawPayload(ctx, msgID, rawBody, "whatsapp_evolution")
		if err != nil {
			if errors.Is(err, supabase.ErrDuplicateMessage) {
				return nil
			}
			log.Printf("⚠️ [DEDUP] Falha ao persistir payload bruto (Queue): %v. Prosseguindo.", err)
		} else {
			payload.RawPayloadID = rawPayloadID
		}
	}

	// 9. Rate limiting por produtor
	if decision, err := h.cfg.InboundLimiter.Allow(ctx, payload.From); err != nil {
		telemetry.RateLimitDecisionsTotal.WithLabelValues("phone", "error").Inc()
	} else if !decision.Allowed {
		telemetry.RateLimitDecisionsTotal.WithLabelValues("phone", "throttled").Inc()
		telemetry.WebhookRequestsTotal.WithLabelValues("rate_limited", "evolution").Inc()
		log.Printf("🚦 [RATELIMIT] %s excedeu a cota", payload.From)
		h.sendDebouncedWarning(ctx, payload.From)
		return fmt.Errorf("rate limited, retry after %f", decision.RetryAfter.Seconds())
	} else {
		telemetry.RateLimitDecisionsTotal.WithLabelValues("phone", "allowed").Inc()
	}

	// HITL
	if h.cfg.HITLController != nil && !payload.IsAudio && !payload.IsImage {
		verdict := ClassifyHITLResponse(payload.Body)
		if verdict != HITLVerdictAmbiguous {
			if h.handleHITLResponse(payload.From, verdict) {
				return nil
			}
		}
	}

	// Dispatch: Harness vs Legado
	if h.cfg.HarnessQueue != nil {
		enqueueCtx, enqueueCancel := context.WithTimeout(ctx, 5*time.Second)
		defer enqueueCancel()

		if err := h.cfg.HarnessQueue.Enqueue(enqueueCtx, *payload); err != nil {
			log.Printf("❌ [QUEUE] Falha ao enfileirar mensagem %s: %v — falling back to legacy", payload.ID, err)
			if errPool := h.legacyPool.Enqueue(*payload); errPool != nil {
				if errors.Is(errPool, ErrQueueFull) {
					h.sendDebouncedWarning(ctx, payload.From)
					return errPool
				}
			}
		}
	} else {
		if errPool := h.legacyPool.Enqueue(*payload); errPool != nil {
			if errors.Is(errPool, ErrQueueFull) {
				h.sendDebouncedWarning(ctx, payload.From)
				return errPool
			}
		}
	}

	telemetry.WebhookRequestsTotal.WithLabelValues("success", "rabbitmq").Inc()
	slog.Info("RabbitMQ Message Processed",
		slog.String("msg_id", payload.ID),
		slog.String("from", payload.From),
	)

	return nil
}
