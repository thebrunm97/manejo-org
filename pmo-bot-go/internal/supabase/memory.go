package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type UserMemory struct {
	PmoID       string    `json:"pmo_id"`
	PhoneNumber string    `json:"phone_number"`
	Fact        string    `json:"fact"`
	Category    string    `json:"category"`
	Embedding   []float32 `json:"embedding"`
}

// SaveUserMemory salva um fato persistente na tabela user_memory_profiles
func (c *Client) SaveUserMemory(ctx context.Context, pmoID string, phone string, fact string, category string, embedding []float32) error {
	mem := UserMemory{
		PmoID:       pmoID,
		PhoneNumber: phone,
		Fact:        fact,
		Category:    category,
		Embedding:   embedding,
	}

	payload, err := json.Marshal(mem)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/rest/v1/user_memory_profiles", c.config.URL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erro ao salvar memória: %d - %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

type MatchMemoryRequest struct {
	QueryEmbedding []float32 `json:"query_embedding"`
	MatchPmoID     string    `json:"match_pmo_id"`
	MatchThreshold float64   `json:"match_threshold"`
	MatchCount     int       `json:"match_count"`
}

type MemoryMatchResult struct {
	ID         string  `json:"id"`
	Fact       string  `json:"fact"`
	Category   string  `json:"category"`
	Similarity float64 `json:"similarity"`
}

// MatchUserMemory busca fatos relevantes na memória do produtor usando a RPC vetorial
func (c *Client) MatchUserMemory(ctx context.Context, pmoID string, embedding []float32) ([]MemoryMatchResult, error) {
	reqBody := MatchMemoryRequest{
		QueryEmbedding: embedding,
		MatchPmoID:     pmoID,
		MatchThreshold: 0.70, // Default threshold para aceitação de semelhança
		MatchCount:     5,    // Traz até 5 memórias mais relevantes
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/rest/v1/rpc/match_user_memory", c.config.URL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("erro ao buscar memória: %d - %s", resp.StatusCode, string(bodyBytes))
	}

	var results []MemoryMatchResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, err
	}

	return results, nil
}
