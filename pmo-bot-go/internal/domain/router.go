package domain

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ProcessMessageMetadata contains audit information about how the message was processed.
// It MUST be persisted to Supabase for observability and compliance.
//
// Field hierarchy:
//   - AudioProvider: high-level routing decision ("gemini-native" | "groq-whisper")
//   - ModelUsed:     granular truth of which model actually responded. These can differ
//     when the LLM adapter's internal fallback fires (e.g. Gemini → OpenRouter).
//     Use ModelUsed for cost attribution; use AudioProvider for pipeline audit.
type ProcessMessageMetadata struct {
	Intent            string `json:"intent"`
	FinalTranscript   string `json:"final_transcript"`
	FallbackTriggered bool   `json:"fallback_triggered"`
	// FinalStatus mirrors AudioIntentResult.Status. MUST be checked by the caller (e.g., fsm.go).
	// "unclear" means classification failed after all attempts — caller should ask user to repeat.
	FinalStatus string `json:"final_status"`
	// AudioProvider is the high-level routing decision: "gemini-native" or "groq-whisper".
	AudioProvider string `json:"audio_provider"`
	// ModelUsed is the granular model identity that actually produced the final response.
	// Examples: "gemini-2.0-flash", "openrouter/qwen-72b", "groq-whisper-large-v3-turbo".
	// Populated from ports.LLMProvider.GenerateStructured's modelUsed return value.
	ModelUsed string `json:"model_used"`
}

// ProcessAudioMessage orchestrates the intent classification for audio messages,
// implementing the Double Fallback strategy (Technical Error or Quality Error).
//
// Fallback triggers (in order of evaluation):
//  1. FORCE_GROQ_AUDIO=true  — hard kill-switch, bypasses primary entirely.
//  2. Technical Error        — primary LLMProvider returns a non-nil error.
//  3. Quality Error          — primary LLMProvider returns status "unclear".
//
// On fallback: Groq Whisper transcribes the audio; the transcript is then sent
// as plain text back to the LLMProvider for intent classification.
func ProcessAudioMessage(
	ctx context.Context,
	audioData []byte,
	audioMimeType string,
	llmProvider ports.LLMProvider,
	audioTranscriber ports.AudioTranscriber,
) (*AudioIntentResult, *ProcessMessageMetadata, error) {

	metadata := &ProcessMessageMetadata{
		AudioProvider:     "gemini-native", // High-level path; overridden to "groq-whisper" on fallback.
		FallbackTriggered: false,
	}

	var classified *ClassifyAudioIntentResult
	var err error

	// Check kill-switch first — avoids any primary LLM call.
	forceGroq := strings.ToLower(os.Getenv("FORCE_GROQ_AUDIO")) == "true"

	if !forceGroq {
		// Primary path: native audio via LLMProvider (Gemini 3.5 Flash-Lite).
		classified, err = ClassifyAudioIntent(ctx, llmProvider, "", audioData, audioMimeType)

		// Fallback Trigger 1: Technical Error (timeout, 5xx, network failure).
		if err != nil {
			log.Printf("Primary LLM audio processing failed (Technical Error): %v. Triggering fallback.", err)
			metadata.FallbackTriggered = true
		} else if classified != nil && classified.Result.Status == "unclear" {
			// Fallback Trigger 2: Quality Error (model could not understand audio).
			log.Printf("Primary LLM returned 'unclear' (Quality Error). Triggering fallback.")
			metadata.FallbackTriggered = true
		}

		// Capture the model used by the primary path (even if it later falls back).
		// This is recorded before overwriting in the fallback block below.
		if classified != nil {
			metadata.ModelUsed = classified.ModelUsed
		}
	} else {
		log.Println("FORCE_GROQ_AUDIO=true — bypassing primary LLM audio processing.")
		metadata.FallbackTriggered = true
	}

	// Fallback path: Groq Whisper → text → LLMProvider text classification.
	if metadata.FallbackTriggered {
		metadata.AudioProvider = "groq-whisper"

		// Step 1: Transcribe with the dedicated audio service (Groq Whisper).
		transcription, tErr := audioTranscriber.Transcribe(ctx, audioData, audioMimeType)
		if tErr != nil {
			return nil, metadata, fmt.Errorf("fallback audio transcription failed: %w", tErr)
		}

		// Step 2: Classify intent from the transcribed text via LLMProvider (text-only, no audio).
		classified, err = ClassifyAudioIntent(ctx, llmProvider, transcription, nil, "")
		if err != nil {
			return nil, metadata, fmt.Errorf("fallback intent classification failed: %w", err)
		}

		// Update ModelUsed to reflect the model that handled the text classification step.
		if classified != nil {
			metadata.ModelUsed = classified.ModelUsed

			// Preserve Groq's verbatim transcription if the LLM didn't produce one.
			if classified.Result.Transcription == "" {
				classified.Result.Transcription = transcription
			}
		}
	}

	// Populate final metadata fields from the result (works for both primary and fallback paths).
	if classified != nil && classified.Result != nil {
		metadata.Intent = classified.Result.Intent
		metadata.FinalTranscript = classified.Result.Transcription
		metadata.FinalStatus = classified.Result.Status

		// Warn if classification is still "unclear" after all attempts.
		// The caller (fsm.go) MUST check FinalStatus and handle this case
		// by prompting the user to repeat their message.
		if classified.Result.Status == "unclear" {
			log.Printf("WARNING: Intent still 'unclear' after all fallback attempts. AudioProvider=%s, ModelUsed=%s, FallbackTriggered=%v",
				metadata.AudioProvider, metadata.ModelUsed, metadata.FallbackTriggered)
		}
	}

	if classified == nil {
		return nil, metadata, nil
	}
	return classified.Result, metadata, nil
}
