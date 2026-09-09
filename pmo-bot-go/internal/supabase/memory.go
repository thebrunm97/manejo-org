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

// MatchUserMemory (RPC match_user_memory) removido — DT-106. A tabela
// user_memory_profiles nunca existiu em produção nem staging (a migration
// que a criava referenciava `pmo(id)`, tabela inexistente; a real é `pmos`,
// com id BIGINT, não UUID) e a RPC nunca chegou a existir. Todo turno com
// PMO ativo pagava uma chamada de embedding só pra essa busca falhar sempre
// (ver specialized_handlers.go). SaveUserMemory continua — ainda usado pela
// ferramenta SalvarMemoriaProdutor (internal/mcp/tools_memory.go), que
// também sempre falha hoje pelo mesmo motivo; decisão de produto pendente
// sobre construir de verdade (padrão mais maduro do pmo_memory_cache,
// DT-93) ou aposentar a ferramenta — ver DT-106 em debitos_tecnicos.md.
