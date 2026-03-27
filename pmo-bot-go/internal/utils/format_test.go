package utils

import (
	"testing"
)

func TestSanitizeForWhatsApp(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Convert double asterisks to single",
			input:    "This is **bold** text.",
			expected: "This is *bold* text.",
		},
		{
			name:     "Maintain lists with dashes",
			input:    "- Item 1\n- Item 2",
			expected: "- Item 1\n- Item 2",
		},
		{
			name:     "Multiple bolds",
			input:    "**First** and **Second**",
			expected: "*First* and *Second*",
		},
		{
			name:     "Mixed markdown",
			input:    "Check this:\n- **Calcário**: R$22\n- **Ioorin**: R$200",
			expected: "Check this:\n- *Calcário*: R$22\n- *Ioorin*: R$200",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeForWhatsApp(tt.input)
			if got != tt.expected {
				t.Errorf("SanitizeForWhatsApp() = %q, want %q", got, tt.expected)
			}
		})
	}
}
