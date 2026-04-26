package guardrails

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"
)

// InjectionDetector is Layer-2 of the input pipeline.
// It detects Prompt Injection and Jailbreak attempts using a weighted
// heuristic scoring system — no external LLM call required, keeping
// average latency under 1ms for typical agricultural messages.
//
// Design:
//   - Each pattern has a fixed confidence weight (0.0–1.0).
//   - The detector accumulates the MAX single pattern score, not a sum,
//     to avoid false positives when innocuous phrases combine.
//   - Structural anomalies (extreme length, nested escape sequences)
//     add smaller additive penalty scores.
//   - Threshold defaults to 0.70; override via InjectionDetector.Threshold.
//
// If Blocked=true, the pipeline stops immediately and the message is rejected
// with a user-friendly notice.  No LLM token is consumed.
type InjectionDetector struct {
	// Threshold is the minimum score that triggers a block.
	// Defaults to 0.70 if zero.
	Threshold float64
}

// injectionPattern represents a single heuristic rule with its weight.
type injectionPattern struct {
	pattern  string  // substring to search (case-insensitive)
	weight   float64 // confidence contribution (0.0–1.0)
	rule     string  // policy rule code for audit log
}

// injectionPatterns covers the most common attack vectors against Ag-tech LLMs.
// Ordered roughly by severity (highest first for early exit potential).
var injectionPatterns = []injectionPattern{
	// ── Jailbreak signals ────────────────────────────────────────────────────
	{"JAILBREAK", 0.99, "injection_jailbreak"},
	{"DAN MODE", 0.99, "injection_jailbreak"},
	{"STAN MODE", 0.99, "injection_jailbreak"},
	{"EVIL MODE", 0.99, "injection_jailbreak"},
	{"DEVELOPER MODE", 0.95, "injection_jailbreak"},

	// ── Override / Persona hijack ────────────────────────────────────────────
	{"IGNORE PREVIOUS INSTRUCTIONS", 0.95, "injection_override"},
	{"IGNORE ALL PREVIOUS", 0.95, "injection_override"},
	{"IGNORE YOUR PREVIOUS", 0.90, "injection_override"},
	{"DISREGARD ALL PREVIOUS", 0.90, "injection_override"},
	{"FORGET YOUR INSTRUCTIONS", 0.95, "injection_override"},
	{"OVERRIDE YOUR INSTRUCTIONS", 0.90, "injection_override"},
	{"YOU ARE NOW", 0.80, "injection_persona"},
	{"ACT AS IF YOU HAVE NO RESTRICTIONS", 0.90, "injection_persona"},
	{"PRETEND YOU ARE", 0.65, "injection_persona"},
	{"ROLEPLAY AS", 0.55, "injection_persona"},

	// ── Prompt leak attacks ──────────────────────────────────────────────────
	{"REPEAT YOUR SYSTEM PROMPT", 0.90, "injection_leak"},
	{"SHOW ME YOUR INSTRUCTIONS", 0.85, "injection_leak"},
	{"PRINT YOUR PROMPT", 0.85, "injection_leak"},
	{"WHAT IS YOUR SYSTEM PROMPT", 0.80, "injection_leak"},
	{"REVEAL YOUR INSTRUCTIONS", 0.85, "injection_leak"},

	// ── SQL / NoSQL injection ────────────────────────────────────────────────
	{"DROP TABLE", 0.97, "injection_sqli"},
	{"DELETE FROM", 0.92, "injection_sqli"},
	{"'; --", 0.95, "injection_sqli"},
	{"\" OR \"1\"=\"1", 0.95, "injection_sqli"},
	{"UNION SELECT", 0.90, "injection_sqli"},
	{"```SQL", 0.60, "injection_sqli"},

	// ── Indirect injection (data exfiltration) ────────────────────────────────
	{"SEND THIS TO", 0.70, "injection_exfil"},
	{"EXFILTRATE", 0.85, "injection_exfil"},
	{"EXTRACT ALL DATA", 0.80, "injection_exfil"},
}

// Name implements InputFilter.
func (InjectionDetector) Name() string { return "injection_detector" }

// Run implements InputFilter.
// Returns Blocked=true if the aggregated risk score meets or exceeds Threshold.
func (d InjectionDetector) Run(_ context.Context, input string) FilterVerdict {
	threshold := d.Threshold
	if threshold <= 0 {
		threshold = 0.70
	}

	upper := strings.ToUpper(input)
	maxScore := 0.0
	var violations []ViolationDetail

	// ── Pattern matching ──────────────────────────────────────────────────────
	for _, p := range injectionPatterns {
		if strings.Contains(upper, p.pattern) {
			if p.weight > maxScore {
				maxScore = p.weight
			}
			violations = append(violations, ViolationDetail{
				Rule:       p.rule,
				Severity:   SeverityFromScore(p.weight),
				Match:      safeprefix(p.pattern, 20),
				Confidence: p.weight,
			})
		}
	}

	// ── Structural anomalies (additive, capped) ───────────────────────────────
	structPenalty := 0.0

	// Abnormally long inputs are suspicious (legitimate farm messages are short)
	charCount := utf8.RuneCountInString(input)
	if charCount > 2000 {
		structPenalty += 0.20
	} else if charCount > 1000 {
		structPenalty += 0.10
	}

	// Excessive newlines suggest hidden instruction injection
	if strings.Count(input, "\n") > 20 {
		structPenalty += 0.15
	}

	// Nested backtick code fences are unusual in WhatsApp agricultural chat
	if strings.Count(input, "```") >= 2 {
		structPenalty += 0.10
	}

	finalScore := minFloat(maxScore+structPenalty, 1.0)
	blocked := finalScore >= threshold

	reason := ""
	if blocked {
		reason = fmt.Sprintf("injection_score=%.2f (threshold=%.2f) violations=%d",
			finalScore, threshold, len(violations))
	}

	return FilterVerdict{
		Blocked:    blocked,
		Reason:     reason,
		RiskScore:  finalScore,
		Violations: violations,
	}
}

// ─── Ensure interface compliance at compile time ──────────────────────────────

var _ InputFilter = InjectionDetector{}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// safeprefix returns up to n runes from s, safe for display in audit logs.
func safeprefix(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "…"
}
