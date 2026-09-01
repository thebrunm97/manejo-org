package telemetry

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	WebhookRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "webhook_requests_total",
			Help: "Total number of webhook requests processed",
		},
		[]string{"status", "source"},
	)

	// RateLimitDecisionsTotal conta os vereditos do rate limiter de entrada.
	//
	// O label 'outcome' tem três valores: allowed, throttled e error. 'error' é
	// o mais importante de alertar: significa Redis fora do ar e, por contrato
	// (ports.RateLimiter), tráfego passando sem proteção nenhuma.
	RateLimitDecisionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rate_limit_decisions_total",
			Help: "Count of inbound rate limiter decisions by scope and outcome",
		},
		[]string{"scope", "outcome"},
	)

	WorkerPoolQueueSize = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "worker_pool_queue_size",
			Help: "Current size of the worker pool queue",
		},
	)

	RagLatencyMS = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "rag_latency_ms",
			Help:    "Latency of RAG pipeline phases in milliseconds",
			Buckets: prometheus.ExponentialBuckets(100, 2, 8), // 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, 6400ms, 12800ms
		},
		[]string{"phase"},
	)

	ResponseModeResolutionTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "response_mode_resolution_total",
			Help: "Count of response mode resolutions for audio/TTS pipeline",
		},
		[]string{"source", "resolved_mode", "fallback"},
	)

	ResponseModeLegacyFallbackTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "response_mode_legacy_fallback_total",
			Help: "Count of times the legacy audio fallback was used",
		},
	)

	TTSFallbackStarvationTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "tts_fallback_starvation_total",
			Help: "Count of times TTS was downgraded to text due to saturation/timeout",
		},
	)

	// WhatsAppConnected é 1 quando a sessão está de pé e 0 quando caiu.
	//
	// É a métrica mais importante da operação: é sobre ela que um Prometheus
	// externo vai alertar quando a stack sair do desktop (DT-38). Em 2026-08-23
	// a sessão ficou fora 24min (DT-52) e depois 36min sem que nada além do log
	// registrasse — um gauge 0/1 é o que torna isso alertável.
	WhatsAppConnected = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "whatsapp_connected",
			Help: "1 when the WhatsApp session is connected, 0 when it is down",
		},
	)

	// AlertsSentTotal conta tentativas de alerta fora de banda (DT-53).
	//
	// O label status distingue "suprimido" de "erro" de propósito: supressão por
	// cooldown é o mecanismo funcionando, e contá-la como falha faria o painel
	// parecer quebrado justamente quando está certo.
	AlertsSentTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "alerts_sent_total",
			Help: "Out-of-band alert attempts by channel, severity and outcome",
		},
		[]string{"canal", "severidade", "status"},
	)

	// SelfHealAttemptsTotal conta tentativas de reconexão automática (DT-53).
	// O label resultado distingue "falhou" de "inconclusivo" (contexto
	// cancelado no meio da verificação) de propósito — os dois pedem
	// investigação diferente.
	SelfHealAttemptsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "self_heal_attempts_total",
			Help: "Automatic reconnection attempts by method and outcome",
		},
		[]string{"metodo", "resultado"},
	)

	// SelfHealExhaustedTotal conta incidentes em que o healer esgotou as
	// tentativas dentro de um único ciclo (antes do cooldown).
	SelfHealExhaustedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "self_heal_exhausted_total",
			Help: "Count of incidents where self-heal exhausted its attempt budget",
		},
	)

	// MessageBufferMergedTotal conta fragmentos absorvidos pelo dreno de
	// claim_next_message_job (DT-68) — não conta o job pai, só os irmãos
	// fundidos nele. Zero permanente com MESSAGE_BUFFER_WINDOW=0 é esperado
	// (kill-switch) e não indica bug.
	MessageBufferMergedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "message_buffer_merged_total",
			Help: "Count of message_queue jobs absorbed by buffer coalescing (DT-68)",
		},
	)

	// MessageBufferPartsPerTurn mede quantos fragmentos compõem cada turno de
	// IA. A métrica que valida o recurso: cauda > 1 significativa confirma que
	// mensagens picotadas de fato estão sendo agrupadas.
	MessageBufferPartsPerTurn = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "message_buffer_parts_per_turn",
			Help:    "Number of message fragments coalesced into a single AI turn (DT-68)",
			Buckets: []float64{1, 2, 3, 4, 5, 8, 12},
		},
	)

	// MessageBufferAddedLatencySeconds mede, só para turnos com parts_count > 1,
	// o tempo entre o primeiro fragmento chegar (created_at) e o turno
	// combinado ser reivindicado — a espera real que a coalescência introduziu.
	MessageBufferAddedLatencySeconds = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "message_buffer_added_latency_seconds",
			Help:    "Wait introduced by buffer coalescing before a merged turn was claimed (DT-68)",
			Buckets: []float64{1, 2, 4, 6, 8, 12, 16},
		},
	)
)
