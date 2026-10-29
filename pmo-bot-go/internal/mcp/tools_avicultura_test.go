package mcp

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func eventoAve(data, lote, evento string, qtd float64, extra map[string]interface{}) supabase.RegistroAve {
	d := map[string]interface{}{"evento": evento}
	for k, v := range extra {
		d[k] = v
	}
	return supabase.RegistroAve{DataRegistro: data, Lote: lote, QuantidadeValor: qtd, DetalhesTecnicos: d}
}

func TestResumirLotes(t *testing.T) {
	agora := time.Date(2026, 10, 28, 10, 0, 0, 0, time.UTC)
	regs := []supabase.RegistroAve{
		eventoAve("2026-09-01", "Lote 1", "entrada", 100, map[string]interface{}{"finalidade": "postura"}),
		eventoAve("2026-09-10", "Lote 1", "vacinacao", 100, map[string]interface{}{"vacina": "Newcastle"}),
		eventoAve("2026-10-01", "Lote 1", "mortalidade", 4, nil),
		eventoAve("2026-10-20", "Lote 1", "postura", 50, nil), // fora dos 7 dias
		eventoAve("2026-10-25", "Lote 1", "postura", 60, nil),
		eventoAve("2026-10-28", "Lote 1", "postura", 66, nil),
		eventoAve("2026-08-01", "lote 0", "entrada", 20, map[string]interface{}{"finalidade": "corte"}),
		eventoAve("2026-09-15", "Lote 0", "abate", 20, map[string]interface{}{"peso_medio_kg": 2.1}),
	}
	lotes := ResumirLotes(regs, agora)
	if len(lotes) != 2 {
		t.Fatalf("esperava 2 lotes (nome sem diferença de maiúscula), veio %d", len(lotes))
	}
	l := lotes[0]
	if l.Vivas() != 96 || l.Ovos7d != 126 || l.Vacina != "Newcastle" || l.Finalidade != "postura" {
		t.Errorf("lote 1: %+v", l)
	}
	if lotes[1].Vivas() != 0 || lotes[1].PesoMedio != 2.1 {
		t.Errorf("lote 0: %+v", lotes[1])
	}

	got := TextoAvicultura("258841234567", lotes, agora)
	for _, want := range []string{
		"🐔 *Lote 1* · postura · desde 01/09",
		"• Aves: 96 (entraram 100 · morreram 4)",
		"• Mortalidade: 4%",
		"• Ovos: 126 nos últimos 7 dias (18/dia · 18,8% de postura)",
		"• Última vacina: Newcastle, 10/09",
		"_Lotes encerrados: lote 0_",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("faltou %q em:\n%s", want, got)
		}
	}
}

func TestEscolherLote(t *testing.T) {
	um := []*LoteAves{{Nome: "Lote 1", Entradas: 10}, {Nome: "Lote 2", Entradas: 5, Mortas: 5}}
	if l, q := escolherLote(um, "", "postura"); l != "Lote 1" || q != "" {
		t.Errorf("um ativo: %q %q", l, q)
	}
	if l, _ := escolherLote(um, "", "entrada"); l != "Lote 3" {
		t.Errorf("entrada sem nome: %q", l)
	}
	if l, _ := escolherLote(um, "lote 2", "mortalidade"); l != "Lote 2" {
		t.Errorf("nome dado: %q", l)
	}
	if _, q := escolherLote(um, "Galinheiro", "postura"); !strings.Contains(q, "Não há lote") {
		t.Errorf("lote inexistente devia perguntar: %q", q)
	}
	dois := []*LoteAves{{Nome: "Lote 1", Entradas: 10}, {Nome: "Lote 2", Entradas: 5}}
	if _, q := escolherLote(dois, "", "postura"); !strings.Contains(q, "qual") {
		t.Errorf("dois ativos devia perguntar: %q", q)
	}
	if _, q := escolherLote(nil, "", "postura"); !strings.Contains(q, "entrada") {
		t.Errorf("sem lote devia pedir a entrada: %q", q)
	}
}

func TestRegistrarAvicultura_GravaNoLoteUnico(t *testing.T) {
	var rpc map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/caderno_campo"):
			w.Write([]byte(`[{"data_registro":"2026-10-01","lote":"Lote 1","quantidade_valor":50,"detalhes_tecnicos":{"evento":"entrada","finalidade":"postura"}}]`))
		case strings.HasSuffix(r.URL.Path, "/rpc/rpc_registrar_operacao_campo"):
			b, _ := io.ReadAll(r.Body)
			json.Unmarshal(b, &rpc)
			w.Write([]byte(`{"id":"abc","status":"success"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	sb, _ := supabase.NewClient(supabase.Config{URL: srv.URL, Key: "k"})
	s := NewServer(sb, nil, nil, nil)
	tenant := TenantCtx{PmoID: 7, UserID: "u1", Telefone: "+258840000000"}

	res, err := s.handleRegistrarAvicultura(context.Background(), map[string]interface{}{"evento": "mortalidade", "quantidade": 3.0, "causa": "calor"}, tenant)
	if err != nil {
		t.Fatal(err)
	}
	m, _ := res.(map[string]interface{})
	if m["status"] != "success" || m["aves_no_lote"] != 47.0 {
		t.Fatalf("resultado: %+v", res)
	}
	if rpc["tipo_arg"] != "Avicultura" {
		t.Fatalf("rpc: %+v", rpc)
	}
	p, _ := rpc["payload_arg"].(map[string]interface{})
	if p["lote"] != "Lote 1" || p["produto"] != "Aves mortas" || p["causa"] != "calor" || p["quantidade_unidade"] != "aves" {
		t.Errorf("payload: %+v", p)
	}

	// Mais mortes do que aves: pergunta em vez de gravar.
	rpc = nil
	res, _ = s.handleRegistrarAvicultura(context.Background(), map[string]interface{}{"evento": "mortalidade", "quantidade": 80.0}, tenant)
	if m, _ := res.(map[string]interface{}); m["status"] != "requires_user_input" || rpc != nil {
		t.Errorf("devia perguntar sem gravar: %+v rpc=%v", res, rpc)
	}
}
