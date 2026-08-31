package geo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GEEClient fornece acesso à REST API do Google Earth Engine.
type GEEClient struct {
	auth       *GEEAuth
	apiBaseURL string
}

// NewGEEClient cria uma nova instância do cliente GEE.
func NewGEEClient(auth *GEEAuth) *GEEClient {
	return &GEEClient{
		auth:       auth,
		apiBaseURL: "https://earthengine.googleapis.com/v1",
	}
}

// Ping faz uma requisição mínima autenticada para validar a conexão com o GEE.
func (c *GEEClient) Ping(ctx context.Context) (map[string]interface{}, error) {
	// Limite máximo de tempo para o request de diagnóstico
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Um endpoint simples para testar autenticação na REST API v1
	// Consultar um asset público (Sentinel-2) garante que o Earth Engine está respondendo
	url := fmt.Sprintf("%s/projects/earthengine-public/assets/COPERNICUS/S2", c.apiBaseURL)

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar requisição GEE: %w", err)
	}

	// client injetará automaticamente o token OAuth2 no header Authorization
	client := c.auth.Client()
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha ao realizar chamada HTTP para GEE: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Earth Engine API retornou status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("falha ao decodificar JSON de resposta GEE: %w", err)
	}

	return result, nil
}
