package tts

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// GoogleTranslateProvider usa o endpoint de leitura do Google Tradutor.
//
// ATENÇÃO: é uma API NÃO-OFICIAL, sem contrato de estabilidade — pode ser
// bloqueada ou limitada sem aviso. Além disso a voz é notoriamente robótica.
// Mantido apenas como fallback de emergência; o padrão é o Piper (ver factory.go).
type GoogleTranslateProvider struct {
	BaseURL    string
	HTTPClient *http.Client
}

// googleTTSMaxChars é o limite prático por requisição do endpoint do Tradutor.
const googleTTSMaxChars = 200

// GenerateSpeech implementa ports.TTSProvider.
func (p *GoogleTranslateProvider) GenerateSpeech(ctx context.Context, text string) ([]byte, string, error) {
	var allAudio []byte

	chunks := splitText(text, googleTTSMaxChars)
	for i, chunk := range chunks {
		params := url.Values{}
		params.Set("ie", "UTF-8")
		params.Set("q", chunk)
		params.Set("tl", "pt-BR")
		params.Set("client", "tw-ob")
		params.Set("idx", fmt.Sprintf("%d", i))
		params.Set("total", fmt.Sprintf("%d", len(chunks)))

		reqURL := p.BaseURL + "?" + params.Encode()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, "", fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

		resp, err := p.HTTPClient.Do(req)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return nil, "", err
			}
			return nil, "", fmt.Errorf("http request failed: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			return nil, "", ErrTTSQuotaExceeded
		}
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, "", fmt.Errorf("google tts api error (status %d): %s", resp.StatusCode, string(body))
		}

		audioBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, "", fmt.Errorf("failed to read response body: %w", err)
		}

		allAudio = append(allAudio, audioBytes...)
	}

	mime, err := sniffAudioMIME(allAudio)
	if err != nil {
		return nil, "", err
	}
	return allAudio, mime, nil
}

// Name implementa ports.TTSProvider.
func (p *GoogleTranslateProvider) Name() string { return "google-translate" }

func splitText(text string, maxChars int) []string {
	if len(text) <= maxChars {
		return []string{text}
	}

	var chunks []string
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
