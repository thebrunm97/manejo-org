package supabase

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// GetPropriedadeLocation fetches the location (cidade, estado) or coordinates for a given farm.
// It tries to return a formatted string suitable for the weather API (e.g., "Cidade, Estado" or "lat,lon").
func (c *Client) GetPropriedadeLocation(propriedadeID int64) (string, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/propriedades?id=eq.%d&select=cidade,estado,latitude,longitude", c.config.URL, propriedadeID)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "", err
	}

	var results []struct {
		Cidade    string  `json:"cidade"`
		Estado    string  `json:"estado"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}

	if err := json.Unmarshal(body, &results); err != nil {
		return "", err
	}

	if len(results) == 0 {
		return "", fmt.Errorf("propriedade não encontrada")
	}

	prop := results[0]

	// Preferir coordenadas se existirem
	if prop.Latitude != 0 && prop.Longitude != 0 {
		return fmt.Sprintf("%f,%f", prop.Latitude, prop.Longitude), nil
	}

	// Fallback para Cidade/Estado
	if prop.Cidade != "" && prop.Estado != "" {
		return fmt.Sprintf("%s,%s", prop.Cidade, prop.Estado), nil
	}

	return "", fmt.Errorf("localização (cidade/estado ou latitude/longitude) não cadastrada na propriedade")
}
