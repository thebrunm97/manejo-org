package mcp

import (
	"strings"
	"testing"
)

func TestTextoBalanco_MZ(t *testing.T) {
	cat := "Insumos"
	b := balancoIA{Receitas: 0, Despesas: 5350, Saldo: -5350}
	b.Top = append(b.Top, struct {
		Categoria *string `json:"c"`
		Valor     float64 `json:"v"`
	}{&cat, 5350})
	mes := 10
	got := TextoBalanco("258841234567", 2026, &mes, b)
	for _, want := range []string{
		"💰 *Balanço — outubro/2026*",
		"• Receitas: 0,00 MT",
		"• Despesas: 5.350,00 MT",
		"*Saldo:* −5.350,00 MT",
		"• Insumos: 5.350,00 MT",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("faltou %q em:\n%s", want, got)
		}
	}
	if strings.Contains(got, "R$") {
		t.Errorf("produtor MZ não pode ver R$: %s", got)
	}
}
