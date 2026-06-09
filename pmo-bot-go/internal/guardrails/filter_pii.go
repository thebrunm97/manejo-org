package guardrails

import (
	"context"
	"regexp"
	"strings"
)

// PIIScrubber is Layer-1 of the input pipeline.
// It detects and redacts Personally Identifiable Information (PII) from
// user input before it reaches the LLM. It never BLOCKS — it only redacts.
//
// Patterns covered (Brazilian context):
//   - CPF:      XXX.XXX.XXX-XX or XXXXXXXXXXX (11 digits)
//   - CNPJ:     XX.XXX.XXX/XXXX-XX or XXXXXXXXXXXXXX (14 digits)
//   - Phone:    +55 (XX) XXXXX-XXXX and variations
//   - E-mail:   standard RFC 5322 pattern
//
// Design rationale: redacting instead of blocking keeps the system available
// for legitimate queries that accidentally include PII (e.g. producer quotes a
// CPF while asking a question). The redacted text is what reaches the LLM.
type PIIScrubber struct{}

// piiRule pairs a compiled pattern with its policy rule name and replacement.
type piiRule struct {
	name        string
	re          *regexp.Regexp
	replacement string
}

// piiRules is compiled once at package init for zero allocation per call.
// CPF/CNPJ patterns use submatch groups to handle both plain-digit and
// formatted variants next to letters (e.g. "CPF123.456.789-00").
var piiRules = []piiRule{
	{
		// CPF: 11 digits, optionally formatted as NNN.NNN.NNN-NN
		// Accepts: adjacent to letters OR surrounded by digits boundary.
		// Uses ReplaceAllStringSubmatch via ReplaceAllFunc below.
		name:        "pii_cpf",
		re:          regexp.MustCompile(`\d{3}\.?\d{3}\.?\d{3}-?\d{2}`),
		replacement: "[CPF ocultado]",
	},
	{
		// CNPJ: 14 digits, optionally formatted
		name:        "pii_cnpj",
		re:          regexp.MustCompile(`\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}`),
		replacement: "[CNPJ ocultado]",
	},
	{
		// Phone: +55 11 99999-9999, (11) 9999-9999, 11999999999, etc.
		// \b ensures we don't match inside CPF/CNPJ digit sequences.
		name:        "pii_phone",
		re:          regexp.MustCompile(`(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\b\d{4,5}-?\d{4}\b`),
		replacement: "[Telefone ocultado]",
	},
	{
		name:        "pii_email",
		re:          regexp.MustCompile(`\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b`),
		replacement: "[Email ocultado]",
	},
}

// Name implements InputFilter.
func (PIIScrubber) Name() string { return "pii_scrubber" }

// Run implements InputFilter.
// Always returns Blocked=false. PII detections are only redacted, never blocked.
func (PIIScrubber) Run(_ context.Context, input string) FilterVerdict {
	redacted := input
	var violations []ViolationDetail
	totalRisk := 0.0

	for _, rule := range piiRules {
		matches := rule.re.FindAllString(redacted, -1)
		if len(matches) == 0 {
			continue
		}

		for _, m := range matches {
			// Safely truncate the match for audit logs (never log full PII)
			display := m
			if len([]rune(display)) > 6 {
				display = string([]rune(display)[:3]) + "***"
			}
			violations = append(violations, ViolationDetail{
				Rule:       rule.name,
				Severity:   "medium",
				Match:      display,
				Confidence: 1.0,
			})
		}

		// Replace all occurrences in the running redacted string
		redacted = rule.re.ReplaceAllString(redacted, rule.replacement)
		totalRisk += 0.1 * float64(len(matches))
	}

	return FilterVerdict{
		Blocked:    false, // PII scrubber never blocks
		Redacted:   redacted,
		RiskScore:  minFloat(totalRisk, 0.5), // Cap at 0.5 — not a blocking threat
		Violations: violations,
	}
}

// HasPII reports whether the input contains any recognized PII pattern.
// Exported for use in tests and pre-flight checks.
func HasPII(input string) bool {
	for _, rule := range piiRules {
		if rule.re.MatchString(input) {
			return true
		}
	}
	return false
}

// RedactPII returns input with all PII replaced by placeholders.
// Stateless helper for use outside the pipeline context.
func RedactPII(input string) string {
	out := input
	for _, rule := range piiRules {
		out = rule.re.ReplaceAllString(out, rule.replacement)
	}
	return out
}

// ─── Ensure interface compliance at compile time ──────────────────────────────

var _ InputFilter = PIIScrubber{}

// ─── Package-level helpers ────────────────────────────────────────────────────

// containsFold reports whether s contains substr (case-insensitive).
func containsFold(s, substr string) bool {
	return strings.Contains(strings.ToUpper(s), strings.ToUpper(substr))
}
