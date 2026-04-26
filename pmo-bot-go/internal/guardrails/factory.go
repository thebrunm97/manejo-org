package guardrails

// NewDefaultPipeline creates the production-grade input pipeline with:
//
//  1. PIIScrubber    — redacts CPF, CNPJ, phone, email (never blocks)
//  2. InjectionDetector — blocks prompt injection / jailbreaks (threshold 0.70)
//
// Pass a ViolationLogger to persist audit events for the dashboard.
// Use guardrails.NoOpLogger{} in tests or when Supabase is not available.
//
// Example (in harness.go or server wiring):
//
//	pipeline := guardrails.NewDefaultPipeline(mySupabaseLogger)
//	aiWorkerCfg.GuardrailPipeline = pipeline
func NewDefaultPipeline(logger ViolationLogger) *Pipeline {
	return NewPipeline(
		logger,
		PIIScrubber{},
		InjectionDetector{Threshold: 0.70},
	)
}
