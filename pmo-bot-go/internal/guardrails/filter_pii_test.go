package guardrails

import (
	"context"
	"testing"
)

func TestIsValidCPF(t *testing.T) {
	tests := []struct {
		name     string
		cpf      string
		expected bool
	}{
		{"Valid CPF without mask", "52998224725", true}, // A real valid math sequence for tests
		{"Valid CPF with mask", "529.982.247-25", true},
		{"Invalid CPF Checksum", "52998224724", false},
		{"All same digits", "11111111111", false},
		{"Incomplete CPF", "750989", false},
		{"Empty CPF", "", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isValidCPF(tc.cpf); got != tc.expected {
				t.Errorf("isValidCPF(%q) = %v, want %v", tc.cpf, got, tc.expected)
			}
		})
	}
}

func TestIsValidCNPJ(t *testing.T) {
	tests := []struct {
		name     string
		cnpj     string
		expected bool
	}{
		{"Valid CNPJ without mask", "11222333000181", true}, // A real valid math sequence for tests
		{"Valid CNPJ with mask", "11.222.333/0001-81", true},
		{"Invalid CNPJ Checksum", "11222333000182", false},
		{"All same digits", "11111111111111", false},
		{"Incomplete CNPJ", "11222333", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := isValidCNPJ(tc.cnpj); got != tc.expected {
				t.Errorf("isValidCNPJ(%q) = %v, want %v", tc.cnpj, got, tc.expected)
			}
		})
	}
}

func TestPIIScrubber_FalsePositives(t *testing.T) {
	scrubber := PIIScrubber{}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Valid CPF mixed in text",
			input:    "Meu cpf é 529.982.247-25 pode consultar.",
			expected: "Meu cpf é [CPF ocultado] pode consultar.",
		},
		{
			name:     "False positive CPF (Lot number)",
			input:    "Registrar lote DT391787418354 amanhã", // Contains 39178741835 which is invalid CPF
			expected: "Registrar lote DT391787418354 amanhã",
		},
		{
			name:     "Valid CNPJ in text",
			input:    "Nota fiscal da empresa 11.222.333/0001-81",
			expected: "Nota fiscal da empresa [CNPJ ocultado]",
		},
		{
			name:     "False positive CNPJ (Random ID)",
			input:    "Order ID 11222333000182", // Invalid checksum
			expected: "Order ID 11222333000182",
		},
		{
			name:     "Valid Phone number",
			input:    "Liga no (11) 98888-7777",
			expected: "Liga no [Telefone ocultado]",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			verdict := scrubber.Run(context.Background(), tc.input)
			if verdict.Redacted != tc.expected {
				t.Errorf("Redacted = %q, want %q", verdict.Redacted, tc.expected)
			}
		})
	}
}

func TestHasPII(t *testing.T) {
	if HasPII("Registrar lote DT391787418354") {
		t.Error("HasPII should be false for invalid CPF (lot number)")
	}
	if !HasPII("Meu CPF 529.982.247-25") {
		t.Error("HasPII should be true for valid CPF")
	}
}

func TestRedactPII(t *testing.T) {
	redacted := RedactPII("Lote DT391787418354 CPF 529.982.247-25 CNPJ 11.222.333/0001-81")
	expected := "Lote DT391787418354 CPF [CPF ocultado] CNPJ [CNPJ ocultado]"
	if redacted != expected {
		t.Errorf("RedactPII returned %q, want %q", redacted, expected)
	}
}
