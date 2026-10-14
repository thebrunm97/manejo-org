package state

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestInterpretarDetalheCompra(t *testing.T) {
	casos := []struct {
		body                 string
		faltaTipo, faltaPeso bool
		tipo                 string
		peso                 float64
		pular, outro         bool
	}{
		{"NPK 12-24-12, 50 kg", true, true, "NPK 12-24-12", 50, false, false},
		{"ureia 50", true, true, "ureia", 50, false, false},
		{"Era esterco de galinha, cada saco tem 25kg", true, true, "esterco de galinha", 25, false, false},
		{"50kg", false, true, "", 50, false, false},
		{"50", false, true, "", 50, false, false},
		{"2,5 kg", false, true, "", 2.5, false, false},
		{"NPK 12-24-12", true, false, "NPK 12-24-12", 0, false, false},
		{"Não sei", true, true, "", 0, true, false},
		{"pular", true, true, "", 0, true, false},
		{"Quando devo semear milho?", true, true, "", 0, false, true},
		{"Comprei 2 enxadas por 500", true, true, "", 0, false, true},
		{"obrigado", false, true, "", 0, false, true},
	}
	for _, c := range casos {
		r := interpretarDetalheCompra(c.body, c.faltaTipo, c.faltaPeso)
		if r.tipo != c.tipo || r.pesoKg != c.peso || r.pular != c.pular || r.outro != c.outro {
			t.Errorf("%q → %+v", c.body, r)
		}
	}
}

// Alerta de insumo proibido só em área orgânica/transição; convencional não.
func TestTextoComplementoGravado_Modalidade(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`[{"nome":"Ureia"}]`))
	}))
	defer srv.Close()
	sb, _ := supabase.NewClient(supabase.Config{URL: srv.URL, Key: "fake"})
	r := respostaDetalhe{tipo: "ureia", pesoKg: 50}
	mz := "258841234567"

	org := textoComplementoGravado(mz, &supabase.Profile{ModalidadePredominante: "ORGANICO"}, sb, "adubo", "sacos", 3, r)
	if !strings.Contains(org, "⚠️") || !strings.Contains(org, "registada") {
		t.Errorf("orgânico deveria alertar em pt-MZ: %q", org)
	}
	if !strings.Contains(org, "saco de 50 kg (150 kg no total)") {
		t.Errorf("peso: %q", org)
	}
	conv := textoComplementoGravado(mz, &supabase.Profile{ModalidadePredominante: "CONVENCIONAL"}, sb, "adubo", "sacos", 3, r)
	if strings.Contains(conv, "⚠️") {
		t.Errorf("convencional não deveria alertar: %q", conv)
	}
}

func TestIniciarComplementoCompra(t *testing.T) {
	if p := IniciarComplementoCompra(nil, "258", "Compra registada."); p != "" {
		t.Errorf("string não tem complemento: %q", p)
	}
	res := map[string]interface{}{"status": "success", "complemento": map[string]interface{}{"pergunta": "Que adubo era?"}}
	if p := IniciarComplementoCompra(nil, "258", res); p != "" {
		t.Errorf("sem history não pergunta (não teria como receber a resposta): %q", p)
	}
}
