package mcp

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// handleEnviarCadernoPDF manda o caderno do período como PDF pelo WhatsApp.
// É o "levar para mostrar" de quem não usa o app (a maioria em Moçambique, sem
// e-mail nem dados para abrir um site): comprador, banco, extensionista.
func (s *Server) handleEnviarCadernoPDF(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	if s.enviarDocumento == nil {
		return nil, fmt.Errorf("envio de arquivos indisponível")
	}
	agora := time.Now().In(utils.TimezoneSistema())
	f := supabase.FiltroCaderno{PmoID: tenant.PmoID}
	f.Desde, _ = args["data_inicio"].(string)
	f.Ate, _ = args["data_fim"].(string)
	for _, d := range []string{f.Desde, f.Ate} {
		if d != "" {
			if _, err := time.Parse("2006-01-02", d); err != nil {
				return nil, fmt.Errorf("data inválida %q (use AAAA-MM-DD)", d)
			}
		}
	}
	if f.Desde == "" && f.Ate == "" {
		f.Desde = agora.Format("2006-01") + "-01"
	}

	regs, err := s.supabase.ConsultarCaderno(ctx, f)
	if err != nil {
		return nil, fmt.Errorf("erro ao consultar o caderno de campo: %w", err)
	}
	if len(regs) == 0 {
		return map[string]interface{}{
			"status":          "success",
			"resposta_direta": TextoConsulta(tenant.Telefone, "", f, regs, agora),
			"message":         "Nada no período; nenhum arquivo enviado.",
		}, nil
	}

	pdf, err := CadernoPDF(tenant.Telefone, f, regs, agora)
	if err != nil {
		return nil, err
	}
	nome := "caderno-" + strings.ReplaceAll(strings.TrimSpace(periodoArquivo(f, agora)), " ", "-") + ".pdf"
	para := strings.SplitN(strings.TrimPrefix(tenant.Telefone, "+"), "@", 2)[0]
	if err := s.enviarDocumento(ctx, para, nome, "Caderno de campo"+descreverPeriodo(f.Desde, f.Ate, agora), pdf); err != nil {
		return nil, fmt.Errorf("não consegui enviar o PDF: %w", err)
	}

	palavra := "registros"
	if ehMZ(tenant.Telefone) {
		palavra = "registos"
	}
	return map[string]interface{}{
		"status": "success",
		"resposta_direta": fmt.Sprintf("📄 Enviei o caderno%s em PDF (%d %s). Pode guardar ou mostrar a quem precisar.",
			descreverPeriodo(f.Desde, f.Ate, agora), len(regs), palavra),
		"message": "PDF enviado ao produtor.",
	}, nil
}

func periodoArquivo(f supabase.FiltroCaderno, agora time.Time) string {
	desde, ate := f.Desde, f.Ate
	if ate == "" {
		ate = agora.Format("2006-01-02")
	}
	if desde == "" {
		return "ate-" + ate
	}
	return desde + "-a-" + ate
}

// CadernoPDF gera o caderno do período: uma tabela cronológica e, no fim, as
// contagens por tipo e o saldo de vendas menos compras.
func CadernoPDF(phone string, f supabase.FiltroCaderno, regs []supabase.RegistroCaderno, agora time.Time) ([]byte, error) {
	mz := ehMZ(phone)
	moeda := utils.MoedaSimboloPara(phone)

	ordem := append([]supabase.RegistroCaderno(nil), regs...)
	sort.SliceStable(ordem, func(i, j int) bool { return ordem[i].DataRegistro < ordem[j].DataRegistro })

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 12, 10)
	pdf.SetAutoPageBreak(true, 14)
	// As fontes padrão do PDF são cp1252: sem o tradutor os acentos saem quebrados.
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetFooterFunc(func() {
		pdf.SetY(-10)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(120, 120, 120)
		pdf.CellFormat(0, 5, tr(fmt.Sprintf("ManejoORG · gerado em %s · página %d", agora.Format("02/01/2006 15:04"), pdf.PageNo())), "", 0, "C", false, 0, "")
	})
	pdf.AddPage()

	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(30, 30, 30)
	pdf.CellFormat(0, 9, tr("Caderno de campo"), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	// No papel o período vai completo, com ano e data final.
	ate := f.Ate
	if ate == "" {
		ate = agora.Format("2006-01-02")
	}
	periodo := "até " + dataPDF(ate)
	if f.Desde != "" {
		periodo = dataPDF(f.Desde) + " a " + dataPDF(ate)
	}
	palavra := "registros"
	if mz {
		palavra = "registos"
	}
	pdf.CellFormat(0, 6, tr(fmt.Sprintf("Período: %s · %d %s", periodo, len(regs), palavra)), "", 1, "L", false, 0, "")
	pdf.Ln(3)

	cols := []struct {
		titulo  string
		largura float64
		alinha  string
	}{
		{"Data", 20, "L"}, {"Atividade", 24, "L"}, {"Produto", 54, "L"}, {"Quantidade", 32, "L"}, {"Local", 30, "L"}, {"Valor", 30, "R"},
	}
	cabecalho := func() {
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(225, 239, 225)
		for _, c := range cols {
			pdf.CellFormat(c.largura, 7, tr(c.titulo), "B", 0, c.alinha, true, 0, "")
		}
		pdf.Ln(-1)
		pdf.SetFont("Helvetica", "", 9)
	}
	cabecalho()

	var gasto, vendido float64
	contagem := map[string]int{}
	for i, r := range ordem {
		if pdf.GetY() > 270 {
			pdf.AddPage()
			cabecalho()
		}
		g := grupoDe(r.TipoAtividade)
		contagem[g]++
		switch g {
		case "compra":
			gasto += r.ValorTotal
		case "venda":
			vendido += r.ValorTotal
		}
		qtd := ""
		if r.QuantidadeValor > 0 {
			qtd = strings.TrimSpace(numeroCurto(r.QuantidadeValor) + " " + strings.TrimSpace(r.QuantidadeUnidade))
		}
		valor := ""
		if r.ValorTotal > 0 {
			valor = utils.FormatarValor(r.ValorTotal) + " " + moeda
		}
		celulas := []string{dataPDF(r.DataRegistro), rotuloAtividade(r.TipoAtividade), rotuloProduto(r), qtd, strings.TrimSpace(r.TalhaoCanteiro), valor}
		pdf.SetFillColor(246, 246, 246)
		for k, c := range cols {
			pdf.CellFormat(c.largura, 6, caber(pdf, tr(celulas[k]), c.largura-1.5), "", 0, c.alinha, i%2 == 1, 0, "")
		}
		pdf.Ln(-1)
	}

	pdf.Ln(5)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(0, 7, tr("Resumo"), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pais := 0
	if mz {
		pais = 1
	}
	for _, g := range []string{"plantio", "manejo", "colheita", "compra", "venda"} {
		if contagem[g] > 0 {
			pdf.CellFormat(0, 6, tr(fmt.Sprintf("%s: %d", tituloGrupo[g][pais], contagem[g])), "", 1, "L", false, 0, "")
		}
	}
	if n := contagem[""]; n > 0 {
		pdf.CellFormat(0, 6, tr(fmt.Sprintf("Outros: %d", n)), "", 1, "L", false, 0, "")
	}
	if gasto > 0 || vendido > 0 {
		pdf.Ln(2)
		pdf.CellFormat(0, 6, tr("Compras: "+utils.FormatarValor(gasto)+" "+moeda), "", 1, "L", false, 0, "")
		pdf.CellFormat(0, 6, tr("Vendas: "+utils.FormatarValor(vendido)+" "+moeda), "", 1, "L", false, 0, "")
		saldo, sinal := vendido-gasto, ""
		if saldo < 0 {
			saldo, sinal = -saldo, "-"
		}
		pdf.SetFont("Helvetica", "B", 10)
		pdf.CellFormat(0, 6, tr("Vendas - compras: "+sinal+utils.FormatarValor(saldo)+" "+moeda), "", 1, "L", false, 0, "")
		pdf.SetFont("Helvetica", "I", 8)
		pdf.CellFormat(0, 5, tr("Outras despesas ficam no balanço financeiro."), "", 1, "L", false, 0, "")
	}
	if aviso := strings.TrimSpace(strings.Trim(avisoLimite(regs, f, mz), "\n_")); aviso != "" {
		pdf.SetFont("Helvetica", "I", 8)
		pdf.MultiCell(0, 5, tr(aviso), "", "L", false)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("gerar PDF: %w", err)
	}
	return buf.Bytes(), nil
}

// caber corta o texto com "..." para não invadir a coluna vizinha. Recebe o
// texto já em cp1252 (um byte por letra), por isso corta por byte.
func caber(pdf *fpdf.Fpdf, s string, largura float64) string {
	if pdf.GetStringWidth(s) <= largura {
		return s
	}
	for len(s) > 0 && pdf.GetStringWidth(s+"...") > largura {
		s = s[:len(s)-1]
	}
	return s + "..."
}

// dataPDF: no papel a data vai sempre com o ano.
func dataPDF(iso string) string {
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	return t.Format("02/01/2006")
}
