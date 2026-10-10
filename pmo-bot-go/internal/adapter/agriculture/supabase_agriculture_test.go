package agriculture

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// A compra do lote precisa chamar rpc_registrar_compra_insumo com os nomes
// de argumento da assinatura real (pmo_id_arg, propriedade_id_arg, ...).
func TestProcessarCompraArgs(t *testing.T) {
	var got map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/rest/v1/rpc/rpc_registrar_compra_insumo" {
			w.Write([]byte("[]")) // NewClient carrega a blacklist de insumos
			return
		}
		json.NewDecoder(r.Body).Decode(&got)
		w.Write([]byte(`{"status":"success","compra_id":"x"}`))
	}))
	defer srv.Close()
	c, _ := supabase.NewClient(supabase.Config{URL: srv.URL, Key: "fake"})
	repo := NewSupabaseAgriculturalRepository(c)

	res, err := repo.RegistrarLoteOperacoes(context.Background(), 7, 3, "u1", []mcp.OperacaoLoteItem{{
		Tipo:   "Compra",
		Compra: &mcp.RegistrarCompraSchema{Item: "Esterco", Quantidade: "2,5 t", ValorPago: "1200,50", DataCompra: "2026-10-01"},
	}})
	if err != nil || len(res.Erros) != 0 {
		t.Fatalf("err=%v erros=%v", err, res.Erros)
	}
	want := map[string]interface{}{
		"pmo_id_arg": 7.0, "propriedade_id_arg": 3.0, "user_id_arg": "u1",
		"produto_arg": "Esterco", "quantidade_valor_arg": 2.5, "quantidade_unidade_arg": "t",
		"data_compra_arg": "2026-10-01", "valor_total_arg": 1200.5,
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %v, quero %v", k, got[k], v)
		}
	}

	res, _ = repo.RegistrarLoteOperacoes(context.Background(), 7, 0, "u1", []mcp.OperacaoLoteItem{{
		Tipo: "Compra", Compra: &mcp.RegistrarCompraSchema{Item: "Esterco", Quantidade: "1", ValorPago: "1"},
	}})
	if len(res.Erros) != 1 {
		t.Errorf("sem propriedade ativa deveria falhar: %v", res)
	}
}

func TestSepararQuantidade(t *testing.T) {
	casos := []struct {
		in   string
		v    interface{}
		unid interface{}
	}{
		{"20 kg", 20.0, "kg"},
		{"2,5L", 2.5, "L"},
		{"10", 10.0, nil},
		{"uma saca", nil, "uma saca"},
	}
	for _, c := range casos {
		v, u := separarQuantidade(c.in)
		if v != c.v || u != c.unid {
			t.Errorf("%q → %v %v", c.in, v, u)
		}
	}
}
