package supabase

import (
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
