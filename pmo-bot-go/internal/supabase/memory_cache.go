package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type MatchPMOMemoryCacheParams struct {
	PmoID     int64     `json:"p_pmo_id"`
	Embedding []float32 `json:"p_embedding"`
	Threshold float32   `json:"p_threshold"`
	Limit     int       `json:"p_limit"`
}

type MatchPMOMemoryCacheResult struct {
	ID              string    `json:"id"`
	Fragment        string    `json:"fragment"`
	Category        string    `json:"category"`
	Source          string    `json:"source"`
	ImportanceScore float64   `json:"importance_score"`
	Similarity      float64   `json:"similarity"`
	CreatedAt       time.Time `json:"created_at"`
}

type SavePMOMemoryCacheParams struct {
	PmoID            int64     `json:"p_pmo_id"`
	UserID           string    `json:"p_user_id"`
	Fragment         string    `json:"p_fragment"`
	ContentHash      string    `json:"p_content_hash"`
	Source           string    `json:"p_source"`
	Category         string    `json:"p_category"`
	ImportanceScore  float32   `json:"p_importance_score"`
	Embedding        []float32 `json:"p_embedding"` // sem omitempty para forçar null explícito
	EmbeddingMissing bool      `json:"p_embedding_missing"`
	ExpiresAt        time.Time `json:"p_expires_at"`
}

func (c *Client) SaveMemoryCache(ctx context.Context, pmoID int64, userID, fragment, contentHash, source, category string, score float32, embedding []float32, embeddingMissing bool, expiresAt time.Time) error {
	params := SavePMOMemoryCacheParams{
		PmoID:            pmoID,
		UserID:           userID,
		Fragment:         fragment,
		ContentHash:      contentHash,
		Source:           source,
		Category:         category,
		ImportanceScore:  score,
		Embedding:        embedding,
		EmbeddingMissing: embeddingMissing,
		ExpiresAt:        expiresAt,
	}

	body, err := json.Marshal(params)
	if err != nil {
		return fmt.Errorf("supabase.SaveMemoryCache: falha ao fazer marshal: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/rpc/save_pmo_memory_cache", c.config.URL)
	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("supabase.SaveMemoryCache: falha ao criar request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase.SaveMemoryCache: falha no POST: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase.SaveMemoryCache: erro da API %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

func (c *Client) MatchMemoryCache(ctx context.Context, pmoID int64, embedding []float32, threshold float32, limit int) ([]MatchPMOMemoryCacheResult, error) {
	params := MatchPMOMemoryCacheParams{
		PmoID:     pmoID,
		Embedding: embedding,
		Threshold: threshold,
		Limit:     limit,
	}

	body, err := json.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("supabase.MatchMemoryCache: falha ao fazer marshal: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/rpc/match_pmo_memory_cache", c.config.URL)
	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("supabase.MatchMemoryCache: falha ao criar request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("supabase.MatchMemoryCache: falha no POST: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase.MatchMemoryCache: erro da API %d: %s", resp.StatusCode, string(respBody))
	}

	var results []MatchPMOMemoryCacheResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, fmt.Errorf("supabase.MatchMemoryCache: falha ao parsear resposta: %w", err)
	}

	return results, nil
}
