package queue

import (
	"log/slog"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
)

// LogResponseModeDecision emits structured logs and metrics for auditability.
//
// Mantida por compatibilidade: equivale a registrar sem preferência conhecida.
func LogResponseModeDecision(jobID string, msg ports.IncomingMessage, resolved bool, fallbackUsed bool) {
	LogResponseModeDecisionFor(jobID, msg, ports.PreferenceAuto, resolved, fallbackUsed)
}

// LogResponseModeDecisionFor registra a decisão de formato e a sua ORIGEM.
//
// ATENÇÃO ao mover a chamada: a origem é derivada dos campos de `msg`, então
// esta função precisa ser chamada ANTES de o pipeline marcar o modo como
// explícito. Chamada depois, toda decisão vira `explicit` — que é o que o
// próprio pipeline acabou de escrever, não a causa real.
//
// A origem é o que permite responder "quantos produtores de fato escolheram
// texto?", número que falta para dimensionar a VPS (DT-38) e que é o retorno
// medível do DT-29.
func LogResponseModeDecisionFor(jobID string, msg ports.IncomingMessage, pref ports.ResponsePreference, resolved bool, fallbackUsed bool) {
	source := responseModeSource(msg, pref)

	resolvedMode := "text"
	if resolved {
		resolvedMode = "audio"
	}

	slog.Info("response mode resolved",
		slog.String("job_id", jobID),
		slog.Bool("is_audio", msg.IsAudio),
		slog.Bool("respond_with_audio_present", msg.HasExplicitResponseMode),
		slog.Bool("respond_with_audio_value", msg.RespondWithAudio),
		slog.String("preference", string(pref)),
		slog.String("resolved_mode", resolvedMode),
		slog.Bool("legacy_fallback_used", fallbackUsed),
		slog.String("source", source),
	)

	telemetry.ResponseModeResolutionTotal.WithLabelValues(source, resolvedMode, boolToString(fallbackUsed)).Inc()
	if fallbackUsed {
		telemetry.ResponseModeLegacyFallbackTotal.Inc()
	}
}

// responseModeSource espelha a precedência de ShouldRespondWithAudioFor.
// Se uma das duas mudar, a outra precisa mudar junto — caso contrário a
// métrica passa a atribuir a decisão à causa errada, em silêncio.
func responseModeSource(msg ports.IncomingMessage, pref ports.ResponsePreference) string {
	switch {
	case msg.HasExplicitResponseMode:
		return "explicit"
	case pref == ports.PreferenceText:
		return "preference_text"
	case pref == ports.PreferenceAudio:
		return "preference_audio"
	case msg.RespondWithAudio:
		return "legacy_payload"
	case msg.IsAudio:
		return "legacy_audio"
	default:
		return "default"
	}
}

func boolToString(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
