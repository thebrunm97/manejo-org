package mcp

import (
	"strings"
	"testing"
)

func TestFaltasDaCompra(t *testing.T) {
	casos := []struct {
		produto, unidade, marca, composicao string
		tipo, peso                          bool
	}{
		{"adubo", "sacos", "", "", true, true},
		{"Adubo", "kg", "", "", true, false},
		{"esterco", "sacos", "", "", false, true},
		{"adubo", "sacos", "", "NPK 12-24-12", false, true},
		{"Remédio", "litros", "", "", true, false},
		{"ureia", "kg", "", "", false, false},
	}
	for _, c := range casos {
		tp, ps := FaltasDaCompra(c.produto, c.unidade, c.marca, c.composicao)
		if tp != c.tipo || ps != c.peso {
			t.Errorf("%+v → tipo=%v peso=%v", c, tp, ps)
		}
	}
}

func TestPerguntaComplemento(t *testing.T) {
	mz := PerguntaComplemento("258841234567", "adubo", "sacos", true, true)
	if !strings.HasPrefix(mz, "Para completar o registo: que adubo era") || !strings.Contains(mz, "quantos kg tem cada saco?") {
		t.Errorf("MZ: %q", mz)
	}
	br := PerguntaComplemento("5511999990000", "adubo", "sacos", false, true)
	if br != "Pra completar o registro: quantos kg tem cada saco?\n_Se não souber, pode ignorar._" {
		t.Errorf("BR: %q", br)
	}
	if PerguntaComplemento("258", "ureia", "kg", false, false) != "" {
		t.Error("nada a perguntar deveria dar vazio")
	}
}
