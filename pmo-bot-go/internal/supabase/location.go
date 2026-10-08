package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// GetPropriedadeLocation devolve a localização da propriedade como "Cidade,UF".
//
// Esta função estava quebrada: pedia `select=cidade,estado,latitude,longitude`,
// e nenhuma dessas três últimas colunas existe em `propriedades`. As colunas
// reais são id, created_at, nome, area_total_ha, cidade, uf, user_id,
// tem_producao_paralela, modalidade_predominante, car, inscricao_estadual,
// matricula e endereco_cadastral. O PostgREST responde 400 (42703, "column
// does not exist") a qualquer coluna desconhecida, então TODA chamada falhava —
// e com ela o fallback de localização da ferramenta de previsão do tempo, que
// só conseguia responder quando o produtor digitava a cidade na própria frase.
//
// O formato "Cidade,UF" é consumido por dois caminhos com exigências
// diferentes: o geocoding do Open-Meteo descarta a UF e usa só o nome, enquanto
// o ZARC PRECISA dela — há municípios homônimos em estados diferentes (Bom
// Jesus existe em oito UFs). Por isso a UF continua fazendo parte do retorno,
// mesmo sendo dispensável para o clima.
func (c *Client) GetPropriedadeLocation(propriedadeID int64) (string, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/propriedades?id=eq.%d&select=cidade,uf", c.config.URL, propriedadeID)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "", err
	}

	var results []struct {
		Cidade string `json:"cidade"`
		UF     string `json:"uf"`
	}

	if err := json.Unmarshal(body, &results); err != nil {
		return "", err
	}

	if len(results) == 0 {
		return "", fmt.Errorf("propriedade não encontrada")
	}

	prop := results[0]
	if prop.Cidade != "" && prop.UF != "" {
		return fmt.Sprintf("%s,%s", prop.Cidade, prop.UF), nil
	}

	return "", fmt.Errorf("localização (cidade/UF) não cadastrada na propriedade")
}

// LocalizacaoPropriedade é a localização da propriedade com o país.
//
// Para pais = "MZ", Cidade é o DISTRITO e UF é a PROVÍNCIA em código
// ISO 3166-2:MZ (ver internal/zae.Provincias) — as mesmas colunas, sem
// migração de schema além de propriedades.pais.
type LocalizacaoPropriedade struct {
	Cidade string
	UF     string
	Pais   string // ISO 3166-1 alfa-2; "BR" quando a coluna não existe ou está vazia
}

// GetPropriedadeLocalizacao lê cidade, UF e país da propriedade.
//
// select=* de propósito: a coluna `pais` chega por migration, e o bot pode
// ir para produção antes dela (o deploy do bot e o pipeline de migrations são
// independentes). Pedir `pais` explicitamente faria o PostgREST responder 400
// e derrubaria a consulta de janela de plantio dos produtores brasileiros
// nesse intervalo; com `*`, a coluna ausente só vira "BR".
func (c *Client) GetPropriedadeLocalizacao(propriedadeID int64) (LocalizacaoPropriedade, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/propriedades?id=eq.%d&select=*", c.config.URL, propriedadeID)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return LocalizacaoPropriedade{}, err
	}

	var results []struct {
		Cidade string `json:"cidade"`
		UF     string `json:"uf"`
		Pais   string `json:"pais"`
	}
	if err := json.Unmarshal(body, &results); err != nil {
		return LocalizacaoPropriedade{}, err
	}
	if len(results) == 0 {
		return LocalizacaoPropriedade{}, fmt.Errorf("propriedade não encontrada")
	}

	p := results[0]
	pais := p.Pais
	if pais == "" {
		pais = "BR"
	}
	return LocalizacaoPropriedade{Cidade: p.Cidade, UF: p.UF, Pais: pais}, nil
}

// DefinirPaisPropriedade grava o país (ISO 3166-1 alfa-2) da propriedade.
func (c *Client) DefinirPaisPropriedade(ctx context.Context, propriedadeID int64, pais string) error {
	reqURL := fmt.Sprintf("%s/rest/v1/propriedades?id=eq.%d", c.config.URL, propriedadeID)
	payload, _ := json.Marshal(map[string]string{"pais": pais})
	_, err := c.doRequestWithContext(ctx, http.MethodPatch, reqURL, payload)
	return err
}
