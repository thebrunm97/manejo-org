package guardrails

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"time"
)

// Pipeline executes a chain of InputFilters in sequence.
// It implements the Chain-of-Responsibility pattern:
//   - PII filters redact sensitive data and pass the clean text downstream.
//   - Blocking filters (e.g. injection detector) short-circuit the chain.
//   - All violations (even non-blocking) are logged for observability.
//
// Fail-Safe design: if a filter panics, the pipeline recovers, logs the error
// and treats the filter as non-blocking (fail-open per architecture decision).
type Pipeline struct {
	filters []InputFilter
	logger  ViolationLogger
}

// NewPipeline creates a Pipeline with the provided filters applied in order.
// Filters are applied LEFT-TO-RIGHT; the order matters because redaction
// from earlier filters is passed to later ones.
func NewPipeline(logger ViolationLogger, filters ...InputFilter) *Pipeline {
	if logger == nil {
		logger = NoOpLogger{}
	}
	return &Pipeline{
		filters: filters,
		logger:  logger,
	}
}

// PipelineResult holds the output of Pipeline.Execute.
type PipelineResult struct {
	CleanInput  string
	Blocked     bool
	BlockReason string
	RiskScore   float64
	Violations  []ViolationDetail
}

// Execute runs all filters sequentially against the input.
//
// Returns (cleanInput, result):
//   - cleanInput is the input after all redactions have been applied.
//   - result.Blocked=true means the input was rejected by a filter.
//
// The call is safe for concurrent use — each execution is fully independent.
func (p *Pipeline) Execute(ctx context.Context, input string, phone, jobID string) (string, PipelineResult) {
	current := input
	var allViolations []ViolationDetail
	maxRisk := 0.0

	for _, f := range p.filters {
		verdict := p.runSafe(ctx, f, current)

		// Accumulate risk score (highest wins)
		if verdict.RiskScore > maxRisk {
			maxRisk = verdict.RiskScore
		}

		// Collect all violations across all filters
		allViolations = append(allViolations, verdict.Violations...)

		// Emit structured audit event for every verdict with violations
		if len(verdict.Violations) > 0 || verdict.Blocked {
			p.logger.LogViolation(ctx, GuardrailEvent{
				ID:         newID(),
				Timestamp:  time.Now().UTC(),
				Layer:      "input",
				FilterName: f.Name(),
				Phone:      phone,
				JobID:      jobID,
				Verdict:    verdict,
			})
		}

		if verdict.Blocked {
			return "", PipelineResult{
				Blocked:     true,
				BlockReason: verdict.Reason,
				RiskScore:   verdict.RiskScore,
				Violations:  allViolations,
			}
		}

		// PII redaction: pass the sanitized text to the next filter
		if verdict.Redacted != "" {
			current = verdict.Redacted
		}
	}

	return current, PipelineResult{
		CleanInput: current,
		Blocked:    false,
		RiskScore:  maxRisk,
		Violations: allViolations,
	}
}

// runSafe wraps filter execution in a recover() to prevent panics from crashing the worker.
func (p *Pipeline) runSafe(ctx context.Context, f InputFilter, input string) (v FilterVerdict) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [Guardrail] Panic in filter '%s': %v — fail-open", f.Name(), r)
			v = FilterVerdict{Blocked: false, Reason: "filter_panic_fail_open"}
		}
	}()
	return f.Run(ctx, input)
}

// newID generates a cryptographically unique event ID using stdlib only.
func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(b)
}
