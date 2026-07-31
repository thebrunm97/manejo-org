//go:build e2e

package e2e

import (
	"bytes"
	"context"
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

// MockMessageSender avoids sending real WhatsApp messages during tests.
type MockMessageSender struct {
	SentMessages []string
}

func (m *MockMessageSender) SendMessage(to, message string) error {
	m.SentMessages = append(m.SentMessages, message)
	return nil
}
func (m *MockMessageSender) SendVoice(to, base64Audio string, isPtt bool) error { return nil }
func (m *MockMessageSender) SendReply(to, message, replyToMessageID string) error { return nil }
func (m *MockMessageSender) DownloadAudio(messageID string, rawPayload []byte) ([]byte, error) {
	return nil, nil
}
func (m *MockMessageSender) DownloadImage(messageID string, rawPayload []byte) ([]byte, string, error) {
	return nil, "", nil
}
func (m *MockMessageSender) SetPresence(to string, presence string) error                      { return nil }
func (m *MockMessageSender) SendPresence(ctx context.Context, to string, state string) error   { return nil }
func (m *MockMessageSender) SendButton(to string, title, desc, footer string, btn []map[string]string) error {
	return nil
}

func TestExpenseMutationE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	defer TeardownE2E(t, client)

	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	// 1. Instanciar LLM real (Gemini) e dependências básicas
	cfg := config.LoadConfig()

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

	// 4. Construir o payload fake da Evolution API
	// Supomos que "999999999" (ou formato E164) resolve para o PMO 9999 no BD.
	// O Seed de produção deve ter um PMO com ID 9999 e telefone 5511999999999 associado.
	payload := map[string]interface{}{
		"event": "messages.upsert",
		"data": map[string]interface{}{
			"info": map[string]interface{}{
				"ID":       "MSG_E2E_EXPENSE_1",
				"Chat":     "5511999999999@s.whatsapp.net",
				"Sender":   "5511999999999@s.whatsapp.net",
				"IsFromMe": false,
				"Type":     "text",
			},
			"message": map[string]interface{}{
				"conversation": "Comprei 10 sacos de adubo por 500 reais",
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
	t.Log("Enviando requisição de webhook... Aguardando resposta do LLM...")
	start := time.Now()
	
	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "O Webhook deve retornar 200")
	t.Logf("Webhook processado em %v", time.Since(start))

	// Como o webhook executa a lógica legacy ou handler principal (que pode ser async em algumas partes, 
	// mas a resposta LLM geralmente ocorre antes do webhook acabar no modelo legacy sem fila),
	// damos uma margem de segurança de 2 segs se for 100% async. 
	time.Sleep(2 * time.Second)

	// 6. Verificar o BD (Tabela: transacoes_financeiras)
	getURL := fmt.Sprintf("%s/rest/v1/transacoes_financeiras?pmo_id=eq.%d", url, TestPMOID)
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

	assert.GreaterOrEqual(t, len(records), 1, "Deveria haver pelo menos 1 transação inserida")

	foundAmount := false
	for _, rec := range records {
		// A coluna de valor pode se chamar "valor", "amount", etc. 
		// Assumimos que o json unmarshal para float64, conferimos se 500 está presente
		if val, ok := rec["valor"].(float64); ok && val == 500 {
			foundAmount = true
			break
		} else if amount, ok := rec["amount"].(float64); ok && amount == 500 {
			foundAmount = true
			break
		}
	}
	assert.True(t, foundAmount, "A transação financeira no valor de 500 não foi encontrada")
	
	if len(mockWpp.SentMessages) > 0 {
		t.Logf("Bot respondeu: %s", mockWpp.SentMessages[len(mockWpp.SentMessages)-1])
	}
}
