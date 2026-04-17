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

	"google.golang.org/genai"
	_ "embed"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	openai "github.com/sashabaranov/go-openai"
	"sync"
)

//go:embed prompts/system_prompt.md
var systemPrompt string

//go:embed prompts/agronomist.md
var systemPromptAgronomist string

//go:embed prompts/db_operator.md
var systemPromptDBOperator string

//go:embed prompts/agronomist_vision.md
var systemPromptAgronomistVision string

// GetPromptForIntent selects the correct specialist system prompt based on the
// classified Intent from the Router. Falls back to the default monolithic prompt
// for CHAT or any unrecognized intent to avoid breaking the existing flow.
// GetPromptForIntent selects the correct specialist system prompt and injects property context.
func GetPromptForIntent(intent llm.Intent, modality string, temProducaoParalela bool) string {
	var prompt string
	switch intent {
	case llm.IntentRAG:
		prompt = systemPromptAgronomist
	case llm.IntentDatabase:
		prompt = systemPromptDBOperator
	default:
		prompt = systemPrompt
	}

	// Inject dynamic context (Simple string replacement as placeholder for a template engine)
	prompt = strings.ReplaceAll(prompt, "{{MODALIDADE_PREDOMINANTE}}", modality)
	
	parallelMsg := ""
	if temProducaoParalela {
		parallelMsg = "SIM"
	} else {
		parallelMsg = "NÃO"
	}
	prompt = strings.ReplaceAll(prompt, "{{TEM_PRODUCAO_PARALELA}}", parallelMsg)

	// Injetar Data Atual (Fix para evitar datas hardcoded nos prompts)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	currentDateBR := now.Format("02 de Janeiro de 2006")
	prompt = strings.ReplaceAll(prompt, "{{CURRENT_DATE_BR}}", currentDateBR)

	// Note: For more complex logic like {% if %}, a real template engine like text/template should be used.
	// For now, these basic replacements satisfy the current prompt structure if we adapt the prompts slightly.
	return prompt
}

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
	Config               Config
	Client               *genai.Client
	OpenAI               *openai.Client
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

// Close closes the underlying genai client
func (c *Client) Close() error {
	return nil
}

// GenerateEmbedding transforms a text chunk into a vector
func (c *Client) GenerateEmbedding(text string) ([]float32, error) {
	ctx := context.Background()

	log.Printf("📡 [GEMINI SDK] Gerando embedding para texto (%d chars)...", len(text))
	res, err := c.Client.Models.EmbedContent(ctx, "gemini-embedding-001", genai.Text(text), nil)
	if err != nil {
		return nil, fmt.Errorf("embedding error: %w", err)
	}

	return res.Embeddings[0].Values, nil
}

// AskExpert asks a question using the legacy simple flow (for backward compatibility if needed)
func (c *Client) AskExpert(question string, customInstruction ...string) (string, string, error) {
	ctx := context.Background()

	// Set system instruction
	instruction := systemPrompt
	if len(customInstruction) > 0 && customInstruction[0] != "" {
		instruction = customInstruction[0]
	}

	op := func(modelName string) (any, error) {
		config := &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{{Text: instruction}},
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

	res, modelUsed, err := c.withFallback(ctx, op)
	if err != nil {
		return "", "", err
	}

	resp := res.(*genai.GenerateContentResponse)
	// Extract text from parts
	var result string
	for _, part := range resp.Candidates[0].Content.Parts {
		if part.Text != "" {
			result += part.Text
		}
	}

	return result, modelUsed, nil
}

// withFallback wraps a Gemini call with retry and fallback logic.
func (c *Client) withFallback(ctx context.Context, fn func(model string) (any, error)) (any, string, error) {
	// 1. Try Primary Model (No internal retries, immediate failure)
	resp, err := fn(c.Config.Model)
	if err == nil {
		return resp, c.Config.Model, nil
	}

	log.Printf("⚠️ [GEMINI] Primary model (%s) failed: %v", c.Config.Model, err)

	// 2. Try Fallback Model ONLY if primary fails (immediate, no retry)
	if c.Config.FallbackModel != "" {
		log.Printf("🔄 [GEMINI] Trying fallback model: %s", c.Config.FallbackModel)
		resp, err = fn(c.Config.FallbackModel)
		if err == nil {
			return resp, c.Config.FallbackModel, nil
		}
		log.Printf("⚠️ [GEMINI] Fallback model (%s) failed: %v", c.Config.FallbackModel, err)
	}

	return nil, "", err
}

// isOverloadedError checks if the error is related to quota or high demand.
func isOverloadedError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "429") ||
		strings.Contains(errStr, "context deadline exceeded") ||
		strings.Contains(errStr, "high demand") ||
		strings.Contains(errStr, "rate limit exceeded") ||
		strings.Contains(errStr, "currently experiencing high demand")
}

// GenerateContentWithTools handles the interactive tool calling flow with history support.
func (c *Client) GenerateContentWithTools(ctx context.Context, question string, history []*genai.Content, tools []*genai.Tool, systemInstruction ...string) (*genai.GenerateContentResponse, *genai.Chat, string, error) {
	prompt := systemPrompt
	if len(systemInstruction) > 0 && systemInstruction[0] != "" {
		prompt = systemInstruction[0]
	}

	// We create a function that knows how to execute the call given a model name
	op := func(modelName string) (any, error) {
		config := &genai.GenerateContentConfig{
			Tools: tools,
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{{Text: prompt}},
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

	res, modelUsed, err := c.withFallback(ctx, op)
	if err != nil {
		return nil, nil, "", fmt.Errorf("send message error with fallback: %w", err)
	}

	result := res.([]any)
	return result[0].(*genai.GenerateContentResponse), result[1].(*genai.Chat), modelUsed, nil
}

// DescribeAgronomicImage analyzes an image and returns a technical description.
func (c *Client) DescribeAgronomicImage(ctx context.Context, imageBytes []byte, mimeType string) (string, string, error) {
	modelName := "gemini-1.5-flash"
	
	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: systemPromptAgronomistVision}},
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
