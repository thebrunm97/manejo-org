package domain

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// AudioIntentResult represents the structured response from the LLM after classifying
// the intent of an audio (or text-fallback) message.
//
// NOTE ON NAMING: This struct is intentionally named AudioIntentResult (not IntentResult)
// to avoid ambiguity with llm.UnifiedIntentResult, which is the richer NER result used
// by the legacy FSM router. These are two different contracts for two different pipelines.
type AudioIntentResult struct {
	Intent        string  `json:"intent" jsonschema:"description=The classified intent of the message (e.g. 'registro_campo' or 'duvida_agronomica')"`
	Transcription string  `json:"transcription" jsonschema:"description=The full transcribed text of the user's message"`
	Status        string  `json:"status" jsonschema:"enum=ok,enum=unclear,description=Classification status: 'ok' if intent is clear; 'unclear' if audio is unintelligible or intent is ambiguous"`
	Confidence    float64 `json:"confidence" jsonschema:"description=Confidence score between 0.0 and 1.0"`
}

// ClassifyAudioIntentResult carries both the classification result and the granular
// model identity that actually produced it (may differ from configured model if the
// adapter's internal fallback fired, e.g. Gemini → OpenRouter).
type ClassifyAudioIntentResult struct {
	Result    *AudioIntentResult
	ModelUsed string
}

// ClassifyAudioIntent is a domain helper that constructs the prompt and schema,
// then calls the agnostic LLMProvider to classify the intent of an audio or text message.
//
// NOTE ON NAMING: Renamed from ClassifyIntent to ClassifyAudioIntent to avoid confusion
// with llm.LLMProvider.ClassifyIntent, which is the legacy full-NER classifier used by
// the FSM. These methods serve different pipelines and must not be interchanged.
func ClassifyAudioIntent(ctx context.Context, provider ports.LLMProvider, text string, audio []byte, audioMimeType string) (*ClassifyAudioIntentResult, error) {
	prompt := "You are an agricultural assistant. Please classify the intent of the following message and transcribe it if it's audio. Return the result in the specified JSON format."
	if text != "" {
		prompt += fmt.Sprintf("\nMessage Text: %s", text)
	}
	// Note: when text is empty, audio bytes are passed directly via provider.GenerateStructured.
	// The generic prompt above already instructs the model to "transcribe it if it's audio".
	// If you ever change this prompt, ensure it still has an explicit transcription instruction
	// for the audio-only path, otherwise the fallback logic in router.go will silently degrade.

	// The schema is the struct itself; the adapter derives the JSON Schema via reflection.
	// CONTRACT: must be a zero-value struct, not a pointer — see ports.LLMProvider contract.
	schema := AudioIntentResult{}

	// Call the agnostic provider. modelUsed captures the actual model (may differ from
	// the configured primary if the adapter's internal withFallback fired silently).
	responseStr, modelUsed, err := provider.GenerateStructured(ctx, prompt, audio, audioMimeType, schema)
	if err != nil {
		return nil, fmt.Errorf("failed to generate structured output: %w", err)
	}

	var result AudioIntentResult
	if err := json.Unmarshal([]byte(responseStr), &result); err != nil {
		return nil, fmt.Errorf("failed to parse AudioIntentResult json: %w", err)
	}

	// Post-hoc validation of the status enum. The Gemini API does not always enforce
	// enum constraints strictly; this guard prevents an unexpected value (e.g. "maybe")
	// from propagating to router.go's string comparison and silently misrouting.
	if result.Status != "ok" && result.Status != "unclear" {
		result.Status = "unclear"
	}

	return &ClassifyAudioIntentResult{
		Result:    &result,
		ModelUsed: modelUsed,
	}, nil
}
