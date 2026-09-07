package telemetry

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	MemoryCacheFragmentsDiscarded = promauto.NewCounter(prometheus.CounterOpts{
		Name: "pmo_memory_cache_fragments_discarded_total",
		Help: "Total number of fragments discarded before cache insertion",
	})

	MemoryImportanceReasonTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pmo_memory_importance_reason_total",
		Help: "Total number of reasons matched during importance evaluation",
	}, []string{"reason"})

	MemoryImportanceScore = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "pmo_memory_importance_score",
		Help:    "Distribution of memory fragment importance scores",
		Buckets: prometheus.LinearBuckets(0, 0.1, 11),
	})

	MemoryCacheFragmentsWritten = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pmo_memory_cache_fragments_written_total",
		Help: "Total number of fragments written to cache (redis/supabase)",
	}, []string{"destination", "category"})

	MemoryCacheReadHits = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pmo_memory_cache_read_hits_total",
		Help: "Total number of read hits by layer",
	}, []string{"layer"})

	MemoryCacheRetriesTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pmo_memory_cache_retries_total",
		Help: "Total number of embedding retries processed by the cron job",
	}, []string{"status"})
)
