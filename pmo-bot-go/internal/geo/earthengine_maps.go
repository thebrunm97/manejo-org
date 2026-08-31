package geo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// MapResponse is the JSON response from GEE Maps API
type MapResponse struct {
	Name        string `json:"name"`
	URLFormat   string `json:"urlFormat"`
	Image       string `json:"image"`
}

// GenerateTilesURL faz o POST para a GEE REST API e obtém o urlFormat
func (c *GEEClient) GenerateTilesURL(ctx context.Context, astJSON string) (string, error) {
	// 1. Preparar Payload (Expression é o AST mapeado)
	type ExpressionPayload struct {
		Expression json.RawMessage `json:"expression"`
	}

	payload := ExpressionPayload{
		Expression: json.RawMessage(astJSON),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("falha ao serializar payload de mapas: %w", err)
	}

	// 2. Montar Request para o endpoint Maps
	url := fmt.Sprintf("%s/projects/%s/maps", c.apiBaseURL, c.auth.ProjectID)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	
	// 3. Executar request com o cliente HTTP autenticado
	client := c.auth.Client()
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("erro na chamada à GEE Maps API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("GEE Maps API retornou %d: %s", resp.StatusCode, string(respBody))
	}

	// 5. Ler resposta
	var mapResp MapResponse
	if err := json.NewDecoder(resp.Body).Decode(&mapResp); err != nil {
		return "", fmt.Errorf("erro ao decodificar MapResponse: %w", err)
	}

	return mapResp.URLFormat, nil
}
