package mcp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestAvisosDuplicata_Rascunho(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Só o calcário já foi anotado.
		if strings.Contains(r.URL.RawQuery, "Calc") {
			w.Write([]byte(`[{"criado_em":"2026-10-28T17:05:34.458773+00:00"}]`))
			return
		}
		w.Write([]byte(`[]`))
	}))
	defer srv.Close()
	sb, _ := supabase.NewClient(supabase.Config{URL: srv.URL, Key: "k"})
	s := &Server{supabase: sb}

	ops := []domain.BatchMutationItem{
		{Type: "compra_insumo", TipoOperacao: "compra", Payload: map[string]interface{}{"produto": "Calcário", "quantidade_valor": 2.0}},
		{Type: "compra_insumo", Payload: map[string]interface{}{"produto": "Ureia", "quantidade_valor": 1.0}},
		{Type: "caderno_campo", Payload: map[string]interface{}{"produto": "Calcário"}}, // sem quantidade: não compara
	}
	avisos := s.avisosDuplicata(context.Background(), 1610, "+258840000000", ops)
	if len(avisos) != 1 || !strings.Contains(avisos[0], "compra de Calcário (2)") || !strings.Contains(avisos[0], "registo repetido") {
		t.Fatalf("avisos = %q", avisos)
	}
}
