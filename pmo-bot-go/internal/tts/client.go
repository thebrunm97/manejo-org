package tts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

var (
	ErrTTSQuotaExceeded = errors.New("tts quota exceeded")
	ErrTTSTimeout       = errors.New("tts timeout or context cancelled")
	ErrCodecConversion  = errors.New("tts invalid codec or unexpected response format")
)

type Orchestrator struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
	Models     []string
	Provider   string // "openrouter", "groq", "google"
}

func NewOrchestrator(baseURL, apiKey string) *Orchestrator {
	provider := "openrouter"
	if baseURL == "groq" {
		provider = "groq"
	}
	return &Orchestrator{
		BaseURL:    baseURL,
		APIKey:     apiKey,
		HTTPClient: &http.Client{},
		Provider:   provider,
		Models: []string{
			"openai/tts-1",
			"openai/gpt-4o-mini-tts",
		},
	}
}

func NewGroqOrchestrator(apiKey string) *Orchestrator {
	return &Orchestrator{
		BaseURL:    "https://api.groq.com/openai/v1/audio/speech",
		APIKey:     apiKey,
		HTTPClient: &http.Client{},
		Provider:   "groq",
		Models: []string{
			"playai-tts",
			"playai-tts-arabic",
		},
	}
}

func NewGoogleOrchestrator() *Orchestrator {
	return &Orchestrator{
		BaseURL:    "https://translate.google.com/translate_tts",
		HTTPClient: &http.Client{},
		Provider:   "google",
		Models:     []string{"google-translate"},
	}
}

func (c *Orchestrator) GenerateSpeech(ctx context.Context, text string) ([]byte, error) {
	var lastErr error
	for _, model := range c.Models {
		audioBytes, err := c.generateSpeechForModel(ctx, text, model)
		if err == nil {
			return audioBytes, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func (c *Orchestrator) generateSpeechForModel(ctx context.Context, text string, model string) ([]byte, error) {
	switch c.Provider {
	case "google":
		return c.generateGoogleTTS(ctx, text)
	case "groq":
		return c.generateGroqTTS(ctx, text, model)
	default:
		return c.generateOpenRouterTTS(ctx, text, model)
	}
}

func (c *Orchestrator) generateGoogleTTS(ctx context.Context, text string) ([]byte, error) {
	// Google Translate TTS has a character limit (~200 chars per request)
	// Split long text into chunks
	const maxChars = 200
	var allAudio []byte

	chunks := splitText(text, maxChars)
	for i, chunk := range chunks {
		params := url.Values{}
		params.Set("ie", "UTF-8")
		params.Set("q", chunk)
		params.Set("tl", "pt-BR")
		params.Set("client", "tw-ob")
		params.Set("idx", fmt.Sprintf("%d", i))
		params.Set("total", fmt.Sprintf("%d", len(chunks)))

		reqURL := c.BaseURL + "?" + params.Encode()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return nil, err
			}
			if errors.Is(err, context.DeadlineExceeded) {
				return nil, err
			}
			return nil, fmt.Errorf("http request failed: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusTooManyRequests {
			return nil, ErrTTSQuotaExceeded
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("google tts api error (status %d): %s", resp.StatusCode, string(body))
		}

		audioBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read response body: %w", err)
		}

		allAudio = append(allAudio, audioBytes...)
	}

	// Validate magic bytes (ID3)
	if len(allAudio) < 3 || !bytes.HasPrefix(allAudio, []byte{0x49, 0x44, 0x33}) {
		// Fallback check for MPEG ADTS sync word
		if len(allAudio) >= 2 && allAudio[0] == 0xFF && (allAudio[1]&0xE0) == 0xE0 {
			// Valid MPEG frame, it's ok
		} else {
			return nil, fmt.Errorf("%w: missing mp3 magic bytes", ErrCodecConversion)
		}
	}

	return allAudio, nil
}

func (c *Orchestrator) generateGroqTTS(ctx context.Context, text string, model string) ([]byte, error) {
	payload := map[string]interface{}{
		"model":           model,
		"input":           text,
		"voice":           "Fritz-PlayAI",
		"response_format": "mp3",
	}

	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil, err
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, err
		}
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrTTSQuotaExceeded
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tts api error (status %d): %s", resp.StatusCode, string(body))
	}

	audioBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Validate magic bytes (ID3)
	if len(audioBytes) < 3 || !bytes.HasPrefix(audioBytes, []byte{0x49, 0x44, 0x33}) {
		if len(audioBytes) >= 2 && audioBytes[0] == 0xFF && (audioBytes[1]&0xE0) == 0xE0 {
			// Valid MPEG frame, it's ok
		} else {
			return nil, fmt.Errorf("%w: missing mp3 magic bytes", ErrCodecConversion)
		}
	}

	return audioBytes, nil
}

func (c *Orchestrator) generateOpenRouterTTS(ctx context.Context, text string, model string) ([]byte, error) {
	payload := map[string]interface{}{
		"model":           model,
		"input":           text,
		"voice":           "alloy",
		"response_format": "mp3",
	}

	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil, err
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, err
		}
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrTTSQuotaExceeded
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tts api error (status %d): %s", resp.StatusCode, string(body))
	}

	audioBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Validate magic bytes (ID3)
	if len(audioBytes) < 3 || !bytes.HasPrefix(audioBytes, []byte{0x49, 0x44, 0x33}) {
		if len(audioBytes) >= 2 && audioBytes[0] == 0xFF && (audioBytes[1]&0xE0) == 0xE0 {
			// Valid MPEG frame, it's ok
		} else {
			return nil, fmt.Errorf("%w: missing mp3 magic bytes", ErrCodecConversion)
		}
	}

	return audioBytes, nil
}

func splitText(text string, maxChars int) []string {
	if len(text) <= maxChars {
		return []string{text}
	}

	var chunks []string
	// Split by sentences first
	sentences := strings.Split(text, ". ")
	currentChunk := ""

	for _, sentence := range sentences {
		sentence = strings.TrimSpace(sentence)
		if sentence == "" {
			continue
		}
		if !strings.HasSuffix(sentence, ".") {
			sentence += "."
		}

		if len(currentChunk)+len(sentence)+1 <= maxChars {
			if currentChunk != "" {
				currentChunk += " "
			}
			currentChunk += sentence
		} else {
			if currentChunk != "" {
				chunks = append(chunks, currentChunk)
			}
			currentChunk = sentence
		}
	}

	if currentChunk != "" {
		chunks = append(chunks, currentChunk)
	}

	// If still too long, split by characters
	var finalChunks []string
	for _, chunk := range chunks {
		if len(chunk) <= maxChars {
			finalChunks = append(finalChunks, chunk)
		} else {
			for i := 0; i < len(chunk); i += maxChars {
				end := i + maxChars
				if end > len(chunk) {
					end = len(chunk)
				}
				finalChunks = append(finalChunks, chunk[i:end])
			}
		}
	}

	return finalChunks
}
