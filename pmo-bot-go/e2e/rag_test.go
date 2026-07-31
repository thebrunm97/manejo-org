//go:build e2e

package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
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

func TestRAGQueryE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	defer TeardownE2E(t, client)

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

	// 4. Construir o payload fake da Evolution API (Pergunta de RAG)
	payload := map[string]interface{}{
		"event": "messages.upsert",
		"data": map[string]interface{}{
			"info": map[string]interface{}{
				"ID":       "MSG_E2E_RAG_1",
				"Chat":     "5511999999999@s.whatsapp.net",
				"Sender":   "5511999999999@s.whatsapp.net",
				"IsFromMe": false,
				"Type":     "text",
			},
			"message": map[string]interface{}{
				"conversation": "Quais são as melhores práticas para a adubação orgânica do tomate?",
			},
		},
	}

	body, err := json.Marshal(payload)
	assert.NoError(t, err)

	reqURL := fmt.Sprintf("%s/webhook?token=test-e2e-token", ts.URL)
	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewBuffer(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	// 5. Enviar Request HTTP
	t.Log("Enviando requisição de webhook (RAG)... Aguardando resposta do LLM...")
	start := time.Now()

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "O Webhook deve retornar 200")
	t.Logf("Webhook processado em %v", time.Since(start))

	// Aguarda processamento assíncrono para garantir que a mensagem foi "enviada" ao cliente mock
	time.Sleep(2 * time.Second)

	// 6. Verificar se o bot respondeu
	assert.GreaterOrEqual(t, len(mockWpp.SentMessages), 1, "O bot deveria ter enviado pelo menos uma mensagem de resposta")
	
	lastMessage := mockWpp.SentMessages[len(mockWpp.SentMessages)-1]
	t.Logf("Bot respondeu: %s", lastMessage)

	assert.NotEmpty(t, lastMessage, "A mensagem do bot não pode estar vazia")
	assert.False(t, strings.Contains(lastMessage, "erro crítico"), "A resposta do LLM não deve ser um erro fatal do sistema")
}
