package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// GruposAtividade traduz o grupo que o produtor pede ("compras", "colheitas")
// para os valores de caderno_campo.tipo_atividade, que variam conforme quem
// gravou (bot antigo, bot novo, app).
var GruposAtividade = map[string][]string{
	"plantio":  {"Plantio", "PLANTIO", "plantio", "Propagacao"},
	"colheita": {"Colheita", "COLHEITA", "colheita"},
	"manejo":   {"Manejo", "MANEJO", "manejo", "Insumo", "aplicacao_insumo"},
	"compra":   {"Compra de Insumo", "Compra", "Compra/Aquisição"},
	"venda":    {"Venda"},
}

// atividadesOcultas nunca aparecem numa consulta do produtor.
var atividadesOcultas = []string{"CANCELADO", "Teste", "Debug", "None", ""}

// FiltroCaderno restringe a consulta. PmoID é obrigatório; o resto é opcional.
// Desde/Ate em YYYY-MM-DD.
type FiltroCaderno struct {
	PmoID   int64
	Grupo   string
	Desde   string
	Ate     string
	Produto string
	Talhao  string
	Limite  int
}

// RegistroCaderno é uma linha do caderno de campo já com o valor em dinheiro
// (que mora em transacoes_financeiras; a ligação é transacao_alocacoes).
type RegistroCaderno struct {
	ID                string                 `json:"id"`
	DataRegistro      string                 `json:"data_registro"`
	TipoAtividade     string                 `json:"tipo_atividade"`
	Produto           string                 `json:"produto"`
	TalhaoCanteiro    string                 `json:"talhao_canteiro"`
	QuantidadeValor   float64                `json:"quantidade_valor"`
	QuantidadeUnidade string                 `json:"quantidade_unidade"`
	ValorTotal        float64                `json:"valor_total"`
	DetalhesTecnicos  map[string]interface{} `json:"detalhes_tecnicos"`
}

// ConsultarCaderno devolve os registros do PMO, mais recentes primeiro.
func (c *Client) ConsultarCaderno(ctx context.Context, f FiltroCaderno) ([]RegistroCaderno, error) {
	if f.PmoID <= 0 {
		return nil, fmt.Errorf("ConsultarCaderno: pmo_id obrigatório")
	}
	if f.Limite <= 0 || f.Limite > 200 {
		f.Limite = 200
	}

	q := []string{
		"select=id,data_registro,tipo_atividade,produto,talhao_canteiro,quantidade_valor,quantidade_unidade,valor_total,detalhes_tecnicos",
		fmt.Sprintf("pmo_id=eq.%d", f.PmoID),
		"order=data_registro.desc.nullslast,criado_em.desc",
		fmt.Sprintf("limit=%d", f.Limite),
	}
	if tipos, ok := GruposAtividade[f.Grupo]; ok {
		q = append(q, "tipo_atividade=in."+listaPg(tipos))
	} else {
		q = append(q, "tipo_atividade=not.in."+listaPg(atividadesOcultas))
	}
	if f.Desde != "" {
		q = append(q, "data_registro=gte."+pgVal(f.Desde))
	}
	if f.Ate != "" {
		q = append(q, "data_registro=lte."+pgVal(f.Ate))
	}
	if p := strings.TrimSpace(f.Produto); p != "" {
		q = append(q, "or="+pgVal(fmt.Sprintf("(produto.ilike.*%s*,detalhes_tecnicos->>composicao.ilike.*%s*)", limparCuringa(p), limparCuringa(p))))
	}
	if t := strings.TrimSpace(f.Talhao); t != "" {
		q = append(q, "talhao_canteiro=ilike."+pgVal("*"+limparCuringa(t)+"*"))
	}

	body, err := c.doRequestWithContext(ctx, http.MethodGet, c.config.URL+"/rest/v1/caderno_campo?"+strings.Join(q, "&"), nil)
	if err != nil {
		return nil, err
	}
	var regs []RegistroCaderno
	if err := json.Unmarshal(body, &regs); err != nil {
		return nil, fmt.Errorf("ConsultarCaderno: resposta inesperada: %w", err)
	}

	c.preencherValores(ctx, regs)
	return regs, nil
}

// preencherValores busca o valor das compras/vendas: as RPCs gravam o
// dinheiro em transacoes_financeiras e a parte de cada registro do caderno em
// transacao_alocacoes (caderno_campo.valor_total fica vazio). Falha aqui não
// derruba a consulta: o registro só fica sem valor.
func (c *Client) preencherValores(ctx context.Context, regs []RegistroCaderno) {
	var ids []string
	for _, r := range regs {
		if r.ValorTotal == 0 && r.ID != "" {
			ids = append(ids, r.ID)
		}
	}
	if len(ids) == 0 {
		return
	}
	url := fmt.Sprintf("%s/rest/v1/transacao_alocacoes?select=caderno_campo_id,valor_alocado&caderno_campo_id=in.%s",
		c.config.URL, listaPg(ids))
	body, err := c.doRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return
	}
	var alocs []struct {
		CadernoID string  `json:"caderno_campo_id"`
		Valor     float64 `json:"valor_alocado"`
	}
	if json.Unmarshal(body, &alocs) != nil {
		return
	}
	valores := make(map[string]float64, len(alocs))
	for _, a := range alocs {
		valores[a.CadernoID] += a.Valor
	}
	for i := range regs {
		if regs[i].ValorTotal == 0 {
			regs[i].ValorTotal = valores[regs[i].ID]
		}
	}
}

// listaPg monta ("a","b") para filtros in. do PostgREST, já escapado.
func listaPg(vals []string) string {
	partes := make([]string, len(vals))
	for i, v := range vals {
		partes[i] = `"` + strings.ReplaceAll(v, `"`, `\"`) + `"`
	}
	return pgVal("(" + strings.Join(partes, ",") + ")")
}

// limparCuringa tira caracteres que mudam o sentido do filtro or=(...) do
// PostgREST ou do ilike.
func limparCuringa(s string) string {
	return strings.Map(func(r rune) rune {
		switch r {
		case '*', '%', '(', ')', ',', '"', '\\':
			return -1
		}
		return r
	}, s)
}
