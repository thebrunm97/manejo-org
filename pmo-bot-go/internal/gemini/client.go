package gemini

import (
	"context"
	"fmt"
	"log"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"

	_ "embed"
	"strings"
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
func GetPromptForIntent(intent Intent, modality string, temProducaoParalela bool) string {
	var prompt string
	switch intent {
	case IntentRAG:
		prompt = systemPromptAgronomist
	case IntentDatabase:
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

	// Note: For more complex logic like {% if %}, a real template engine like text/template should be used.
	// For now, these basic replacements satisfy the current prompt structure if we adapt the prompts slightly.
	return prompt
}

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
		cfg.Model = "gemini-3.1-flash-lite-preview"
	}

	ctx := context.Background()
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

// GenerateEmbedding transforms a text chunk into a vector
func (c *Client) GenerateEmbedding(text string) ([]float32, error) {
	ctx := context.Background()
	model := c.client.EmbeddingModel("gemini-embedding-001")

	log.Printf("📡 [GEMINI SDK] Gerando embedding para texto (%d chars)...", len(text))
	res, err := model.EmbedContent(ctx, genai.Text(text))
	if err != nil {
		return nil, fmt.Errorf("embedding error: %w", err)
	}

	return res.Embedding.Values, nil
}

// AskExpert asks a question using the legacy simple flow (for backward compatibility if needed)
func (c *Client) AskExpert(question string, customInstruction ...string) (string, error) {
	ctx := context.Background()
	model := c.client.GenerativeModel(c.Config.Model)

	// Set system instruction
	instruction := systemPrompt
	if len(customInstruction) > 0 && customInstruction[0] != "" {
		instruction = customInstruction[0]
	}

	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(instruction)},
	}

	model.SetTemperature(0.2)

	log.Println("📡 [GEMINI SDK] Chamada simples para o oráculo.")
	resp, err := model.GenerateContent(ctx, genai.Text(question))
	if err != nil {
		return "", fmt.Errorf("generate content error: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from gemini")
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

// GenerateContentWithTools handles the interactive tool calling flow with history support.
// Pass a specific systemInstruction to use a modular specialist prompt; pass empty string
// to fall back to the default monolithic prompt.
func (c *Client) GenerateContentWithTools(ctx context.Context, question string, history []*genai.Content, tools []*genai.Tool, systemInstruction ...string) (*genai.GenerateContentResponse, *genai.ChatSession, error) {
	model := c.client.GenerativeModel(c.Config.Model)
	model.Tools = tools

	prompt := systemPrompt
	if len(systemInstruction) > 0 && systemInstruction[0] != "" {
		prompt = systemInstruction[0]
	}
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(prompt)},
	}
	model.SetTemperature(0.2)

	session := model.StartChat()
	if len(history) > 0 {
		session.History = history
	}

	log.Printf("📡 [GEMINI SDK] Chamada com Tools e Memória (%d msgs) para: %s", len(history), question)
	resp, err := session.SendMessage(ctx, genai.Text(question))
	if err != nil {
		return nil, nil, fmt.Errorf("send message error: %w", err)
	}

	return resp, session, nil
}

// DescribeAgronomicImage analyzes an image using gemini-2.5-flash and returns a technical description.
func (c *Client) DescribeAgronomicImage(ctx context.Context, imageBytes []byte, mimeType string) (string, error) {
	// gemini-2.5-flash is used exclusively for vision as a specialized extractor.
	model := c.client.GenerativeModel("gemini-2.5-flash")
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(systemPromptAgronomistVision)},
	}
	model.SetTemperature(0.4)

	log.Printf("📡 [GEMINI SDK] Descrevendo imagem (%s, %d bytes) com gemini-2.5-flash", mimeType, len(imageBytes))

	resp, err := model.GenerateContent(ctx,
		genai.ImageData(mimeType, imageBytes),
	)
	if err != nil {
		return "", fmt.Errorf("vision description error: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty vision response from gemini-2.5-flash")
	}

	var result string
	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			result += string(text)
		}
	}

	return result, nil
}
