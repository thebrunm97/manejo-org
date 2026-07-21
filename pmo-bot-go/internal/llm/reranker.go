package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
)

// RerankDocuments chama a API de Rerank do OpenRouter (Cohere) para ordenar os documentos
func RerankDocuments(query string, docs []string, topN int) ([]int, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY não definida")
	}

	payload := map[string]interface{}{
		"model":     "cohere/rerank-v3.5",
		"query":     query,
		"documents": docs,
		"top_n":     topN,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("falha ao encodar payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/rerank", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("falha ao criar requisição: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha na requisição de rerank: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("erro da API OpenRouter (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Results []struct {
			Index          int     `json:"index"`
			RelevanceScore float64 `json:"relevance_score"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("falha ao decodar resposta: %w", err)
	}

	var indices []int
	for _, r := range result.Results {
		indices = append(indices, r.Index)
	}

	return indices, nil
}
