//go:build e2e

package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSmokeE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	defer TeardownE2E(t, client)

	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	// Payload para inserir na tabela memoria_llm
	payload := map[string]interface{}{
		"pmo_id":  TestPMOID,
		"role":    "user",
		"content": "SMOKE TEST MESSAGE",
	}

	body, err := json.Marshal(payload)
	assert.NoError(t, err)

	reqURL := fmt.Sprintf("%s/rest/v1/memoria_llm", url)
	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewBuffer(body))
	assert.NoError(t, err)

	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	// Prefer: return=representation para devolver o objeto criado
	req.Header.Set("Prefer", "return=representation")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	respBody, _ := io.ReadAll(resp.Body)
	t.Logf("Resposta do Insert: %s", string(respBody))

	// Fazer um GET para confirmar se foi inserida
	getURL := fmt.Sprintf("%s/rest/v1/memoria_llm?pmo_id=eq.%d", url, TestPMOID)
	getReq, err := http.NewRequest(http.MethodGet, getURL, nil)
	assert.NoError(t, err)

	getReq.Header.Set("apikey", key)
	getReq.Header.Set("Authorization", "Bearer "+key)

	getResp, err := httpClient.Do(getReq)
	assert.NoError(t, err)
	defer getResp.Body.Close()

	assert.Equal(t, http.StatusOK, getResp.StatusCode)

	getRespBody, _ := io.ReadAll(getResp.Body)
	var records []map[string]interface{}
	err = json.Unmarshal(getRespBody, &records)
	assert.NoError(t, err)

	assert.GreaterOrEqual(t, len(records), 1)
	
	found := false
	for _, rec := range records {
		if rec["content"] == "SMOKE TEST MESSAGE" {
			found = true
			break
		}
	}
	assert.True(t, found, "A mensagem de smoke test não foi encontrada no retorno do banco de dados")
}
