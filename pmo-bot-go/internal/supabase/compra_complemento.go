package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

// ComplementarCompraInsumo grava o tipo (composição) e o peso por unidade de
// uma compra já registrada (rpc_complementar_compra_insumo). Valor vazio ou
// zero não mexe no campo.
func (c *Client) ComplementarCompraInsumo(ctx context.Context, compraID, userID, composicao string, pesoUnidadeKg float64) error {
	args := map[string]interface{}{
		"compra_id_arg": compraID,
		"user_id_arg":   userID,
	}
	if composicao != "" {
		args["composicao_arg"] = composicao
	}
	if pesoUnidadeKg > 0 {
		args["peso_unidade_kg_arg"] = pesoUnidadeKg
	}
	payload, _ := json.Marshal(args)

	body, err := c.doRequestWithContext(ctx, http.MethodPost, c.config.URL+"/rest/v1/rpc/rpc_complementar_compra_insumo", payload)
	if err != nil {
		return err
	}
	var res struct {
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return fmt.Errorf("resposta inesperada do complemento: %w", err)
	}
	if res.Status != "success" {
		return fmt.Errorf("complemento recusado: %s", res.Message)
	}
	return nil
}

// PesoUnidadeConhecido devolve o peso por unidade que o produtor já informou
// numa compra anterior do mesmo produto e unidade ("saco de adubo = 50 kg"),
// para o bot não perguntar de novo.
func (c *Client) PesoUnidadeConhecido(ctx context.Context, userID, produto, unidade string) (float64, bool) {
	url := fmt.Sprintf("%s/rest/v1/caderno_campo?select=detalhes_tecnicos&user_id=eq.%s&tipo_atividade=eq.%s&produto=ilike.%s&quantidade_unidade=ilike.%s&detalhes_tecnicos->>peso_unidade_kg=not.is.null&order=data_registro.desc&limit=1",
		c.config.URL, pgVal(userID), pgVal("Compra de Insumo"), pgVal(produto), pgVal(unidade))
	body, err := c.doRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, false
	}
	var rows []struct {
		Detalhes map[string]interface{} `json:"detalhes_tecnicos"`
	}
	if json.Unmarshal(body, &rows) != nil || len(rows) == 0 {
		return 0, false
	}
	switch v := rows[0].Detalhes["peso_unidade_kg"].(type) {
	case float64:
		return v, v > 0
	case string:
		f, err := strconv.ParseFloat(v, 64)
		return f, err == nil && f > 0
	}
	return 0, false
}
