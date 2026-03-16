package gemini

import (
	"context"
	"fmt"
	"log"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"

	_ "embed"
)

//go:embed prompts/system_prompt.md
var systemPrompt string

// Config holds Gemini API configuration
type Config struct {
	APIKey     string
	Model      string
	APIVersion string
}

// Client wraps communication with Gemini using the official SDK
type Client struct {
	Config Config
	client *genai.Client
}

// NewClient initializes the Gemini client using the official SDK
func NewClient(cfg Config) (*Client, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is missing")
	}

	if cfg.Model == "" {
		cfg.Model = "gemini-3.1-flash-lite-preview" // Default chat model
	}

	ctx := context.Background()
	// Using default endpoint (SDK should handle versioning or hit v1)
	client, err := genai.NewClient(ctx, option.WithAPIKey(cfg.APIKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create genai client: %w", err)
	}

	return &Client{
		Config: cfg,
		client: client,
	}, nil
}

// Close closes the underlying genai client
func (c *Client) Close() error {
	return c.client.Close()
}

// GenerateEmbedding transforms text or multimodal parts into a 3072d vector
func (c *Client) GenerateEmbedding(ctx context.Context, parts ...genai.Part) ([]float32, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	// Use the new multimodal embedding model
	model := c.client.EmbeddingModel("gemini-embedding-2-preview")

	log.Printf("📡 [GEMINI SDK] Gerando embedding multimodal (%d partes)...", len(parts))
	res, err := model.EmbedContent(ctx, parts...)
	if err != nil {
		return nil, fmt.Errorf("embedding error: %w", err)
	}

	return res.Embedding.Values, nil
}

// AskExpert asks a question using the legacy simple flow (for backward compatibility if needed)
func (c *Client) AskExpert(question string) (string, error) {
	ctx := context.Background()
	model := c.client.GenerativeModel(c.Config.Model)

	// Set system instruction
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(systemPrompt)},
	}

	model.SetTemperature(0.2)

	log.Println("📡 [GEMINI SDK] Chamada simples para o oráculo.")
	resp, err := model.GenerateContent(ctx, genai.Text(question))
	if err != nil {
		log.Printf("❌ [GEMINI SDK] Erro fatal em GenerateContent: %v", err)
		return "", fmt.Errorf("generate content error: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from gemini (finish_reason: %v)", resp.Candidates[0].FinishReason)
	}

	// Extract text from parts
	var result string
	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			result += string(text)
		}
	}

	return result, nil
}

// GenerateContentWithTools handles the interactive tool calling flow with history support
func (c *Client) GenerateContentWithTools(ctx context.Context, question string, history []*genai.Content, tools []*genai.Tool) (*genai.GenerateContentResponse, *genai.ChatSession, error) {
	model := c.client.GenerativeModel(c.Config.Model)
	model.Tools = tools
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(systemPrompt)},
	}
	model.SetTemperature(0.2)

	session := model.StartChat()
	if len(history) > 0 {
		session.History = history
	}

	log.Printf("📡 [GEMINI SDK] Chamada com Tools e Memória (%d msgs) para: %s", len(history), question)
	resp, err := session.SendMessage(ctx, genai.Text(question))
	if err != nil {
		log.Printf("❌ [GEMINI SDK] Erro fatal em SendMessage (Tool Calling): %v", err)
		return nil, nil, fmt.Errorf("send message error: %w", err)
	}

	return resp, session, nil
}
