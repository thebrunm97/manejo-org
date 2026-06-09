// Package guardrails implements a defensive, multi-layer AI security framework
// for the pmo-bot-go backend. It enforces Policy-as-Code across four pillars:
//
//  1. Input Validation   — PII scrubbing + Prompt Injection detection
//  2. Tool Guardrails    — Human-in-the-Loop for high-risk mutations (HITL)
//  3. Output Governance  — LLM-as-a-Judge content policy enforcement
//  4. Observability      — Structured audit trail for the React dashboard
//
// The package is intentionally kept in internal/ to prevent export of
// security-sensitive logic. All types follow fail-open semantics:
// if a guardrail itself errors, the request proceeds and the anomaly is logged.
package guardrails

import (
	"context"
	"time"
)

// ─── Verdict ─────────────────────────────────────────────────────────────────

// ViolationDetail describes a single policy infraction detected by a filter.
type ViolationDetail struct {
	Rule       string  `json:"rule"`       // e.g. "pii_cpf", "injection_ignore"
	Severity   string  `json:"severity"`   // "low", "medium", "high", "critical"
	Match      string  `json:"match"`      // triggering text (safely truncated)
	Confidence float64 `json:"confidence"` // 0.0–1.0
}

// FilterVerdict is the result returned by a single filter run.
// A blocked verdict short-circuits the pipeline — no further filters run.
type FilterVerdict struct {
	Blocked    bool              `json:"blocked"`
	Reason     string            `json:"reason,omitempty"`
	RiskScore  float64           `json:"risk_score"` // 0.0–1.0 aggregate
	Redacted   string            `json:"redacted"`   // input with PII masked (may be empty)
	Violations []ViolationDetail `json:"violations,omitempty"`
}

// ─── Core Interfaces ─────────────────────────────────────────────────────────

// InputFilter is the single interface every pipeline stage must implement.
// Filters receive the current input (possibly redacted by previous filters)
// and return their verdict.  They MUST NOT mutate shared state.
type InputFilter interface {
	// Name returns a stable, human-readable identifier for observability.
	Name() string
	// Run evaluates the input and returns a verdict.
	Run(ctx context.Context, input string) FilterVerdict
}

// ─── Observability ───────────────────────────────────────────────────────────

// GuardrailEvent is the structured audit record emitted by every guardrail layer.
// It is stored in the guardrail_events Supabase table for dashboard consumption.
type GuardrailEvent struct {
	ID         string                 `json:"id"`
	Timestamp  time.Time              `json:"timestamp"`
	Layer      string                 `json:"layer"`       // "input" | "tool" | "output"
	FilterName string                 `json:"filter_name"` // stable filter identifier
	Phone      string                 `json:"phone,omitempty"`
	JobID      string                 `json:"job_id,omitempty"`
	Verdict    FilterVerdict          `json:"verdict"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// ViolationLogger persists GuardrailEvents for audit and dashboard display.
// Implementations MUST be non-blocking (fire-and-forget via goroutine is fine).
type ViolationLogger interface {
	LogViolation(ctx context.Context, event GuardrailEvent)
}

// ─── No-Op Logger (safe default for tests / legacy mode) ─────────────────────

// NoOpLogger is a ViolationLogger that silently discards all events.
// Use in tests or when the Supabase logger is unavailable.
type NoOpLogger struct{}

func (NoOpLogger) LogViolation(_ context.Context, _ GuardrailEvent) {}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// SeverityFromScore maps a confidence score to a human-readable severity label.
func SeverityFromScore(score float64) string {
	switch {
	case score >= 0.9:
		return "critical"
	case score >= 0.7:
		return "high"
	case score >= 0.4:
		return "medium"
	default:
		return "low"
	}
}

// min returns the smaller of a and b (works for any ordered type).
func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// minInt returns the smaller of a and b for int.
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
