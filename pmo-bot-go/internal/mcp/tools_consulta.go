package mcp

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// maxLinhasConsulta: quantas linhas cabem numa mensagem de WhatsApp sem virar
// rolagem. O resto vai resumido no "e mais N" (e, na fase 2, no link do app).
const maxLinhasConsulta = 8

var tituloGrupo = map[string][2]string{ // [BR, MZ]
	"":         {"Registros", "Registos"},
	"plantio":  {"Plantios", "Sementeiras e plantios"},
	"colheita": {"Colheitas", "Colheitas"},
	"manejo":   {"Manejos e aplicações", "Manejos e aplicações"},
	"compra":   {"Compras", "Compras"},
	"venda":    {"Vendas", "Vendas"},
}

func (s *Server) handleConsultarRegistros(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	grupo, _ := args["tipo"].(string)
	if grupo == "todos" {
		grupo = ""
	}
	if _, ok := supabase.GruposAtividade[grupo]; grupo != "" && !ok {
		return nil, fmt.Errorf("tipo desconhecido: %s", grupo)
	}
	f := supabase.FiltroCaderno{PmoID: tenant.PmoID, Grupo: grupo}
	f.Desde, _ = args["data_inicio"].(string)
	f.Ate, _ = args["data_fim"].(string)
	f.Produto, _ = args["produto"].(string)
	f.Talhao, _ = args["talhao"].(string)
	for _, d := range []string{f.Desde, f.Ate} {
		if d != "" {
			if _, err := time.Parse("2006-01-02", d); err != nil {
				return nil, fmt.Errorf("data inválida %q (use AAAA-MM-DD)", d)
			}
		}
	}

	regs, err := s.supabase.ConsultarCaderno(ctx, f)
	if err != nil {
		return nil, fmt.Errorf("erro ao consultar o caderno de campo: %w", err)
	}

	return map[string]interface{}{
		"status":     "success",
		"quantidade": len(regs),
		"texto":      TextoConsulta(tenant.Telefone, grupo, f, regs, time.Now()),
		"message": "Mostre o campo 'texto' ao produtor exatamente como está (é a resposta pronta, " +
			"já no formato do WhatsApp). Não invente, não some nem recalcule registos. " +
			"Pode acrescentar no máximo uma frase curta depois, sem repetir os números.",
	}, nil
}

// TextoConsulta monta a resposta pronta para o WhatsApp.
func TextoConsulta(phone, grupo string, f supabase.FiltroCaderno, regs []supabase.RegistroCaderno, agora time.Time) string {
	mz := ehMZ(phone)
	pais := 0
	if mz {
		pais = 1
	}
	periodo := descreverPeriodo(f.Desde, f.Ate, agora)
	filtro := ""
	if f.Produto != "" {
		filtro += " de " + f.Produto
	}
	if f.Talhao != "" {
		filtro += " em " + f.Talhao
	}

	if len(regs) == 0 {
		nada := "Não encontrei registros"
		if mz {
			nada = "Não encontrei registos"
		}
		if grupo != "" {
			nada += " de " + strings.ToLower(tituloGrupo[grupo][pais])
		}
		return nada + filtro + periodo + "."
	}

	var b strings.Builder
	palavra := "registro"
	if mz {
		palavra = "registo"
	}
	if len(regs) != 1 {
		palavra += "s"
	}
	fmt.Fprintf(&b, "📒 *%s*%s%s — %d %s\n", tituloGrupo[grupo][pais], filtro, periodo, len(regs), palavra)

	moeda := utils.MoedaSimboloPara(phone)
	var total float64
	for i, r := range regs {
		total += r.ValorTotal
		if i >= maxLinhasConsulta {
			continue
		}
		b.WriteString("\n• " + linhaRegistro(r, grupo == "", moeda, agora))
	}
	if n := len(regs) - maxLinhasConsulta; n > 0 {
		fmt.Fprintf(&b, "\n…e mais %d.", n)
	}
	// Só soma dinheiro quando o grupo é de um sentido só: juntar compra com
	// venda daria um número sem significado.
	if total > 0 && (grupo == "compra" || grupo == "venda") {
		rotulo := "Total gasto"
		if grupo == "venda" {
			rotulo = "Total vendido"
		}
		fmt.Fprintf(&b, "\n\n*%s:* %s %s", rotulo, utils.FormatarValor(total), moeda)
	}
	return b.String()
}

func linhaRegistro(r supabase.RegistroCaderno, comTipo bool, moeda string, agora time.Time) string {
	var partes []string
	partes = append(partes, dataCurta(r.DataRegistro, agora))
	if comTipo && r.TipoAtividade != "" {
		partes = append(partes, rotuloAtividade(r.TipoAtividade))
	}

	prod := strings.TrimSpace(r.Produto)
	if comp, _ := r.DetalhesTecnicos["composicao"].(string); strings.TrimSpace(comp) != "" && !strings.EqualFold(comp, prod) {
		if prod == "" {
			prod = comp
		} else {
			prod += " (" + strings.TrimSpace(comp) + ")"
		}
	}
	if prod != "" {
		partes = append(partes, prod)
	}

	if r.QuantidadeValor > 0 {
		q := numeroCurto(r.QuantidadeValor) + " " + strings.TrimSpace(r.QuantidadeUnidade)
		if peso := pesoUnidade(r.DetalhesTecnicos); peso > 0 {
			q += " (" + numeroCurto(peso*r.QuantidadeValor) + " kg)"
		}
		partes = append(partes, strings.TrimSpace(q))
	}
	if t := strings.TrimSpace(r.TalhaoCanteiro); t != "" {
		partes = append(partes, t)
	}
	if r.ValorTotal > 0 {
		partes = append(partes, utils.FormatarValor(r.ValorTotal)+" "+moeda)
	}
	return strings.Join(partes, " · ")
}

func rotuloAtividade(tipo string) string {
	for grupo, tipos := range supabase.GruposAtividade {
		for _, t := range tipos {
			if t == tipo {
				return map[string]string{
					"plantio": "Plantio", "colheita": "Colheita", "manejo": "Manejo",
					"compra": "Compra", "venda": "Venda",
				}[grupo]
			}
		}
	}
	return tipo
}

func pesoUnidade(d map[string]interface{}) float64 {
	switch v := d["peso_unidade_kg"].(type) {
	case float64:
		return v
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	}
	return 0
}

// dataCurta: "19/10" no ano corrente, "19/10/25" fora dele.
func dataCurta(iso string, agora time.Time) string {
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	if t.Year() == agora.Year() {
		return t.Format("02/01")
	}
	return t.Format("02/01/06")
}

func descreverPeriodo(desde, ate string, agora time.Time) string {
	switch {
	case desde != "" && ate != "":
		return " de " + dataCurta(desde, agora) + " a " + dataCurta(ate, agora)
	case desde != "":
		return " desde " + dataCurta(desde, agora)
	case ate != "":
		return " até " + dataCurta(ate, agora)
	}
	return ""
}

func numeroCurto(f float64) string {
	if f == float64(int64(f)) {
		return strconv.FormatInt(int64(f), 10)
	}
	return strings.Replace(strconv.FormatFloat(f, 'f', -1, 64), ".", ",", 1)
}
