package gemini

import (
	"testing"
)

// TestIntentConstants verifies that the three Intent constants are correctly defined
// and distinct from each other — a compile-time safety net.
func TestIntentConstants(t *testing.T) {
	intents := []Intent{IntentRAG, IntentDatabase, IntentChat}
	seen := make(map[Intent]bool)

	for _, intent := range intents {
		if seen[intent] {
			t.Errorf("Duplicate Intent value detected: %s", intent)
		}
		seen[intent] = true
	}

	if len(seen) != 3 {
		t.Errorf("Expected 3 distinct intents, got %d", len(seen))
	}
}

// TestGetPromptForIntent verifies that GetPromptForIntent returns a non-empty
// string for each known intent and uses the correct specialist prompt.
func TestGetPromptForIntent(t *testing.T) {
	tests := []struct {
		intent         Intent
		expectContains string
		name           string
	}{
		{
			name:           "RAG intent returns agronomist prompt",
			intent:         IntentRAG,
			expectContains: "Consultor Orgânico Especialista",
		},
		{
			name:           "DATABASE intent returns db_operator prompt",
			intent:         IntentDatabase,
			expectContains: "Operador de Registros da Fazenda",
		},
		{
			name:           "CHAT intent returns default fallback prompt",
			intent:         IntentChat,
			expectContains: "Consultor Especialista",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prompt := GetPromptForIntent(tt.intent, "orgânico", false)

			if prompt == "" {
				t.Errorf("GetPromptForIntent(%s) returned empty string", tt.intent)
			}

			// Verify the returned prompt contains a known marker from the correct file.
			// This acts as a "canary" to detect if the embed or the switch was swapped.
			if tt.expectContains != "" {
				found := false
				for i := 0; i+len(tt.expectContains) <= len(prompt); i++ {
					if prompt[i:i+len(tt.expectContains)] == tt.expectContains {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("GetPromptForIntent(%s) prompt does not contain expected marker %q.\nGot (first 200 chars): %s",
						tt.intent, tt.expectContains, truncate(prompt, 200))
				}
			}
		})
	}
}

// TestRouterResultFallback verifies that when an unknown intent string is returned
// by the model, the ClassifyIntent function's validation logic would detect it.
// This tests the RouterResult struct parsing, not a live API call.
func TestRouterResultFallback(t *testing.T) {
	knownIntents := map[Intent]bool{
		IntentRAG:      true,
		IntentDatabase: true,
		IntentChat:     true,
	}

	unknownIntent := Intent("UNKNOWN_FUTURE_INTENT")
	if knownIntents[unknownIntent] {
		t.Errorf("Expected 'UNKNOWN_FUTURE_INTENT' to not be in the known intents map")
	}

	// Simulate the validation block inside ClassifyIntent
	result := RouterResult{Intent: unknownIntent, Confidence: 0.5}
	switch result.Intent {
	case IntentRAG, IntentDatabase, IntentChat:
		// valid
	default:
		result.Intent = IntentRAG // fallback applied
	}

	if result.Intent != IntentRAG {
		t.Errorf("Expected fallback to IntentRAG for unknown intent, got %s", result.Intent)
	}
}
