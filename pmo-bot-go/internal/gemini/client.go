package gemini

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	openai "github.com/sashabaranov/go-openai"
	"google.golang.org/genai"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/llm/schema"
	"github.com/thebrunm97/pmo-bot-go/internal/prompt"
)

// Compile-time check: *Client must satisfy llm.LLMProvider.
var _ llm.LLMProvider = (*Client)(nil)

// Config holds Gemini API configuration
type Config struct {
	APIKey           string
	OpenRouterAPIKey string
	Model            string
	OpenRouterModel  string
	FallbackModel    string
	APIVersion       string
}

// Client wraps communication with Gemini using the official SDK
type Client struct {
	Config              Config
	Client              *genai.Client
	OpenAI              *openai.Client
	OpenRouterTransport *openRouterTransport
}

// NewClient initializes the Gemini and/or OpenRouter clients.
func NewClient(cfg Config) (*Client, error) {
	// Fallback para variáveis de ambiente se não fornecidas na config
	if cfg.APIKey == "" {
		cfg.APIKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if cfg.OpenRouterAPIKey == "" {
		cfg.OpenRouterAPIKey = strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY"))
	}
	// Garantir que chaves passadas via config também sejam limpas
	cfg.APIKey = strings.TrimSpace(cfg.APIKey)
	cfg.OpenRouterAPIKey = strings.TrimSpace(cfg.OpenRouterAPIKey)

	if cfg.APIKey == "" && cfg.OpenRouterAPIKey == "" {
		return nil, fmt.Errorf("either GEMINI_API_KEY or OPENROUTER_API_KEY must be provided")
	}

	if cfg.Model == "" {
		cfg.Model = os.Getenv("GEMINI_MODEL")
	}
	if cfg.OpenRouterModel == "" {
		cfg.OpenRouterModel = os.Getenv("OPENROUTER_MODEL")
	}

	ctx := context.Background()
	c := &Client{Config: cfg}

	// Initialize Google Gemini if Key is present
	if cfg.APIKey != "" {
		httpClient := &http.Client{
			Timeout: 60 * time.Second,
		}
		genClient, err := genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:     cfg.APIKey,
			Backend:    genai.BackendGeminiAPI,
			HTTPClient: httpClient,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create genai client: %w", err)
		}
		c.Client = genClient
		log.Printf("📡 [Gemini] Cliente Google inicializado com timeout de 60s.")
	}

	// Initialize OpenAI for OpenRouter if Key is present
	if cfg.OpenRouterAPIKey != "" {
		oaCfg := openai.DefaultConfig(cfg.OpenRouterAPIKey)
		oaCfg.BaseURL = "https://openrouter.ai/api/v1"

		// Custom Transport para garantir headers corretos na OpenRouter
		transport := &openRouterTransport{
			apiKey: cfg.OpenRouterAPIKey,
		}
		oaCfg.HTTPClient = &http.Client{
			Transport: transport,
			Timeout:   60 * time.Second,
		}

		c.OpenAI = openai.NewClientWithConfig(oaCfg)
		c.OpenRouterTransport = transport
		log.Printf("📡 [OpenRouter] Cliente OpenRouter inicializado (%s).", cfg.OpenRouterModel)
	}

	return c, nil
}

// openRouterTransport injeta headers obrigatórios e o campo "reasoning" no body de cada pedido à OpenRouter.
// Também lida com a injeção dinâmica de "response_format" para Structured Output via Context.
type openRouterTransport struct {
	apiKey         string
	responseFormat map[string]interface{}
	mu             sync.RWMutex
}

func (t *openRouterTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Injetar headers de autenticação e identificação
	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("HTTP-Referer", "https://manejo.org")
	req.Header.Set("X-Title", "ManejoOrg PMO Bot")
	req.Header.Set("Content-Type", "application/json")

	// Injetar Reasoning Tokens e Response Format: lê o body original, adiciona os campos e reenvia
	if req.Body != nil {
		originalBody, err := io.ReadAll(req.Body)
		if err == nil {
			// Desserializar o body para um mapa
			var bodyMap map[string]interface{}
			if json.Unmarshal(originalBody, &bodyMap) == nil {
				// 1. Adicionar o campo de raciocínio com esforço reduzido
				bodyMap["reasoning"] = map[string]interface{}{"effort": "low"}

				// 2. Injetar Response Format se presente no transport (definido via closure no CallOpenRouter)
				t.mu.RLock()
				fmtReq := t.responseFormat
				t.mu.RUnlock()

				if fmtReq != nil {
					bodyMap["response_format"] = fmtReq
				}

				if enrichedBody, err := json.Marshal(bodyMap); err == nil {
					req.Body = io.NopCloser(bytes.NewReader(enrichedBody))
					req.ContentLength = int64(len(enrichedBody))
				}
			}
		}
	}

	return http.DefaultTransport.RoundTrip(req)
}

// Close releases resources held by the provider.
func (c *Client) Close() error {
	return nil
}

// ─── llm.LLMProvider Implementation ──────────────────────────────────────────

// ModelName returns the primary model name configured for logging/audit.
func (c *Client) ModelName() string {
	return c.Config.Model
}

// Embedder returns the embedding sub-interface.
func (c *Client) Embedder() llm.Embedder {
	return &embeddingAdapter{client: c}
}

// embeddingAdapter adapts *Client to the llm.Embedder interface.
type embeddingAdapter struct {
	client *Client
}

// GenerateEmbedding transforms a text chunk into a vector.
func (e *embeddingAdapter) GenerateEmbedding(text string) ([]float32, error) {
	ctx := context.Background()
	log.Printf("📡 [GEMINI SDK] Gerando embedding para texto (%d chars)...", len(text))
	res, err := e.client.Client.Models.EmbedContent(ctx, "gemini-embedding-001", genai.Text(text), nil)
	if err != nil {
		return nil, fmt.Errorf("embedding error: %w", err)
	}
	return res.Embeddings[0].Values, nil
}

// GenerateQueryEmbedding encodes a search query.
func (e *embeddingAdapter) GenerateQueryEmbedding(query string) ([]float32, error) {
	return e.GenerateEmbedding(query)
}

// GenerateContent executes a full completion with history, tools and optional schema.
// Encapsulates the Google → OpenRouter fallback internally.
func (c *Client) GenerateContent(ctx context.Context, req llm.ContentRequest) (llm.RespostaAgnostica, error) {
	// Convert agnostic schema to provider-specific formats
	var googleSchema *genai.Schema
	var openrouterSchema map[string]interface{}

	if req.Schema != nil {
		// Build Google schema from raw JSON Schema map
		googleSchema = llm.MapToGenaiSchema(req.Schema, true)
		openrouterSchema = req.Schema
	}

	op := func(modelName string) (any, error) {
		if modelName == c.Config.Model || modelName == c.Config.FallbackModel {
			return c.CallGoogle(ctx, req.SystemInstruction, req.History, req.Tools, googleSchema)
		}
		return c.CallOpenRouter(ctx, req.SystemInstruction, req.History, req.Tools, openrouterSchema)
	}

	res, _, err := c.withFallback(op)
	if err != nil {
		return llm.RespostaAgnostica{}, fmt.Errorf("all providers failed: %w", err)
	}

	return res.(llm.RespostaAgnostica), nil
}

// ClassifyIntent performs unified intent classification + NER extraction.
func (c *Client) ClassifyIntent(ctx context.Context, text string) (llm.UnifiedIntentResult, string, error) {
	// Generate provider-specific schemas from the Go struct
	jsonSchemaBytes, _ := schema.Reflect[llm.UnifiedIntentResult]()
	googleSchema, _ := schema.ForGoogle(jsonSchemaBytes)
	openRouterSchema, _ := schema.ForOpenRouter(jsonSchemaBytes, "UnifiedIntentResult")

	log.Printf("🧭 [UNIFIED-ROUTER] Analisando: '%s'", truncateStr(strings.TrimSpace(text), 60))

	sysInst := prompt.RouterSystemPrompt()

	op := func(modelName string) (any, error) {
		if strings.Contains(modelName, "/") || c.OpenAI != nil {
			if modelName == c.Config.Model || modelName == c.Config.FallbackModel {
				return c.CallGoogle(ctx, sysInst, []llm.MensagemAgnostica{{Role: llm.PapelUser, Content: text}}, nil, googleSchema)
			}
			return c.CallOpenRouter(ctx, sysInst, []llm.MensagemAgnostica{
				{Role: llm.PapelUser, Content: text},
			}, nil, openRouterSchema)
		}
		return c.CallGoogle(ctx, sysInst, []llm.MensagemAgnostica{{Role: llm.PapelUser, Content: text}}, nil, googleSchema)
	}

	res, modelUsed, err := c.withFallback(op)
	if err != nil {
		return llm.UnifiedIntentResult{Intents: []llm.Intent{llm.IntentRAG}}, modelUsed, err
	}

	agnosticResp := res.(llm.RespostaAgnostica)

	result, err := schema.DecodeAndValidate[llm.UnifiedIntentResult](agnosticResp.Texto)
	if err != nil {
		log.Printf("⚠️ [ROUTER] Erro de Validação/Schema: %v. Raw: %s", err, agnosticResp.Texto)
		return llm.UnifiedIntentResult{Intents: []llm.Intent{llm.IntentRAG}, Confidence: 0.5, Reasoning: "schema_validation_error"}, modelUsed, nil
	}

	if len(result.Intents) == 0 {
		result.Intents = []llm.Intent{llm.IntentRAG}
	}

	firstIntencao := "duvida"
	if len(result.Entities) > 0 && result.Entities[0].Intencao != "" {
		firstIntencao = result.Entities[0].Intencao
	}

	log.Printf("🧭 [ROUTER] Intents: %v (Primeira Entidade: %s) | Conf: %.2f | Reasoning: %s | Total: %d", result.Intents, firstIntencao, result.Confidence, result.Reasoning, len(result.Entities))

	return result, modelUsed, nil
}

// AskSimple sends a single question without tools.
func (c *Client) AskSimple(ctx context.Context, question string, systemInstruction string) (string, string, error) {
	if systemInstruction == "" {
		systemInstruction = prompt.ForIntent(llm.IntentChat, "", false)
	}

	op := func(modelName string) (any, error) {
		config := &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{{Text: systemInstruction}},
			},
			Temperature: genai.Ptr[float32](0.2),
		}

		log.Printf("📡 [GEMINI SDK] Chamada simples (%s) para o oráculo.", modelName)
		resp, err := c.Client.Models.GenerateContent(ctx, modelName, genai.Text(question), config)
		if err != nil {
			return nil, err
		}
		if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
			return nil, fmt.Errorf("empty response from gemini")
		}
		return resp, nil
	}

	res, modelUsed, err := c.withFallback(op)
	if err != nil {
		return "", "", err
	}

	resp := res.(*genai.GenerateContentResponse)
	var result string
	for _, part := range resp.Candidates[0].Content.Parts {
		if part.Text != "" {
			result += part.Text
		}
	}

	return result, modelUsed, nil
}

// DescribeImage analyzes an image and returns a technical description.
func (c *Client) DescribeImage(ctx context.Context, imageBytes []byte, mimeType string) (string, string, error) {
	modelName := "gemini-1.5-flash"

	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: prompt.VisionPrompt()}},
		},
		Temperature: genai.Ptr[float32](0.4),
	}

	log.Printf("📡 [GEMINI SDK] Descrevendo imagem (%s, %d bytes) com %s", mimeType, len(imageBytes), modelName)

	parts := []*genai.Part{
		{InlineData: &genai.Blob{Data: imageBytes, MIMEType: mimeType}},
	}
	contents := []*genai.Content{
		{Parts: parts},
	}

	resp, err := c.Client.Models.GenerateContent(ctx, modelName, contents, config)
	if err != nil {
		return "", "", fmt.Errorf("vision description error: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", "", fmt.Errorf("empty vision response from %s", modelName)
	}

	var result string
	for _, part := range resp.Candidates[0].Content.Parts {
		if part.Text != "" {
			result += part.Text
		}
	}

	return result, modelName, nil
}

// truncateStr is a helper to safely shorten strings for logging.
func truncateStr(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}

// withFallback wraps a Gemini call with retry+backoff on the primary model before
// escalating to the paid fallback. This protects against temporary 429/503 overload
// errors on the free tier without incurring unnecessary OpenRouter costs.
//
// Strategy:
//   - Up to maxRetries attempts on the primary model, with retryDelay sleep between them.
//   - Retry is only attempted when isOverloadedError(err) is true.
//   - Non-overload errors (e.g. bad request) skip retries and go straight to fallback.
//   - Fallback model is tried once after primary retries are exhausted.
func (c *Client) withFallback(fn func(model string) (any, error)) (any, string, error) {
	const (
		maxAttempts = 3 // 1 initial attempt + 2 retries (total 3 attempts)
		retryDelay  = 2 * time.Second
	)

	// 1. Try Primary Model with retry on overload errors
	var primaryErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		resp, err := fn(c.Config.Model)
		if err == nil {
			return resp, c.Config.Model, nil
		}

		primaryErr = err

		if !isOverloadedError(err) {
			// Non-transient error (e.g. bad request): skip retries, go straight to fallback.
			log.Printf("⚠️ [GEMINI] Primary model (%s) failed with non-retryable error: %v. Escalating to fallback.", c.Config.Model, err)
			break
		}

		if attempt < maxAttempts {
			log.Printf("♻️ [GEMINI] Primary model (%s) overloaded (attempt %d/%d), retrying in %v...", c.Config.Model, attempt, maxAttempts, retryDelay)
			time.Sleep(retryDelay)
		} else {
			log.Printf("⚠️ [GEMINI] Primary model (%s) exhausted after %d attempts: %v", c.Config.Model, maxAttempts, err)
		}
	}

	// 2. Escalate to Fallback Model (paid tier) only after primary is exhausted or non-retryable error
	if c.Config.FallbackModel != "" {
		log.Printf("🔄 [GEMINI] Escalating to fallback model: %s", c.Config.FallbackModel)
		resp, err := fn(c.Config.FallbackModel)
		if err == nil {
			return resp, c.Config.FallbackModel, nil
		}
		log.Printf("⚠️ [GEMINI] Fallback model (%s) also failed: %v", c.Config.FallbackModel, err)
		return nil, "", err
	} else if c.OpenAI != nil {
		fallbackModel := c.Config.OpenRouterModel
		if fallbackModel == "" {
			fallbackModel = "openrouter"
		}
		log.Printf("🔄 [GEMINI] Escalating to OpenRouter fallback model: %s", fallbackModel)
		resp, err := fn(fallbackModel)
		if err == nil {
			return resp, fallbackModel, nil
		}
		log.Printf("⚠️ [GEMINI] OpenRouter fallback model (%s) also failed: %v", fallbackModel, err)
		return nil, "", err
	}

	return nil, "", primaryErr
}

// isOverloadedError checks if the error is related to quota or high demand (429/503).
// Used by withFallback to decide whether a retry on the same provider is worthwhile.
func isOverloadedError(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "429") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "resource_exhausted") ||
		strings.Contains(errStr, "overloaded") ||
		strings.Contains(errStr, "context deadline exceeded") ||
		strings.Contains(errStr, "high demand") ||
		strings.Contains(errStr, "rate limit exceeded") ||
		strings.Contains(errStr, "currently experiencing high demand")
}

// GenerateContentWithTools handles the interactive tool calling flow with history support.
// Deprecated: Use GenerateContent (LLMProvider interface) for new code.
func (c *Client) GenerateContentWithTools(ctx context.Context, question string, history []*genai.Content, tools []*genai.Tool, systemInstruction ...string) (*genai.GenerateContentResponse, *genai.Chat, string, error) {
	sysPrompt := prompt.ForIntent(llm.IntentChat, "", false)
	if len(systemInstruction) > 0 && systemInstruction[0] != "" {
		sysPrompt = systemInstruction[0]
	}

	op := func(modelName string) (any, error) {
		config := &genai.GenerateContentConfig{
			Tools: tools,
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{{Text: sysPrompt}},
			},
			Temperature: genai.Ptr[float32](0.2),
		}

		session, err := c.Client.Chats.Create(ctx, modelName, config, history)
		if err != nil {
			return nil, err
		}

		log.Printf("📡 [GEMINI SDK] Chamada (%s) com Tools e Memória (%d msgs) para: %s", modelName, len(history), question)
		resp, err := session.SendMessage(ctx, genai.Part{Text: question})
		if err != nil {
			return nil, err
		}
		return []any{resp, session}, nil
	}

	res, modelUsed, err := c.withFallback(op)
	if err != nil {
		return nil, nil, "", fmt.Errorf("send message error with fallback: %w", err)
	}

	result := res.([]any)
	return result[0].(*genai.GenerateContentResponse), result[1].(*genai.Chat), modelUsed, nil
}

// DescribeAgronomicImage is kept as a backward-compatible alias for DescribeImage.
// Deprecated: Use DescribeImage (LLMProvider interface) for new code.
func (c *Client) DescribeAgronomicImage(ctx context.Context, imageBytes []byte, mimeType string) (string, string, error) {
	return c.DescribeImage(ctx, imageBytes, mimeType)
}

// CallOpenRouter executes a completion request via OpenRouter (OpenAI-compatible).
// It converts agnostic history and tools to the OpenAI format before calling and returns an agnostic response.
// Se agnosticSchema for fornecido, ele será injetado como response_format no payload.
func (c *Client) CallOpenRouter(ctx context.Context, sysInst string, history []llm.MensagemAgnostica, agnosticTools []llm.FerramentaAgnostica, agnosticSchema map[string]interface{}) (llm.RespostaAgnostica, error) {
	if c.OpenAI == nil {
		return llm.RespostaAgnostica{}, fmt.Errorf("OpenRouter client not initialized (check API Key)")
	}

	// Injetar o schema no transport para esta chamada específica
	if c.OpenRouterTransport != nil {
		c.OpenRouterTransport.mu.Lock()
		c.OpenRouterTransport.responseFormat = agnosticSchema
		c.OpenRouterTransport.mu.Unlock()

		defer func() {
			c.OpenRouterTransport.mu.Lock()
			c.OpenRouterTransport.responseFormat = nil
			c.OpenRouterTransport.mu.Unlock()
		}()
	}

	model := c.Config.OpenRouterModel
	if model == "" {
		model = "google/gemini-2.0-flash-001" // Default resiliente
	}

	// 1. Converter Histórico
	messages := llm.ParaOpenRouterHistory(sysInst, history)

	// 2. Converter Ferramentas
	var tools []openai.Tool
	for _, f := range agnosticTools {
		tools = append(tools, f.ParaOpenRouter())
	}

	log.Printf("📡 [OpenRouter] Chamada (%s) com %d ferramentas e %d msgs.", model, len(tools), len(messages))

	req := openai.ChatCompletionRequest{
		Model:    model,
		Messages: messages,
		Tools:    tools,
	}

	resp, err := c.OpenAI.CreateChatCompletion(ctx, req)
	if err != nil {
		return llm.RespostaAgnostica{}, fmt.Errorf("openrouter error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return llm.RespostaAgnostica{}, fmt.Errorf("empty response from openrouter")
	}

	choice := resp.Choices[0].Message
	agnosticResp := llm.RespostaAgnostica{
		Texto:    choice.Content,
		Model:    resp.Model,
		Provider: "openrouter",
		Usage: llm.UsoMetadados{
			PromptTokens:     int32(resp.Usage.PromptTokens),
			CandidatesTokens: int32(resp.Usage.CompletionTokens),
			TotalTokens:      int32(resp.Usage.TotalTokens),
		},
	}

	for _, tc := range choice.ToolCalls {
		var args map[string]interface{}
		json.Unmarshal([]byte(tc.Function.Arguments), &args)

		agnosticResp.ToolCalls = append(agnosticResp.ToolCalls, llm.ChamadaFerramentaAgnostica{
			ID:   tc.ID,
			Nome: tc.Function.Name,
			Args: args,
		})
	}

	return agnosticResp, nil
}

// CallGoogle executes a completion request via Google GenAI SDK.
// It converts agnostic history and tools to the Google format and returns an agnostic response.
func (c *Client) CallGoogle(ctx context.Context, sysInst string, history []llm.MensagemAgnostica, agnosticTools []llm.FerramentaAgnostica, agnosticSchema *genai.Schema) (llm.RespostaAgnostica, error) {
	modelName := c.Config.Model
	var tools []*genai.Tool
	for _, f := range agnosticTools {
		tools = append(tools, f.ParaGoogle())
	}

	config := &genai.GenerateContentConfig{
		Tools: tools,
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: sysInst}},
		},
		Temperature: genai.Ptr[float32](0.2),
	}

	// Injetar Structured Output se schema presente
	if agnosticSchema != nil {
		config.ResponseMIMEType = "application/json"
		config.ResponseSchema = agnosticSchema
	}

	// Converter Histórico
	googleHistory := llm.ParaGoogleHistory(history)

	log.Printf("📡 [GEMINI SDK] Chamada (%s) com %d ferramentas e %d msgs de histórico.", modelName, len(tools), len(googleHistory))

	// Chamada direta ao SDK (sem usar o abstração de Chat para ter controle total da última resposta)
	// Nota: O Orquestrador gere o histórico manualmente agora.
	resp, err := c.Client.Models.GenerateContent(ctx, modelName, googleHistory, config)
	if err != nil {
		return llm.RespostaAgnostica{}, err
	}

	if len(resp.Candidates) == 0 {
		return llm.RespostaAgnostica{}, fmt.Errorf("no candidates in google response")
	}

	candidate := resp.Candidates[0]
	agnosticResp := llm.RespostaAgnostica{
		Model:    resp.ModelVersion,
		Provider: "google",
	}

	if resp.UsageMetadata != nil {
		agnosticResp.Usage = llm.UsoMetadados{
			PromptTokens:     resp.UsageMetadata.PromptTokenCount,
			CandidatesTokens: resp.UsageMetadata.CandidatesTokenCount,
			TotalTokens:      resp.UsageMetadata.TotalTokenCount,
		}
	}

	for _, part := range candidate.Content.Parts {
		if part.Text != "" {
			agnosticResp.Texto += part.Text
		}
		if part.ThoughtSignature != nil {
			agnosticResp.ThoughtSignature = base64.StdEncoding.EncodeToString(part.ThoughtSignature)
		}
		if part.FunctionCall != nil {
			agnosticResp.ToolCalls = append(agnosticResp.ToolCalls, llm.ChamadaFerramentaAgnostica{
				Nome: part.FunctionCall.Name,
				Args: part.FunctionCall.Args,
			})
		}
	}

	return agnosticResp, nil
}

// EvaluateEvidenceListwise evaluates a list of retrieved chunks against a query.
func (c *Client) EvaluateEvidenceListwise(ctx context.Context, query string, chunks []string) (llm.MetaRAGResult, error) {
	var emptyResult llm.MetaRAGResult
	if len(chunks) == 0 {
		return emptyResult, nil
	}

	// 1. Format input for the evaluator
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Pergunta do Usuário: %s\n\n", query))
	sb.WriteString("Lista de Evidências:\n")
	for i, chunk := range chunks {
		sb.WriteString(fmt.Sprintf("--- Evidência %d ---\n%s\n\n", i, chunk))
	}
	input := sb.String()

	sysInst := prompt.MetaRAGJudgePrompt()

	// 2. Reflect schema
	jsonSchemaBytes, err := schema.Reflect[llm.MetaRAGResult]()
	if err != nil {
		return emptyResult, fmt.Errorf("failed to reflect MetaRAGResult schema: %w", err)
	}

	googleSchema, err := schema.ForGoogle(jsonSchemaBytes)
	if err != nil {
		return emptyResult, fmt.Errorf("failed to generate Google schema: %w", err)
	}

	openRouterSchema, err := schema.ForOpenRouter(jsonSchemaBytes, "MetaRAGResult")
	if err != nil {
		return emptyResult, fmt.Errorf("failed to generate OpenRouter schema: %w", err)
	}

	// 3. Operation closure
	op := func(modelName string) (any, error) {
		if strings.Contains(modelName, "/") || c.OpenAI != nil {
			if modelName == c.Config.Model || modelName == c.Config.FallbackModel {
				return c.CallGoogle(ctx, sysInst, []llm.MensagemAgnostica{{Role: llm.PapelUser, Content: input}}, nil, googleSchema)
			}
			return c.CallOpenRouter(ctx, sysInst, []llm.MensagemAgnostica{
				{Role: llm.PapelUser, Content: input},
			}, nil, openRouterSchema)
		}
		return c.CallGoogle(ctx, sysInst, []llm.MensagemAgnostica{{Role: llm.PapelUser, Content: input}}, nil, googleSchema)
	}

	// 4. Run with fallback
	res, _, err := c.withFallback(op)
	if err != nil {
		return emptyResult, fmt.Errorf("evaluation model call failed: %w", err)
	}

	agnosticResp := res.(llm.RespostaAgnostica)
	result, err := schema.DecodeAndValidate[llm.MetaRAGResult](agnosticResp.Texto)
	if err != nil {
		log.Printf("⚠️ [META-RAG] Validation error: %v. Raw response: %s", err, agnosticResp.Texto)
		return emptyResult, fmt.Errorf("schema decode/validation error: %w", err)
	}

	return result, nil
}
