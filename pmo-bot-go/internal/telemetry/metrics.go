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
)
