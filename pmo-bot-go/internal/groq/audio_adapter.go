package groq

import (
	"context"
	"fmt"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// Ensure AudioTranscriberAdapter implements ports.AudioTranscriber at compile time.
var _ ports.AudioTranscriber = (*AudioTranscriberAdapter)(nil)

// AudioTranscriberAdapter is a thin wrapper that adapts the existing groq.Client
// to the ports.AudioTranscriber interface expected by the domain router.
type AudioTranscriberAdapter struct {
	client   *Client
	language string
}

// NewAudioTranscriberAdapter creates a new adapter for Groq audio transcription.
// NOTE ON LANGUAGE: We inject the language here at construction time rather than
// per-request because the domain (currently) expects a single target language (pt).
// If the system ever needs to serve multiple languages concurrently, you should
// instantiate multiple adapters or refactor the ports.AudioTranscriber interface
// to accept a language parameter.
func NewAudioTranscriberAdapter(c *Client, language string) *AudioTranscriberAdapter {
	if language == "" {
		language = "pt"
	}
	return &AudioTranscriberAdapter{
		client:   c,
		language: language,
	}
}

// deriveFileName extracts a sensible extension from the audioMimeType
// and returns a file name for the Whisper API.
func deriveFileName(audioMimeType string) string {
	ext := ".ogg"
	if audioMimeType != "" {
		cleanMime := audioMimeType
		for i := 0; i < len(audioMimeType); i++ {
			if audioMimeType[i] == ';' {
				cleanMime = strings.TrimSpace(audioMimeType[:i])
				break
			}
		}
		if len(cleanMime) > 6 && cleanMime[:6] == "audio/" {
			ext = "." + cleanMime[6:]
		}
	}
	return "audio" + ext
}

// Transcribe converts raw audio bytes into text using the Groq Whisper API.
func (a *AudioTranscriberAdapter) Transcribe(ctx context.Context, audio []byte, audioMimeType string) (string, error) {
	req := AudioTranscriptionRequest{
		FileData: audio,
		FileName: deriveFileName(audioMimeType),
		Model:    audioModel,
		Language: a.language,
	}

	resp, err := a.client.Transcribe(ctx, req)
	if err != nil {
		return "", fmt.Errorf("groq audio adapter transcription failed: %w", err)
	}

	return resp.Text, nil
}
