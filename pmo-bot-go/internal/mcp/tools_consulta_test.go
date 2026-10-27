package mcp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestTextoConsulta_ComprasMZ(t *testing.T) {
	agora := time.Date(2026, 10, 21, 10, 0, 0, 0, time.UTC)
	regs := []supabase.RegistroCaderno{
		{DataRegistro: "2026-10-19", TipoAtividade: "Compra de Insumo", Produto: "adubo", QuantidadeValor: 2, QuantidadeUnidade: "sacos",
			ValorTotal: 1350, DetalhesTecnicos: map[string]interface{}{"composicao": "Ureia", "peso_unidade_kg": 50.0}},
		{DataRegistro: "2025-12-14", TipoAtividade: "Compra de Insumo", Produto: "adubo", QuantidadeValor: 3, QuantidadeUnidade: "sacos", ValorTotal: 2000},
	}
	f := supabase.FiltroCaderno{Grupo: "compra", Desde: "2025-12-01"}
	got := TextoConsulta("258841234567", "compra", f, regs, agora)

	for _, want := range []string{
		"📒 *Compras* desde 01/12/25 — 2 registos",
		"• 19/10 · adubo (Ureia) · 2 sacos (100 kg) · 1.350,00 MT",
		"• 14/12/25 · adubo · 3 sacos · 2.000,00 MT",
		"*Total gasto:* 3.350,00 MT",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("faltou %q em:\n%s", want, got)
		}
	}
}

func TestTextoConsulta_TodosSemTotalEComTipo(t *testing.T) {
	agora := time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)
	var regs []supabase.RegistroCaderno
	for i := 0; i < 11; i++ {
		regs = append(regs, supabase.RegistroCaderno{DataRegistro: "2026-10-01", TipoAtividade: "Venda", Produto: "alface", ValorTotal: 10})
	}
	got := TextoConsulta("5511999999999", "", supabase.FiltroCaderno{}, regs, agora)
	if !strings.Contains(got, "*Registros* — 11 registros") || !strings.Contains(got, "• 01/10 · Venda · alface") {
		t.Errorf("cabeçalho/linha: %s", got)
	}
	if !strings.Contains(got, "…e mais 3.") {
		t.Errorf("devia cortar em %d linhas: %s", maxLinhasConsulta, got)
	}
	if strings.Contains(got, "Total") {
		t.Errorf("'todos' mistura compra e venda, não pode somar: %s", got)
	}
}

func TestTextoConsulta_Vazio(t *testing.T) {
	agora := time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)
	got := TextoConsulta("258841234567", "colheita", supabase.FiltroCaderno{Produto: "milho", Desde: "2026-10-01"}, nil, agora)
	if got != "Não encontrei registos de colheitas de milho desde 01/10." {
		t.Errorf("vazio: %q", got)
	}
}

func TestTextoTotais_SomaPorProdutoEUnidade(t *testing.T) {
	agora := time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)
	regs := []supabase.RegistroCaderno{
		{DataRegistro: "2026-10-20", TipoAtividade: "Colheita", Produto: "tomate", QuantidadeValor: 120, QuantidadeUnidade: "kg"},
		{DataRegistro: "2026-10-12", TipoAtividade: "Colheita", Produto: "Tomate", QuantidadeValor: 80, QuantidadeUnidade: "Kg"},
		{DataRegistro: "2026-10-05", TipoAtividade: "Colheita", Produto: "tomate", QuantidadeValor: 3, QuantidadeUnidade: "caixas"},
		{DataRegistro: "2026-10-03", TipoAtividade: "Colheita", Produto: "alface", QuantidadeValor: 1, QuantidadeUnidade: "maço"},
	}
	got := TextoTotais("258841234567", "colheita", supabase.FiltroCaderno{Desde: "2026-10-01"}, regs, agora)
	for _, want := range []string{
		"📊 *Totais — colheitas* desde 01/10",
		"• tomate: 200 kg + 3 caixas — 3 registos",
		"• alface: 1 maço — 1 registo",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("faltou %q em:\n%s", want, got)
		}
	}
	if strings.Contains(got, "Total") && strings.Contains(got, "MT") {
		t.Errorf("colheita não tem dinheiro: %s", got)
	}
}

func TestTextoTotais_ComprasComPesoEValor(t *testing.T) {
	agora := time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC)
	peso := map[string]interface{}{"peso_unidade_kg": 50.0}
	regs := []supabase.RegistroCaderno{
		{TipoAtividade: "Compra", Produto: "adubo", QuantidadeValor: 2, QuantidadeUnidade: "sacos", ValorTotal: 1000, DetalhesTecnicos: peso},
		{TipoAtividade: "Compra", Produto: "adubo", QuantidadeValor: 1, QuantidadeUnidade: "saco", ValorTotal: 500, DetalhesTecnicos: peso},
	}
	got := TextoTotais("258841234567", "compra", supabase.FiltroCaderno{}, regs, agora)
	if !strings.Contains(got, "• adubo: 3 sacos (150 kg) — 2 registos · 1.500,00 MT") || !strings.Contains(got, "*Total gasto:* 1.500,00 MT") {
		t.Errorf("totais de compra:\n%s", got)
	}
}

func TestTextoResumo_Mes(t *testing.T) {
	agora := time.Date(2026, 10, 24, 0, 0, 0, 0, time.UTC)
	regs := []supabase.RegistroCaderno{
		{TipoAtividade: "Venda", Produto: "tomate", ValorTotal: 800},
		{TipoAtividade: "Colheita", Produto: "tomate", QuantidadeValor: 120, QuantidadeUnidade: "kg"},
		{TipoAtividade: "Compra de Insumo", Produto: "adubo", ValorTotal: 2000},
		{TipoAtividade: "Compra", Produto: "semente", ValorTotal: 350},
		{TipoAtividade: "Plantio", Produto: "milho"},
		{TipoAtividade: "Outro", Produto: "cerca"},
	}
	got := TextoResumo("258841234567", supabase.FiltroCaderno{Desde: "2026-10-01"}, regs, agora)
	for _, want := range []string{
		"📊 *Resumo* desde 01/10\n",
		"🌱 Sementeiras e plantios: 1 (milho)",
		"🧺 Colheitas: 1 (tomate 120 kg)",
		"🛒 Compras: 2 — 2.350,00 MT",
		"💰 Vendas: 1 — 800,00 MT",
		"📝 Outros: 1",
		"*Vendas − compras:* −1.550,00 MT",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("faltou %q em:\n%s", want, got)
		}
	}
	if strings.Contains(got, "🧪") {
		t.Errorf("sem manejo no período, não devia ter linha: %s", got)
	}
}

func TestTextoResumo_Vazio(t *testing.T) {
	agora := time.Date(2026, 10, 24, 0, 0, 0, 0, time.UTC)
	if got := TextoResumo("5511999999999", supabase.FiltroCaderno{Desde: "2026-10-01"}, nil, agora); got != "Não encontrei registros desde 01/10." {
		t.Errorf("vazio: %q", got)
	}
}

func TestLinkApp_URL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`[{}]`))
	}))
	defer srv.Close()
	sb, _ := supabase.NewClient(supabase.Config{URL: srv.URL, Key: "k"})
	s := NewServer(sb, nil, nil, nil)
	t.Setenv("FRONTEND_URL", "https://manejo.exemplo/")

	link, err := s.linkApp("u1", "/caderno")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(link, "https://manejo.exemplo/auth/callback?code=") || !strings.HasSuffix(link, "&next=%2Fcaderno") {
		t.Errorf("link: %s", link)
	}

	t.Setenv("FRONTEND_URL", "")
	if _, err := s.linkApp("u1", "/caderno"); err == nil {
		t.Error("sem FRONTEND_URL não pode gerar link para localhost")
	}
}
