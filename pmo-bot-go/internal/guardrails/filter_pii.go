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

// piiRule pairs a compiled pattern with its policy rule name, replacement and an optional validator.
type piiRule struct {
	name        string
	re          *regexp.Regexp
	replacement string
	validator   func(string) bool
}

// cleanDigits removes all non-numeric characters from a string
func cleanDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func isValidCPF(cpf string) bool {
	cpf = cleanDigits(cpf)
	if len(cpf) != 11 {
		return false
	}
	// Check for all identical digits (e.g. 111.111.111-11)
	allSame := true
	for i := 1; i < len(cpf); i++ {
		if cpf[i] != cpf[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return false
	}

	calculateDigit := func(cpf string, factor int) int {
		sum := 0
		for _, r := range cpf {
			sum += int(r-'0') * factor
			factor--
		}
		remainder := sum % 11
		if remainder < 2 {
			return 0
		}
		return 11 - remainder
	}

	d1 := calculateDigit(cpf[:9], 10)
	d2 := calculateDigit(cpf[:9]+string(rune(d1+'0')), 11)

	return cpf[9]-'0' == byte(d1) && cpf[10]-'0' == byte(d2)
}

func isValidCNPJ(cnpj string) bool {
	cnpj = cleanDigits(cnpj)
	if len(cnpj) != 14 {
		return false
	}

	allSame := true
	for i := 1; i < len(cnpj); i++ {
		if cnpj[i] != cnpj[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return false
	}

	calculateDigit := func(cnpj string, weights []int) int {
		sum := 0
		for i, w := range weights {
			sum += int(cnpj[i]-'0') * w
		}
		remainder := sum % 11
		if remainder < 2 {
			return 0
		}
		return 11 - remainder
	}

	w1 := []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	d1 := calculateDigit(cnpj[:12], w1)

	w2 := []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	d2 := calculateDigit(cnpj[:12]+string(rune(d1+'0')), w2)

	return cnpj[12]-'0' == byte(d1) && cnpj[13]-'0' == byte(d2)
}

// piiRules is compiled once at package init for zero allocation per call.
// CPF/CNPJ patterns use submatch groups to handle both plain-digit and
// formatted variants next to letters (e.g. "CPF123.456.789-00").
var piiRules = []piiRule{
	{
		// CPF: 11 digits, optionally formatted as NNN.NNN.NNN-NN
		// Accepts: adjacent to letters OR surrounded by digits boundary.
		name:        "pii_cpf",
		re:          regexp.MustCompile(`\d{3}\.?\d{3}\.?\d{3}-?\d{2}`),
		replacement: "[CPF ocultado]",
		validator:   isValidCPF,
	},
	{
		// CNPJ: 14 digits, optionally formatted
		name:        "pii_cnpj",
		re:          regexp.MustCompile(`\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}`),
		replacement: "[CNPJ ocultado]",
		validator:   isValidCNPJ,
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

		validMatchesCount := 0

		for _, m := range matches {
			if rule.validator != nil && !rule.validator(m) {
				continue
			}
			validMatchesCount++

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

		if validMatchesCount > 0 {
			// Replace all occurrences in the running redacted string, respecting the validator
			redacted = rule.re.ReplaceAllStringFunc(redacted, func(match string) string {
				if rule.validator != nil && !rule.validator(match) {
					return match
				}
				return rule.replacement
			})
			totalRisk += 0.1 * float64(validMatchesCount)
		}
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
		matches := rule.re.FindAllString(input, -1)
		for _, m := range matches {
			if rule.validator == nil || rule.validator(m) {
				return true
			}
		}
	}
	return false
}

// RedactPII returns input with all PII replaced by placeholders.
// Stateless helper for use outside the pipeline context.
func RedactPII(input string) string {
	out := input
	for _, rule := range piiRules {
		out = rule.re.ReplaceAllStringFunc(out, func(match string) string {
			if rule.validator != nil && !rule.validator(match) {
				return match
			}
			return rule.replacement
		})
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
