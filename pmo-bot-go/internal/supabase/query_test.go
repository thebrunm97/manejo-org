package supabase

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// DT-89: valores com espaço, "&" e "+" precisam chegar inteiros ao PostgREST.
func TestFiltrosEscapados(t *testing.T) {
	var got map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = map[string]string{}
		for k, v := range r.URL.Query() {
			got[k] = v[0]
		}
		w.Write([]byte("[]"))
	}))
	defer srv.Close()
	c := &Client{config: Config{URL: srv.URL, Key: "fake"}, httpClient: srv.Client()}

	c.GetCategoriaFinanceiraByName("Mão de obra & serviços", "DESPESA")
	if got["nome"] != "ilike.Mão de obra & serviços" || got["tipo"] != "eq.DESPESA" {
		t.Errorf("categoria: %v", got)
	}

	c.GetDemandaAtivaPorCultura(t.Context(), "feijão nhemba")
	if got["cultura"] != "ilike.FEIJÃO NHEMBA" {
		t.Errorf("cultura: %v", got)
	}

	c.GetProfileByPhone("+258841234567")
	if got["telefone"] != "eq.+258841234567" && got["telefone"] != "ilike.*41234567*" {
		t.Errorf("telefone: %v", got)
	}
}
