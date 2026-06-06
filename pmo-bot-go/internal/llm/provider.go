// Package llm defines provider-agnostic types and interfaces for LLM integration.
// The LLMProvider interface is the single contract that all providers (Gemini,
// OpenRouter, Anthropic, Local) must satisfy. Business logic NEVER imports
// provider-specific SDKs — it depends only on this package.
package llm

import "context"

// LLMProvider is the agnostic contract for any AI provider.
// Every implementation (Gemini, OpenRouter, Anthropic, Local) must satisfy it.
// The interface is intentionally "fat" (7 methods) because it maps 1:1 to the
// capabilities the business domain actually uses — no casts, no type assertions.
type LLMProvider interface {
	// GenerateContent executes a full completion call with history, tools and
	// optional structured output schema. This is the primary method used by
	// the Orchestrator's agentic loop. Provider-level fallback (e.g. Google →
	// OpenRouter) is encapsulated INSIDE the implementation.
	GenerateContent(ctx context.Context, req ContentRequest) (RespostaAgnostica, error)

	// ClassifyIntent performs unified intent classification + NER extraction.
	// Returns the structured result and the model name actually used.
	ClassifyIntent(ctx context.Context, text string) (UnifiedIntentResult, string, error)

	// AskSimple sends a single question without tools (legacy/utility path).
	// Returns (answer, model_used, error).
	AskSimple(ctx context.Context, question string, systemInstruction string) (string, string, error)

	// DescribeImage analyzes an image and returns a technical description.
	// Returns (description, model_used, error).
	DescribeImage(ctx context.Context, imageBytes []byte, mimeType string) (string, string, error)

	// Embedder returns the sub-interface for text embedding operations.
	// This satisfies the mcp.Embedder contract without import cycles.
	Embedder() Embedder

	// ModelName returns the primary model name configured for this provider.
	// Used for logging and audit trails before a call is made.
	ModelName() string

	// EvaluateEvidenceListwise evaluates a list of retrieved chunks against a query.
	EvaluateEvidenceListwise(ctx context.Context, query string, chunks []string) (MetaRAGResult, error)

	// Close releases any resources held by the provider.
	Close() error
}

// Embedder generates text embeddings. Defined here (not in mcp) to avoid
// import cycles. The mcp.Server accepts this interface at construction time.
type Embedder interface {
	// GenerateEmbedding encodes a document chunk for indexing.
	GenerateEmbedding(text string) ([]float32, error)
	// GenerateQueryEmbedding encodes a search query (may apply task prefix).
	GenerateQueryEmbedding(query string) ([]float32, error)
}

// ContentRequest groups the parameters for a GenerateContent call.
// Schema is a raw JSON Schema map — each provider converts it to its native
// format internally (e.g. *genai.Schema for Google, response_format for OpenAI).
type ContentRequest struct {
	SystemInstruction string
	History           []MensagemAgnostica
	Tools             []FerramentaAgnostica
	Schema            map[string]interface{} // nil = no structured output
}
