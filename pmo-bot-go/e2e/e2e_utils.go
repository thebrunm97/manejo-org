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
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/agriculture"
	"github.com/thebrunm97/pmo-bot-go/internal/config"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/embedcache"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/plantioref"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/weather"
	"github.com/thebrunm97/pmo-bot-go/internal/webhook"
	"github.com/thebrunm97/pmo-bot-go/internal/zae"
)

// Fixture: e2e/fixture.sql cria o produtor com este telefone, dono do PMO
// TestPMOID (com propriedade e talhão), já como PMO ativo.
const (
	TestPMOID int64 = 9999
	TestPhone       = "5511999999999"
	TestPhoneMZ     = "258841234567" // produtor de Moçambique: machamba em Boane (fixture.sql)

	webhookToken = "test-e2e-token"

	// O webhook só enfileira; o processamento (roteador + LLM + ferramentas)
	// roda num worker em background e leva dezenas de segundos com LLM real.
	esperaProcessamento = 90 * time.Second
)

func SetupSupabaseClient(t *testing.T) *supabase.Client {
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	if url == "" || key == "" {
		t.Fatalf("SUPABASE_URL e SUPABASE_KEY sao obrigatorios para testes E2E")
	}

	client, err := supabase.NewClient(supabase.Config{URL: url, Key: key})
	if err != nil {
		t.Fatalf("Erro ao inicializar supabase client: %v", err)
	}

	return client
}

// limpezaE2E lista o que os testes escrevem no fixture. Antes a lista tinha
// 4 tabelas que não existem mais (memoria_llm, operacoes_agronomicas,
// colheitas, farm_documents_chunks) e não limpava caderno_campo, onde colheita
// e operações de campo de fato vão parar.
var limpezaE2E = []string{
	// transacoes_financeiras antes de caderno_campo: transacao_alocacoes
	// referencia os dois, mas só cascateia a partir da transação.
	fmt.Sprintf("transacoes_financeiras?pmo_id=eq.%d", TestPMOID),
	fmt.Sprintf("caderno_campo?pmo_id=eq.%d", TestPMOID),
	fmt.Sprintf("pmo_insumos?pmo_id=eq.%d", TestPMOID),
	fmt.Sprintf("mutation_drafts?pmo_id=eq.%d", TestPMOID),
	fmt.Sprintf("hitl_pending?pmo_id=eq.%d", TestPMOID),
	fmt.Sprintf("farm_documents?pmo_id=eq.%d", TestPMOID),
	fmt.Sprintf("messages?phone=eq.%s", TestPhone),
	fmt.Sprintf("messages?phone=eq.%s", TestPhoneMZ),
}

// TeardownE2E apaga o que os testes escreveram no fixture. Também é chamado
// no início de cada teste, para que sobra de uma execução anterior não vire
// falso positivo.
func TeardownE2E(t *testing.T, _ *supabase.Client) {
	t.Helper()
	for _, alvo := range limpezaE2E {
		resp := restRequest(t, http.MethodDelete, alvo, nil)
		if resp.StatusCode >= 400 {
			corpo, _ := io.ReadAll(resp.Body)
			t.Errorf("Falha ao limpar %s (status %d): %s", alvo, resp.StatusCode, corpo)
		}
		resp.Body.Close()
	}
}

func restRequest(t *testing.T, method, pathAndQuery string, body []byte) *http.Response {
	t.Helper()
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	req, err := http.NewRequest(method, fmt.Sprintf("%s/rest/v1/%s", url, pathAndQuery), bytes.NewReader(body))
	if err != nil {
		t.Fatalf("Erro ao montar request %s %s: %v", method, pathAndQuery, err)
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		t.Fatalf("Erro em %s %s: %v", method, pathAndQuery, err)
	}
	return resp
}

// restGet faz um GET no PostgREST e devolve as linhas.
func restGet(t *testing.T, pathAndQuery string) []map[string]interface{} {
	t.Helper()
	resp := restRequest(t, http.MethodGet, pathAndQuery, nil)
	defer resp.Body.Close()
	corpo, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET %s retornou %d: %s", pathAndQuery, resp.StatusCode, corpo)
	}
	var linhas []map[string]interface{}
	if err := json.Unmarshal(corpo, &linhas); err != nil {
		t.Fatalf("GET %s: resposta não é uma lista JSON: %v", pathAndQuery, err)
	}
	return linhas
}

// esperarAte repete cond até ela retornar true ou o prazo acabar.
func esperarAte(prazo time.Duration, cond func() bool) bool {
	limite := time.Now().Add(prazo)
	for time.Now().Before(limite) {
		if cond() {
			return true
		}
		time.Sleep(2 * time.Second)
	}
	return cond()
}

// MockMessageSender evita mandar WhatsApp de verdade e guarda o que o bot
// respondeu. Implementa ports.ChannelSender. O mutex é necessário: quem
// chama Send é o worker em background, enquanto o teste lê as mensagens.
type MockMessageSender struct {
	mu       sync.Mutex
	enviadas []string
}

func (m *MockMessageSender) Send(ctx context.Context, env ports.OutboundEnvelope) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.enviadas = append(m.enviadas, env.Text)
	return nil
}

func (m *MockMessageSender) SendTyping(ctx context.Context, channel ports.ChannelType, to string) error {
	return nil
}

func (m *MockMessageSender) DownloadMedia(ctx context.Context, mediaID string, rawPayload []byte) ([]byte, string, error) {
	return nil, "", nil
}

// Mensagens devolve uma cópia do que o bot enviou até agora, sem os avisos
// de progresso ("⏳ Processando sua solicitação..."), que saem antes de
// qualquer processamento e não são uma resposta.
func (m *MockMessageSender) Mensagens() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []string
	for _, msg := range m.enviadas {
		if !strings.HasPrefix(strings.TrimSpace(msg), "⏳") {
			out = append(out, msg)
		}
	}
	return out
}

// botE2E sobe o handler de webhook real (com LLM real) num httptest.Server.
type botE2E struct {
	server   *httptest.Server
	whatsapp *MockMessageSender
}

func novoBotE2E(t *testing.T, client *supabase.Client) *botE2E {
	t.Helper()
	_ = config.LoadConfig() // carrega .env, se houver

	mock := &MockMessageSender{}
	llmProvider := SetupLLMProvider(t)

	// Servidor de ferramentas montado como em cmd/server/main.go. Sem ele o
	// FSM entrava em panic (nil pointer em mcp.(*Server).GetToolsForIntent)
	// em toda mensagem que chegava ao agente.
	agriRepo := agriculture.NewSupabaseAgriculturalRepository(client)
	embedder := embedcache.NewCachedEmbedder(llmProvider.Embedder(), 15*time.Minute)
	mcpServer := mcp.NewServer(client, agriRepo, embedder, llmProvider)
	mcpServer.InitializeTools()
	// Tabelas embarcadas, ligadas como em cmd/server/main.go.
	if ref, err := plantioref.Carregar(); err == nil {
		mcpServer.SetPlantioRef(ref)
	}
	tabZae, err := zae.Carregar()
	if err != nil {
		t.Fatalf("tabelas de Moçambique inválidas: %v", err)
	}
	mcpServer.SetZaeTabela(tabZae)
	mcpServer.SetInicioChuvas(weather.InicioDasChuvas)

	handler := webhook.NewHandler(webhook.Config{
		Token:          webhookToken,
		MaxMessageAge:  600,
		SupabaseClient: client,
		LLMClient:      llmProvider,
		MCPServer:      mcpServer,
		WhatsAppClient: mock,
		HistoryManager: history.NewManager(5*time.Minute, 10),
	})

	gin.SetMode(gin.TestMode)
	r := gin.New()
	handler.RegisterRoutes(r)
	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)

	return &botE2E{server: ts, whatsapp: mock}
}

// enviar simula uma mensagem de texto do produtor do fixture chegando pelo
// webhook da Evolution. O ID é único por chamada: o webhook deduplica por ID
// de mensagem, e um ID fixo faria a segunda execução ser descartada.
func (b *botE2E) enviar(t *testing.T, texto string) {
	t.Helper()
	b.enviarDe(t, TestPhone, texto)
}

// enviarDe é enviar com outro remetente (ex.: o produtor de Moçambique).
func (b *botE2E) enviarDe(t *testing.T, telefone, texto string) {
	t.Helper()
	payload := map[string]interface{}{
		"event": "messages.upsert",
		"data": map[string]interface{}{
			"info": map[string]interface{}{
				"ID":       fmt.Sprintf("MSG_E2E_%d", time.Now().UnixNano()),
				"Chat":     telefone + "@s.whatsapp.net",
				"Sender":   telefone + "@s.whatsapp.net",
				"IsFromMe": false,
				"Type":     "text",
			},
			"message": map[string]interface{}{"conversation": texto},
		},
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, b.server.URL+"/webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+webhookToken)

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		t.Fatalf("Erro ao chamar o webhook: %v", err)
	}
	defer resp.Body.Close()
	corpo, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Webhook retornou %d: %s", resp.StatusCode, corpo)
	}
	t.Logf("Webhook: %s", corpo)
}

// esperarResposta espera o bot mandar pelo menos n mensagens no total.
func (b *botE2E) esperarResposta(t *testing.T, n int) []string {
	t.Helper()
	esperarAte(esperaProcessamento, func() bool { return len(b.whatsapp.Mensagens()) >= n })
	msgs := b.whatsapp.Mensagens()
	for i, m := range msgs {
		t.Logf("Bot [%d]: %s", i, m)
	}
	return msgs
}

// SetupLLMProvider resolves the active LLM provider from environment, matching production behavior.
func SetupLLMProvider(t *testing.T) llm.LLMProvider {
	activekind, factoryCfg := llm.NewProviderFromEnv()
	promptCfg := llm.PromptConfig{} // Em testes E2E de sistema interno, prompts reais não são carregados daqui ou podemos deixá-los vazios

	if activekind == llm.ProviderGemini {
		// Mesma montagem de cmd/server/main.go. Sem fallback embutido: o
		// antigo default "gemini-1.5-flash" foi aposentado pela API (404) e
		// desviava a escalada para um modelo inexistente; vazio faz o cliente
		// escalar para a OpenRouter, como em produção.
		geminiModel := factoryCfg.GeminiModel
		if geminiModel == "" {
			geminiModel = "gemini-2.0-flash"
		}
		geminiVersion := os.Getenv("GEMINI_API_VERSION")
		if geminiVersion == "" {
			geminiVersion = "v1"
		}
		client, err := gemini.NewClient(gemini.Config{
			APIKey:           factoryCfg.GeminiAPIKey,
			OpenRouterAPIKey: factoryCfg.OpenRouterAPIKey,
			Model:            geminiModel,
			OpenRouterModel:  os.Getenv("OPENROUTER_MODEL"),
			FallbackModel:    factoryCfg.GeminiFallback,
			APIVersion:       geminiVersion,
		})
		if err != nil {
			t.Fatalf("Erro ao inicializar Gemini: %v", err)
		}
		return client
	}

	oadapter, err := llm.NewOpenAICompatibleProvider(factoryCfg, promptCfg)
	if err != nil {
		t.Fatalf("Erro ao inicializar provider OpenAI-compatible (%s): %v", activekind, err)
	}
	return oadapter
}
