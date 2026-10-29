package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// RegistroAve é um evento de avicultura no caderno de campo. O evento, a
// finalidade e o resto do detalhe vêm em detalhes_tecnicos (o payload da RPC).
type RegistroAve struct {
	DataRegistro     string                 `json:"data_registro"`
	Lote             string                 `json:"lote"`
	Produto          string                 `json:"produto"`
	QuantidadeValor  float64                `json:"quantidade_valor"`
	DetalhesTecnicos map[string]interface{} `json:"detalhes_tecnicos"`
}

// ListarAvicultura devolve todos os eventos de aves do PMO, do mais antigo
// para o mais recente (o resumo do lote soma desde a entrada).
func (c *Client) ListarAvicultura(ctx context.Context, pmoID int64) ([]RegistroAve, error) {
	q := url.Values{}
	q.Set("select", "data_registro,lote,produto,quantidade_valor,detalhes_tecnicos")
	q.Set("pmo_id", fmt.Sprintf("eq.%d", pmoID))
	q.Set("tipo_atividade", "eq.Avicultura")
	q.Set("order", "data_registro.asc,criado_em.asc")
	q.Set("limit", "5000")

	body, err := c.doRequestWithContext(ctx, http.MethodGet, c.config.URL+"/rest/v1/caderno_campo?"+q.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("ListarAvicultura: %w", err)
	}
	var regs []RegistroAve
	if err := json.Unmarshal(body, &regs); err != nil {
		return nil, fmt.Errorf("ListarAvicultura: resposta inesperada: %w", err)
	}
	return regs, nil
}
