package utils

import (
	"log"
	"time"
)

// TraceLatency is a helper function to log execution time.
// Usage: defer utils.TraceLatency("FunctionName", time.Now())
func TraceLatency(name string, start time.Time) {
	elapsed := time.Since(start)
	log.Printf("⏱️ [TRACING] %s: %v", name, elapsed)
}
