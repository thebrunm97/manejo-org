//go:build e2e

package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/thebrunm97/pmo-bot-go/internal/config"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/webhook"
)

func TestHarvestMutationE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	defer TeardownE2E(t, client)

	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	// 1. Instanciar LLM real (Gemini) e dependências básicas
	_ = config.LoadConfig() // Garante carregamento do .env caso exista

	llmProvider, err := gemini.NewClient(gemini.Config{
		APIKey:        os.Getenv("GEMINI_API_KEY"),
		Model:         "gemini-2.0-flash",
		FallbackModel: "gemini-1.5-flash",
		APIVersion:    "v1",
	})
	assert.NoError(t, err, "Erro ao criar LLM Provider Gemini")

	historyManager := history.NewManager(5*time.Minute, 10)
	mockWpp := &MockMessageSender{}

	// 2. Configurar Webhook Handler
	whConfig := webhook.Config{
		Token:          "test-e2e-token",
		MaxMessageAge:  600,
		SupabaseClient: client,
		LLMClient:      llmProvider,
		WhatsAppClient: mockWpp,
		HistoryManager: historyManager,
	}

	whHandler := webhook.NewHandler(whConfig)

	// 3. Subir httptest server
	gin.SetMode(gin.TestMode)
	r := gin.New()
	whHandler.RegisterRoutes(r)

	ts := httptest.NewServer(r)
	defer ts.Close()

	// 4. Construir o payload fake da Evolution API (Colheita)
	payload := map[string]interface{}{
		"event": "messages.upsert",
		"data": map[string]interface{}{
			"info": map[string]interface{}{
				"ID":       "MSG_E2E_HARVEST_1",
				"Chat":     "5511999999999@s.whatsapp.net",
				"Sender":   "5511999999999@s.whatsapp.net",
				"IsFromMe": false,
				"Type":     "text",
			},
			"message": map[string]interface{}{
				"conversation": "Acabei de colher 30 caixas de tomate no talhao principal",
			},
		},
	}

	body, err := json.Marshal(payload)
	assert.NoError(t, err)

	reqURL := fmt.Sprintf("%s/webhook?token=test-e2e-token", ts.URL)
	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewBuffer(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	// 5. Enviar Request HTTP (Pode demorar uns segundos enquanto bate no LLM)
	t.Log("Enviando requisição de webhook (Colheita)... Aguardando resposta do LLM...")
	start := time.Now()

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "O Webhook deve retornar 200")
	t.Logf("Webhook processado em %v", time.Since(start))

	// Como o webhook pode ter processamento assíncrono final, damos uma margem
	time.Sleep(2 * time.Second)

	// 6. Verificar o BD (Tabela: colheitas)
	getURL := fmt.Sprintf("%s/rest/v1/colheitas?pmo_id=eq.%d", url, TestPMOID)
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

	assert.GreaterOrEqual(t, len(records), 1, "Deveria haver pelo menos 1 colheita inserida")

	foundAmount := false
	for _, rec := range records {
		// A coluna para quantidade pode ser "quantidade", "quantity", etc.
		if val, ok := rec["quantidade"].(float64); ok && val == 30 {
			foundAmount = true
			break
		} else if q, ok := rec["quantity"].(float64); ok && q == 30 {
			foundAmount = true
			break
		}
	}
	assert.True(t, foundAmount, "A colheita com quantidade 30 não foi encontrada")

	if len(mockWpp.SentMessages) > 0 {
		t.Logf("Bot respondeu: %s", mockWpp.SentMessages[len(mockWpp.SentMessages)-1])
	}
}
