package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// RegistroIgualRecente procura no caderno um registro do mesmo produto e
// quantidade criado desde `desde`. Devolve quando ele foi criado.
//
// Serve para o bot perguntar "já anotei isto, é outro?" quando o produtor
// manda a mesma mensagem duas vezes (reenvio por rede ruim, ou esquecimento).
func (c *Client) RegistroIgualRecente(ctx context.Context, pmoID int64, produto string, qtd float64, desde time.Time) (time.Time, bool, error) {
	q := url.Values{}
	q.Set("select", "criado_em")
	q.Set("pmo_id", fmt.Sprintf("eq.%d", pmoID))
	q.Set("produto", "ilike."+produto)
	q.Set("quantidade_valor", "eq."+strconv.FormatFloat(qtd, 'f', -1, 64))
	q.Set("criado_em", "gte."+desde.UTC().Format(time.RFC3339))
	q.Set("order", "criado_em.desc")
	q.Set("limit", "1")

	body, err := c.doRequestWithContext(ctx, http.MethodGet, c.config.URL+"/rest/v1/caderno_campo?"+q.Encode(), nil)
	if err != nil {
		return time.Time{}, false, fmt.Errorf("RegistroIgualRecente: %w", err)
	}
	var linhas []struct {
		CriadoEm time.Time `json:"criado_em"`
	}
	if err := json.Unmarshal(body, &linhas); err != nil {
		return time.Time{}, false, fmt.Errorf("RegistroIgualRecente: %w", err)
	}
	if len(linhas) == 0 {
		return time.Time{}, false, nil
	}
	return linhas[0].CriadoEm, true, nil
}
