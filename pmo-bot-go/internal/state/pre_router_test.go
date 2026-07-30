package state

import (
	"testing"
)

func TestRegexPreRouter_Evaluate(t *testing.T) {
	router := &RegexPreRouter{}

	tests := []struct {
		name       string
		message    string
		wantMatch  bool
		wantResult RouterResult
	}{
		{
			name:      "saudação simples minúscula",
			message:   "bom dia",
			wantMatch: true,
			wantResult: RouterResult{
				PrimaryIntent:         IntentChat,
				Confidence:            1.0,
				ConfidenceCalibration: ConfidenceWellCalibrated,
				NeedsWrite:            false,
				WriteScope:            WriteScopeNone,
				IsMixed:               false,
			},
		},
		{
			name:      "saudação simples com pontuação",
			message:   "Olá?",
			wantMatch: true,
			wantResult: RouterResult{
				PrimaryIntent:         IntentChat,
				Confidence:            1.0,
				ConfidenceCalibration: ConfidenceWellCalibrated,
				NeedsWrite:            false,
				WriteScope:            WriteScopeNone,
				IsMixed:               false,
			},
		},
		{
			name:      "comando de registrar talhão",
			message:   "/registrar colheita",
			wantMatch: true,
			wantResult: RouterResult{
				PrimaryIntent:         IntentDatabase,
				Confidence:            1.0,
				ConfidenceCalibration: ConfidenceWellCalibrated,
				NeedsWrite:            true,
				WriteScope:            WriteScopeFarmRecord,
				IsMixed:               false,
			},
		},
		{
			name:      "comando de novo",
			message:   "/novo canteiro",
			wantMatch: true,
			wantResult: RouterResult{
				PrimaryIntent:         IntentDatabase,
				Confidence:            1.0,
				ConfidenceCalibration: ConfidenceWellCalibrated,
				NeedsWrite:            true,
				WriteScope:            WriteScopeFarmRecord,
				IsMixed:               false,
			},
		},
		{
			name:       "sem match pre router fallback para llm",
			message:    "como adubar meu tomate?",
			wantMatch:  false,
			wantResult: RouterResult{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, matched := router.Evaluate(tt.message)
			if matched != tt.wantMatch {
				t.Errorf("Evaluate() matched = %v, want %v", matched, tt.wantMatch)
			}
			if matched {
				// We don't strictly compare DebugMeta inside this test to avoid fragility, but we check core fields
				if got.PrimaryIntent != tt.wantResult.PrimaryIntent {
					t.Errorf("Evaluate() PrimaryIntent = %v, want %v", got.PrimaryIntent, tt.wantResult.PrimaryIntent)
				}
				if got.NeedsWrite != tt.wantResult.NeedsWrite {
					t.Errorf("Evaluate() NeedsWrite = %v, want %v", got.NeedsWrite, tt.wantResult.NeedsWrite)
				}
				if got.WriteScope != tt.wantResult.WriteScope {
					t.Errorf("Evaluate() WriteScope = %v, want %v", got.WriteScope, tt.wantResult.WriteScope)
				}
				if got.Confidence != tt.wantResult.Confidence {
					t.Errorf("Evaluate() Confidence = %v, want %v", got.Confidence, tt.wantResult.Confidence)
				}
				if got.DebugMeta.RouteSource != "pre_router" {
					t.Errorf("Evaluate() DebugMeta.RouteSource = %v, want %v", got.DebugMeta.RouteSource, "pre_router")
				}
			}
		})
	}
}
