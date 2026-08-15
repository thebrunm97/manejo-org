package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/invopop/jsonschema"
	"google.golang.org/genai"

	"github.com/thebrunm97/pmo-bot-go/internal/llm/schema"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// Ensure LLMProviderAdapter implements ports.LLMProvider at compile time.
var _ ports.LLMProvider = (*LLMProviderAdapter)(nil)

type fallbackExecutor interface {
	withFallback(fn func(model string) (any, error)) (any, string, error)
}

// LLMProviderAdapter is a thin wrapper that adapts the existing gemini.Client
// to the ports.LLMProvider interface expected by the domain router.
//
// Because this adapter resides in the gemini package, it can access unexported
// methods like withFallback to ensure the domain receives the correct modelUsed.
type LLMProviderAdapter struct {
	client   *Client
	executor fallbackExecutor
}

// NewLLMProviderAdapter creates a new adapter for Gemini API.
func NewLLMProviderAdapter(c *Client) *LLMProviderAdapter {
	return &LLMProviderAdapter{
		client:   c,
		executor: c,
	}
}

// GenerateStructured implements ports.LLMProvider.
func (a *LLMProviderAdapter) GenerateStructured(ctx context.Context, prompt string, audio []byte, audioMimeType string, schemaObj any) (string, string, error) {
	// 1. Generate JSON Schema using the same reflection rules as schema.Reflect
	reflector := &jsonschema.Reflector{
		RequiredFromJSONSchemaTags: true,
		DoNotReference:             true,
		ExpandedStruct:             true,
	}
	jsonSchema := reflector.Reflect(schemaObj)
	jsonBytes, err := json.Marshal(jsonSchema)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal json schema: %w", err)
	}

	gSchema, err := schema.ForGoogle(jsonBytes)
	if err != nil {
		return "", "", fmt.Errorf("failed to prepare schema for google: %w", err)
	}

	// 2. Prepare request contents
	parts := []*genai.Part{{Text: prompt}}
	if len(audio) > 0 {
		// Pass audio using InlineData. The genai SDK supports Audio with various mime types.
		if audioMimeType == "" {
			log.Printf("⚠️ [LLMProviderAdapter] WARNING: audioMimeType não informado para GenerateStructured, usando default audio/ogg")
			audioMimeType = "audio/ogg" // Fallback but logged explicitly
		}
		parts = append(parts, &genai.Part{
			InlineData: &genai.Blob{
				Data:     audio,
				MIMEType: audioMimeType,
			},
		})
	}

	contents := []*genai.Content{{Parts: parts}}

	// 3. Define the operation that will be executed (and potentially retried/escalated)
	op := func(modelName string) (any, error) {
		config := &genai.GenerateContentConfig{
			Temperature:      genai.Ptr[float32](0.2),
			ResponseMIMEType: "application/json",
			ResponseSchema:   gSchema,
		}

		log.Printf("📡 [GEMINI SDK] Structured call to %s with audio (%d bytes)", modelName, len(audio))
		resp, err := a.client.Client.Models.GenerateContent(ctx, modelName, contents, config)
		if err != nil {
			return nil, err
		}

		if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil || len(resp.Candidates[0].Content.Parts) == 0 {
			return nil, fmt.Errorf("empty structured response from %s", modelName)
		}

		var result string
		for _, part := range resp.Candidates[0].Content.Parts {
			if part.Text != "" {
				result += part.Text
			}
		}

		return result, nil
	}

	// 4. Execute with double-fallback logic (Gemini retries -> OpenRouter escalation)
	res, modelUsed, err := a.executor.withFallback(op)
	if err != nil {
		return "", "", fmt.Errorf("generate structured error with fallback: %w", err)
	}

	resStr, ok := res.(string)
	if !ok {
		return "", "", fmt.Errorf("unexpected response type from withFallback: %T", res)
	}

	return resStr, modelUsed, nil
}
