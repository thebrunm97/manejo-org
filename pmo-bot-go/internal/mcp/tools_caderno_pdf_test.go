package mcp

import (
	"bytes"
	"os"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestCadernoPDF(t *testing.T) {
	agora := time.Date(2026, 10, 28, 9, 0, 0, 0, time.UTC)
	f := supabase.FiltroCaderno{Desde: "2026-10-01"}
	regs := []supabase.RegistroCaderno{
		{DataRegistro: "2026-10-20", TipoAtividade: "Venda", Produto: "tomate", QuantidadeValor: 12, QuantidadeUnidade: "caixas", ValorTotal: 3600, TalhaoCanteiro: "Machamba de baixo"},
		{DataRegistro: "2026-10-05", TipoAtividade: "Compra", Produto: "adubo", QuantidadeValor: 3, QuantidadeUnidade: "sacos", ValorTotal: 5350, DetalhesTecnicos: map[string]interface{}{"composicao": "NPK 12-24-12 com micronutrientes para hortícolas"}},
		{DataRegistro: "2026-10-02", TipoAtividade: "Plantio", Produto: "feijão-nhemba", TalhaoCanteiro: "Talhão 2"},
	}

	pdf, err := CadernoPDF("+258840000000", f, regs, agora)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(pdf, []byte("%PDF-")) {
		t.Fatalf("não é PDF: %q", pdf[:10])
	}
	// Para olhar o arquivo: CADERNO_PDF_SAIDA=/caminho/caderno.pdf go test -run TestCadernoPDF
	if saida := os.Getenv("CADERNO_PDF_SAIDA"); saida != "" {
		if err := os.WriteFile(saida, pdf, 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestEnviarCadernoPDF_SemCanalFalha(t *testing.T) {
	s := &Server{}
	if _, err := s.handleEnviarCadernoPDF(t.Context(), nil, TenantCtx{PmoID: 1}); err == nil {
		t.Fatal("sem canal de envio devia falhar")
	}
}
