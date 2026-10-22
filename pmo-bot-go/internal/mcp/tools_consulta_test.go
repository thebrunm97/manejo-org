package mcp

import (
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
