package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type MissingEmbeddingResult struct {
	ID         string `json:"id"`
	Fragment   string `json:"fragment"`
	RetryCount int    `json:"retry_count"`
}

// ListMissingEmbeddings fetches up to `limit` fragments that have embedding_missing = true and retry_count < 3
func (c *Client) ListMissingEmbeddings(ctx context.Context, limit int) ([]MissingEmbeddingResult, error) {
	// GET /rest/v1/pmo_memory_cache?select=id,fragment,retry_count&embedding_missing=eq.true&retry_count=lt.3&order=created_at.asc&limit=20
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_memory_cache?select=id,fragment,retry_count&embedding_missing=eq.true&retry_count=lt.3&order=created_at.asc&limit=%d", c.config.URL, limit)

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("supabase.ListMissingEmbeddings: falha ao criar request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("supabase.ListMissingEmbeddings: falha no GET: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase.ListMissingEmbeddings: erro da API %d: %s", resp.StatusCode, string(respBody))
	}

	var results []MissingEmbeddingResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("supabase.ListMissingEmbeddings: falha ao parsear resposta: %w", err)
	}

	return results, nil
}

// IncrementEmbeddingRetry increments the retry_count by 1 using PATCH
func (c *Client) IncrementEmbeddingRetry(ctx context.Context, id string, currentCount int) error {
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_memory_cache?id=eq.%s", c.config.URL, id)

	bodyStr := fmt.Sprintf(`{"retry_count": %d}`, currentCount+1)
	req, err := http.NewRequestWithContext(ctx, "PATCH", reqURL, bytes.NewReader([]byte(bodyStr)))
	if err != nil {
		return fmt.Errorf("supabase.IncrementEmbeddingRetry: falha ao criar request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase.IncrementEmbeddingRetry: falha no PATCH: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase.IncrementEmbeddingRetry: erro da API %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// UpdateMemoryEmbedding updates the embedding and sets embedding_missing = false
func (c *Client) UpdateMemoryEmbedding(ctx context.Context, id string, embedding []float32) error {
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_memory_cache?id=eq.%s", c.config.URL, id)

	payload := map[string]interface{}{
		"embedding":         embedding,
		"embedding_missing": false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("supabase.UpdateMemoryEmbedding: falha no marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", reqURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("supabase.UpdateMemoryEmbedding: falha ao criar request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase.UpdateMemoryEmbedding: falha no PATCH: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase.UpdateMemoryEmbedding: erro da API %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

