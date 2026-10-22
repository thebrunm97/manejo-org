package supabase

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestConsultarCaderno_FiltrosEValores(t *testing.T) {
	var queries []url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		queries = append(queries, r.URL.Query())
		if strings.HasSuffix(r.URL.Path, "/caderno_campo") {
			w.Write([]byte(`[
				{"data_registro":"2026-10-19","tipo_atividade":"Compra de Insumo","produto":"adubo","quantidade_valor":2,"quantidade_unidade":"sacos","valor_total":null,"detalhes_tecnicos":{"composicao":"Ureia","peso_unidade_kg":50},"id":"c1"},
				{"data_registro":"2026-10-14","tipo_atividade":"Compra de Insumo","produto":"adubo","quantidade_valor":3,"quantidade_unidade":"sacos","valor_total":null,"detalhes_tecnicos":null,"id":"c2"}
			]`))
			return
		}
		w.Write([]byte(`[{"caderno_campo_id":"c1","valor_alocado":1350},{"caderno_campo_id":"c2","valor_alocado":2000}]`))
	}))
	defer srv.Close()
	c := &Client{config: Config{URL: srv.URL, Key: "fake"}, httpClient: srv.Client()}

	regs, err := c.ConsultarCaderno(t.Context(), FiltroCaderno{PmoID: 1610, Grupo: "compra", Desde: "2026-10-01", Produto: "adubo, (x)"})
	if err != nil {
		t.Fatal(err)
	}
	if len(regs) != 2 || regs[0].ValorTotal != 1350 || regs[1].ValorTotal != 2000 {
		t.Fatalf("valores não preenchidos: %+v", regs)
	}

	q := queries[0]
	if q.Get("pmo_id") != "eq.1610" {
		t.Errorf("pmo_id: %v", q["pmo_id"])
	}
	if got := q.Get("tipo_atividade"); !strings.HasPrefix(got, "in.(") || !strings.Contains(got, `"Compra de Insumo"`) {
		t.Errorf("tipo_atividade: %q", got)
	}
	if q.Get("data_registro") != "gte.2026-10-01" {
		t.Errorf("data_registro: %v", q["data_registro"])
	}
	// Vírgula e parênteses do produtor não podem quebrar o or=(...).
	if got := q.Get("or"); got != "(produto.ilike.*adubo x*,detalhes_tecnicos->>composicao.ilike.*adubo x*)" {
		t.Errorf("or: %q", got)
	}
	if q2 := queries[1]; q2.Get("caderno_campo_id") != `in.("c1","c2")` {
		t.Errorf("busca de valores: %v", q2)
	}
}

func TestConsultarCaderno_SemGrupoEscondeCancelados(t *testing.T) {
	var q url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q = r.URL.Query()
		w.Write([]byte("[]"))
	}))
	defer srv.Close()
	c := &Client{config: Config{URL: srv.URL, Key: "fake"}, httpClient: srv.Client()}

	if _, err := c.ConsultarCaderno(t.Context(), FiltroCaderno{PmoID: 7}); err != nil {
		t.Fatal(err)
	}
	if got := q["tipo_atividade"]; len(got) != 1 || !strings.HasPrefix(got[0], "not.in.(") || !strings.Contains(got[0], `"CANCELADO"`) {
		t.Errorf("tipo_atividade: %v", got)
	}
	if _, err := c.ConsultarCaderno(t.Context(), FiltroCaderno{}); err == nil {
		t.Error("sem pmo_id devia falhar")
	}
}
