// Package llm — OpenAIAdapter: a provider-agnostic adapter for any OpenAI-compatible API.
//
// This adapter satisfies llm.LLMProvider using the sashabaranov/go-openai client,
// allowing the system to connect to OpenRouter, Groq, Mistral, local Ollama, or
// standard OpenAI by simply changing the BaseURL and APIKey at construction time.
//
// # Import cycle prevention
//
// This file lives in package llm. The internal/prompt package imports internal/llm
// (for the Intent type), so internal/llm MUST NOT import internal/prompt.
// System prompts are injected at construction time via [PromptConfig].
// The caller (main.go) is responsible for loading and providing the prompt strings.
package llm

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	openai "github.com/sashabaranov/go-openai"

	"github.com/thebrunm97/pmo-bot-go/internal/llm/schema"
)

// Compile-time assertion: *OpenAIAdapter must fully implement LLMProvider.
var _ LLMProvider = (*OpenAIAdapter)(nil)

// PromptConfig holds all system prompt strings needed by the adapter.
// By injecting prompts at construction time instead of importing internal/prompt,
// we prevent the internal/llm ↔ internal/prompt import cycle.
type PromptConfig struct {
	// RouterPrompt is the system instruction for ClassifyIntent.
	RouterPrompt string
	// VisionPrompt is the system instruction for DescribeImage.
	VisionPrompt string
	// MetaRAGJudgePrompt is the system instruction for EvaluateEvidenceListwise.
	MetaRAGJudgePrompt string
}

// OpenAIAdapterConfig holds all parameters required to construct an OpenAIAdapter.
type OpenAIAdapterConfig struct {
	// APIKey is the authentication token (e.g. "sk-or-v1-..." for OpenRouter).
	APIKey string

	// Model is the model identifier (e.g. "google/gemini-2.0-flash-001",
	// "mistralai/mistral-7b-instruct", "llama3-70b-8192" for Groq).
	Model string

	// BaseURL overrides the default OpenAI endpoint.
	// Examples:
	//   - OpenRouter: "https://openrouter.ai/api/v1"
	//   - Groq:        "https://api.groq.com/openai/v1"
	//   - Local Ollama: "http://localhost:11434/v1"
	// If empty, defaults to the official OpenAI endpoint.
	BaseURL string

	// HTTPReferer and AppTitle are optional headers required by OpenRouter.
	// Ignored for other providers.
	HTTPReferer string
	AppTitle    string

	// FastRouter parameters (optional). If provided, ClassifyIntent will use these
	// credentials instead of the main APIKey/Model (e.g. for Groq fast routing).
	RouterAPIKey  string
	RouterModel   string
	RouterBaseURL string

	// Prompts contains the system prompt strings used by this adapter.
	// If empty strings are provided, the adapter uses built-in fallbacks.
	Prompts PromptConfig
}

// OpenAIAdapter is an LLMProvider backed by any OpenAI-compatible API.
// It is intentionally thin: all business logic (prompt management, schema conversion)
// lives in the domain packages; this adapter only handles HTTP translation.
type OpenAIAdapter struct {
	client       *openai.Client
	routerClient *openai.Client // Optional dedicated client for ClassifyIntent
	cfg          OpenAIAdapterConfig
	prompts      PromptConfig
}

// NewOpenAIAdapter constructs an OpenAIAdapter ready to use.
// Returns an error if APIKey or Model are empty.
func NewOpenAIAdapter(cfg OpenAIAdapterConfig) (*OpenAIAdapter, error) {
	cfg.APIKey = strings.TrimSpace(cfg.APIKey)
	cfg.Model = strings.TrimSpace(cfg.Model)

	if cfg.APIKey == "" {
		return nil, fmt.Errorf("openai_adapter: APIKey is required")
	}
	if cfg.Model == "" {
		return nil, fmt.Errorf("openai_adapter: Model is required")
	}

	clientCfg := openai.DefaultConfig(cfg.APIKey)
	if cfg.BaseURL != "" {
		clientCfg.BaseURL = cfg.BaseURL
	}

	// Inject provider-specific headers (e.g. OpenRouter requires HTTP-Referer / X-Title).
	if cfg.HTTPReferer != "" || cfg.AppTitle != "" {
		clientCfg.HTTPClient = &http.Client{
			Timeout:   60 * time.Second,
			Transport: &openAIHeaderTransport{referer: cfg.HTTPReferer, title: cfg.AppTitle},
		}
	}

	prompts := cfg.Prompts
	// Safety fallbacks if caller didn't provide prompts.
	if prompts.RouterPrompt == "" {
		prompts.RouterPrompt = "Você é um classificador de intenções para agricultura orgânica. Responda em JSON."
		log.Printf("⚠️  [OpenAIAdapter] RouterPrompt not provided — using minimal fallback")
	}
	if prompts.VisionPrompt == "" {
		prompts.VisionPrompt = "Descreva tecnicamente esta imagem agrícola."
	}
	if prompts.MetaRAGJudgePrompt == "" {
		prompts.MetaRAGJudgePrompt = "Avalie a relevância das evidências. Responda em JSON."
	}

	log.Printf("📡 [OpenAIAdapter] Inicializado: model=%s baseURL=%s", cfg.Model, cfg.BaseURL)

	adapter := &OpenAIAdapter{
		client:  openai.NewClientWithConfig(clientCfg),
		cfg:     cfg,
		prompts: prompts,
	}

	if cfg.RouterAPIKey != "" && cfg.RouterModel != "" {
		routerCfg := openai.DefaultConfig(cfg.RouterAPIKey)
		if cfg.RouterBaseURL != "" {
			routerCfg.BaseURL = cfg.RouterBaseURL
		}
		adapter.routerClient = openai.NewClientWithConfig(routerCfg)
		log.Printf("🚀 [OpenAIAdapter] Fast Router ativado: model=%s baseURL=%s", cfg.RouterModel, cfg.RouterBaseURL)
	}

	return adapter, nil
}

// openAIHeaderTransport adds provider-required headers (OpenRouter: HTTP-Referer, X-Title).
type openAIHeaderTransport struct {
	referer string
	title   string
}

func (t *openAIHeaderTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.referer != "" {
		req.Header.Set("HTTP-Referer", t.referer)
	}
	if t.title != "" {
		req.Header.Set("X-Title", t.title)
	}
	return http.DefaultTransport.RoundTrip(req)
}

// ─── LLMProvider interface ────────────────────────────────────────────────────

// ModelName returns the configured model identifier for logging and audit.
func (a *OpenAIAdapter) ModelName() string {
	return a.cfg.Model
}

// Close releases any resources held by the adapter. No-op for HTTP-based clients.
func (a *OpenAIAdapter) Close() error {
	return nil
}

// GenerateContent executes a full agentic completion with history and optional tools.
// This is the primary method used by the Orchestrator's agentic loop.
func (a *OpenAIAdapter) GenerateContent(ctx context.Context, req ContentRequest) (RespostaAgnostica, error) {
	messages := ParaOpenRouterHistory(req.SystemInstruction, req.History)

	var tools []openai.Tool
	for _, f := range req.Tools {
		tools = append(tools, f.ParaOpenRouter())
	}

	chatReq := openai.ChatCompletionRequest{
		Model:    a.cfg.Model,
		Messages: messages,
	}
	if len(tools) > 0 {
		chatReq.Tools = tools
	}
	if req.Schema != nil {
		chatReq.ResponseFormat = &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		}
	}

	log.Printf("📡 [OpenAIAdapter] GenerateContent(%s) — %d msgs, %d tools", a.cfg.Model, len(messages), len(tools))

	resp, err := a.client.CreateChatCompletion(ctx, chatReq)
	if err != nil {
		return RespostaAgnostica{}, fmt.Errorf("openai_adapter: GenerateContent: %w", err)
	}
	if len(resp.Choices) == 0 {
		return RespostaAgnostica{}, fmt.Errorf("openai_adapter: GenerateContent: empty response from %s", a.cfg.Model)
	}

	return a.toAgnosticResponse(resp), nil
}

// ClassifyIntent performs unified intent classification + NER extraction.
// Uses the RouterPrompt injected at construction time.
func (a *OpenAIAdapter) ClassifyIntent(ctx context.Context, text string) (UnifiedIntentResult, string, error) {
	fallback := UnifiedIntentResult{
		Intents:    []Intent{IntentRAG},
		Confidence: 0.5,
		Reasoning:  "adapter_fallback",
	}

	jsonSchemaBytes, err := schema.Reflect[UnifiedIntentResult]()
	if err != nil {
		return fallback, a.cfg.Model, fmt.Errorf("openai_adapter: ClassifyIntent: schema reflect: %w", err)
	}
	_, err = schema.ForOpenRouter(jsonSchemaBytes, "UnifiedIntentResult")
	if err != nil {
		return fallback, a.cfg.Model, fmt.Errorf("openai_adapter: ClassifyIntent: schema build: %w", err)
	}

	log.Printf("🧭 [OpenAIAdapter] ClassifyIntent(%s): '%s'", a.cfg.Model, adapterTruncate(text, 60))

	activeClient := a.client
	activeModel := a.cfg.Model
	if a.routerClient != nil {
		activeClient = a.routerClient
		activeModel = a.cfg.RouterModel
		log.Printf("⚡ [FastRouter] Delegando ClassifyIntent para %s", activeModel)
	}

	resp, err := activeClient.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: activeModel,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: a.prompts.RouterPrompt},
			{Role: openai.ChatMessageRoleUser, Content: text},
		},
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	})
	if err != nil {
		fallback.Reasoning = "provider_error"
		return fallback, activeModel, fmt.Errorf("openai_adapter: ClassifyIntent: %w", err)
	}
	if len(resp.Choices) == 0 {
		fallback.Reasoning = "empty_response"
		return fallback, activeModel, nil
	}

	raw := resp.Choices[0].Message.Content
	result, decErr := schema.DecodeAndValidate[UnifiedIntentResult](raw)
	if decErr != nil {
		log.Printf("⚠️ [OpenAIAdapter] ClassifyIntent decode error: %v. Raw: %s", decErr, raw)
		fallback.Reasoning = "schema_validation_error"
		return fallback, activeModel, nil
	}
	if len(result.Intents) == 0 {
		result.Intents = []Intent{IntentRAG}
	}

	return result, activeModel, nil
}

// AskSimple sends a single question without tools (utility/legacy path).
// Returns (answer, model_used, error).
func (a *OpenAIAdapter) AskSimple(ctx context.Context, question string, systemInstruction string) (string, string, error) {
	var messages []openai.ChatCompletionMessage
	if systemInstruction != "" {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleSystem,
			Content: systemInstruction,
		})
	}
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: question,
	})

	resp, err := a.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:    a.cfg.Model,
		Messages: messages,
	})
	if err != nil {
		return "", a.cfg.Model, fmt.Errorf("openai_adapter: AskSimple: %w", err)
	}
	if len(resp.Choices) == 0 {
		return "", a.cfg.Model, fmt.Errorf("openai_adapter: AskSimple: empty response")
	}

	return resp.Choices[0].Message.Content, a.cfg.Model, nil
}

// DescribeImage analyzes an image using the configured model.
// Works best with vision-capable models (e.g. "openai/gpt-4o", "google/gemini-2.0-flash").
// Returns a clear error if the provider rejects the vision request — no panic.
func (a *OpenAIAdapter) DescribeImage(ctx context.Context, imageBytes []byte, mimeType string) (string, string, error) {
	if len(imageBytes) == 0 {
		return "", a.cfg.Model, fmt.Errorf("openai_adapter: DescribeImage: empty image bytes")
	}
	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	dataURI := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(imageBytes))

	resp, err := a.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: a.cfg.Model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role: openai.ChatMessageRoleUser,
				MultiContent: []openai.ChatMessagePart{
					{Type: openai.ChatMessagePartTypeText, Text: a.prompts.VisionPrompt},
					{Type: openai.ChatMessagePartTypeImageURL, ImageURL: &openai.ChatMessageImageURL{URL: dataURI}},
				},
			},
		},
	})
	if err != nil {
		return "", a.cfg.Model,
			fmt.Errorf("openai_adapter: DescribeImage: %w (ensure model supports vision)", err)
	}
	if len(resp.Choices) == 0 {
		return "", a.cfg.Model, fmt.Errorf("openai_adapter: DescribeImage: empty response")
	}

	return resp.Choices[0].Message.Content, a.cfg.Model, nil
}

// Embedder returns an Embedder backed by the OpenAI embeddings endpoint.
// Uses text-embedding-ada-002 which is broadly supported across providers.
func (a *OpenAIAdapter) Embedder() Embedder {
	return &openAIEmbedder{client: a.client}
}

// EvaluateEvidenceListwise evaluates a list of RAG chunks against a query using
// the configured model and the MetaRAGJudgePrompt injected at construction time.
func (a *OpenAIAdapter) EvaluateEvidenceListwise(ctx context.Context, query string, chunks []string) (MetaRAGResult, error) {
	var emptyResult MetaRAGResult
	if len(chunks) == 0 {
		return emptyResult, nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Pergunta do Usuário: %s\n\nLista de Evidências:\n", query))
	for i, chunk := range chunks {
		sb.WriteString(fmt.Sprintf("--- Evidência %d ---\n%s\n\n", i, chunk))
	}

	activeClient := a.client
	activeModel := a.cfg.Model
	if a.routerClient != nil {
		activeClient = a.routerClient
		activeModel = a.cfg.RouterModel
		log.Printf("⚡ [FastRouter] Delegando EvaluateEvidenceListwise para %s", activeModel)
	}

	resp, err := activeClient.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: activeModel,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: a.prompts.MetaRAGJudgePrompt},
			{Role: openai.ChatMessageRoleUser, Content: sb.String()},
		},
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
	})
	if err != nil {
		return emptyResult, fmt.Errorf("openai_adapter: EvaluateEvidenceListwise: %w", err)
	}
	if len(resp.Choices) == 0 {
		return emptyResult, fmt.Errorf("openai_adapter: EvaluateEvidenceListwise: empty response")
	}

	result, decErr := schema.DecodeAndValidate[MetaRAGResult](resp.Choices[0].Message.Content)
	if decErr != nil {
		return emptyResult, fmt.Errorf("openai_adapter: EvaluateEvidenceListwise: decode: %w", decErr)
	}

	return result, nil
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// toAgnosticResponse converts an openai.ChatCompletionResponse to RespostaAgnostica.
func (a *OpenAIAdapter) toAgnosticResponse(resp openai.ChatCompletionResponse) RespostaAgnostica {
	choice := resp.Choices[0].Message
	agnostic := RespostaAgnostica{
		Texto:    choice.Content,
		Model:    resp.Model,
		Provider: "openai_adapter",
		Usage: UsoMetadados{
			PromptTokens:     int32(resp.Usage.PromptTokens),
			CandidatesTokens: int32(resp.Usage.CompletionTokens),
			TotalTokens:      int32(resp.Usage.TotalTokens),
		},
	}

	for _, tc := range choice.ToolCalls {
		var args map[string]interface{}
		_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
		agnostic.ToolCalls = append(agnostic.ToolCalls, ChamadaFerramentaAgnostica{
			ID:   tc.ID,
			Nome: tc.Function.Name,
			Args: args,
		})
	}

	return agnostic
}

// adapterTruncate is a safe string truncator for log messages.
func adapterTruncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}

// ─── openAIEmbedder ───────────────────────────────────────────────────────────

// openAIEmbedder satisfies the Embedder interface using the OpenAI embeddings API.
type openAIEmbedder struct {
	client *openai.Client
}

// GenerateEmbedding generates a float32 vector for the given text.
func (e *openAIEmbedder) GenerateEmbedding(text string) ([]float32, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	resp, err := e.client.CreateEmbeddings(ctx, openai.EmbeddingRequest{
		Model: openai.AdaEmbeddingV2, // text-embedding-ada-002 — broadly supported
		Input: []string{text},
	})
	if err != nil {
		return nil, fmt.Errorf("openai_adapter: Embedder.GenerateEmbedding: %w", err)
	}
	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("openai_adapter: Embedder.GenerateEmbedding: empty response")
	}

	return resp.Data[0].Embedding, nil
}

// GenerateQueryEmbedding generates an embedding for a search query.
// Identical to GenerateEmbedding for OpenAI-compatible APIs.
func (e *openAIEmbedder) GenerateQueryEmbedding(query string) ([]float32, error) {
	return e.GenerateEmbedding(query)
}
