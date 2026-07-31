package queue

import (
	"log/slog"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
)

// LogResponseModeDecision emits structured logs and metrics for auditability.
func LogResponseModeDecision(jobID string, msg ports.IncomingMessage, resolved bool, fallbackUsed bool) {
	var source string
	var resolvedMode string
	if msg.HasExplicitResponseMode {
		source = "explicit"
	} else if msg.RespondWithAudio {
		source = "legacy_payload"
	} else if msg.IsAudio {
		source = "legacy_audio"
	} else {
		source = "default"
	}

	if resolved {
		resolvedMode = "audio"
	} else {
		resolvedMode = "text"
	}

	slog.Info("response mode resolved",
		slog.String("job_id", jobID),
		slog.Bool("is_audio", msg.IsAudio),
		slog.Bool("respond_with_audio_present", msg.HasExplicitResponseMode),
		slog.Bool("respond_with_audio_value", msg.RespondWithAudio),
		slog.String("resolved_mode", resolvedMode),
		slog.Bool("legacy_fallback_used", fallbackUsed),
		slog.String("source", source),
	)

	telemetry.ResponseModeResolutionTotal.WithLabelValues(source, resolvedMode, boolToString(fallbackUsed)).Inc()
	if fallbackUsed {
		telemetry.ResponseModeLegacyFallbackTotal.Inc()
	}
}

func boolToString(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
