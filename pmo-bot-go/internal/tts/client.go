package tts

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
)

// Orchestrator coordinates the TTS circuit breaker
type Orchestrator struct {
}

// NewOrchestrator creates a new TTS orchestrator
func NewOrchestrator() *Orchestrator {
	return &Orchestrator{}
}

// GenerateSpeech generates spoken audio from text using a sequential fallback.
func (o *Orchestrator) GenerateSpeech(ctx context.Context, text string) (string, error) {
	// Attempt 1: htgotts minimal fallback (Google) returns raw MP3 bytes
	mp3Bytes, err := o.tryFallback(ctx, text)
	if err == nil {
		log.Printf("🎤 [TTS] Sucesso gerando áudio (MP3) com fallback Google Translate.")
		return "data:audio/mpeg;base64," + base64.StdEncoding.EncodeToString(mp3Bytes), nil
	}

	log.Printf("❌ [TTS] Falha crítica no TTS fallback: %v. Decaindo para texto.", err)
	return "", fmt.Errorf("all TTS engines failed")
}

func (o *Orchestrator) tryFallback(_ context.Context, _ string) ([]byte, error) {
	// TTS disabled for visual fallback mode to save resources and bypass DRM issues.
	return nil, fmt.Errorf("TTS disabled for visual fallback mode")
}
