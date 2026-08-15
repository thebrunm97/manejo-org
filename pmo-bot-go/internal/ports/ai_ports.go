// Package ports defines the boundary interfaces used exclusively by internal/domain.
//
// # Boundary Rule (ENFORCED BY CONVENTION, NOT COMPILER)
//
// This package is the ONLY LLM contract that internal/domain may depend on.
// It is intentionally narrow (2 interfaces, 2 methods total) and multimodal-first.
//
//   - internal/domain → imports THIS package (ports.LLMProvider, ports.AudioTranscriber)
//   - internal/state, internal/queue, internal/guardrails → import internal/llm (llm.LLMProvider)
//
// DO NOT import internal/llm or any provider SDK (google.golang.org/genai, go-openai)
// from this package. DO NOT inject a llm.LLMProvider where a ports.LLMProvider is expected.
//
// See also: internal/llm/provider.go for the complementary boundary note.
package ports

import "context"

// LLMProvider is the narrow, multimodal-first interface used by internal/domain.
// It is intentionally separate from internal/llm.LLMProvider (the FSM/legacy contract)
// to keep the audio-routing domain decoupled from provider-specific capabilities
// like tool-calling, embeddings, and NER extraction.
type LLMProvider interface {
	// GenerateStructured sends a prompt and optional audio to the LLM and expects a JSON
	// response conforming to the provided schema. It also returns the name of the model
	// that actually responded — necessary when the adapter has internal fallback logic
	// (e.g., Gemini → OpenRouter) that is opaque to the caller. This enables correct
	// audit metadata (ProcessMessageMetadata.ModelUsed) to be recorded in Supabase.
	//
	// CONTRACT for `schema`: MUST be a struct zero-value (e.g., `MyStruct{}`), NOT a
	// pointer and NOT a pre-populated instance. Adapter implementations use reflection
	// to derive the JSON Schema from this type. Passing a pointer or map will cause
	// undefined behavior in the adapter.
	//
	// CONTRACT for `modelUsed` return: MUST reflect the actual model that produced the
	// response (e.g., "gemini-2.0-flash", "openrouter/qwen-72b"). Never return the
	// primary/configured model name if the adapter silently fell back to another.
	//
	// Example:
	//   resp, modelUsed, err := provider.GenerateStructured(ctx, prompt, audio, "audio/ogg", AudioIntentResult{})
	GenerateStructured(ctx context.Context, prompt string, audio []byte, audioMimeType string, schema any) (response string, modelUsed string, err error)
}

// AudioTranscriber is the interface for dedicated audio transcription services.
// It is used exclusively as the fallback path in domain.ProcessAudioMessage when
// the primary LLMProvider fails technically or returns status "unclear".
// Current implementation: internal/groq.AudioTranscriberAdapter (Groq Whisper).
type AudioTranscriber interface {
	// Transcribe converts raw audio bytes into plain text.
	// Implementations must handle language detection or default to "pt" for this project.
	// The audio language default is controlled by the adapter's config, not hardcoded here.
	// audioMimeType is provided so the adapter can supply the correct file extension to the API.
	Transcribe(ctx context.Context, audio []byte, audioMimeType string) (string, error)
}
