package tts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
)

// OpenAICompatProvider fala o protocolo POST /v1/audio/speech da OpenAI.
//
// Vale para mais de um fornecedor porque todos convergiram para o mesmo formato
// de payload ({model, input, voice, response_format}):
//   - Piper auto-hospedado (kamilkrawiec/piper-openai-tts)
//   - Groq (PlayAI)
//   - OpenRouter
//
// A diferença entre eles é só configuração (URL, chave, modelo, voz), então uma
// única implementação evita três cópias do mesmo cliente HTTP.
type OpenAICompatProvider struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client

	// Models é a cadeia de fallback, tentada em ordem até a primeira que responder.
	Models []string
	// Voice é a voz solicitada. No Piper é o nome do modelo de voz
	// (ex: "pt_BR-faber-medium"); nos serviços gerenciados é um rótulo ("alloy").
	Voice string
	// ResponseFormat é "mp3" ou "wav".
	ResponseFormat string
	// label identifica o fornecedor nos logs (ex: "piper", "groq").
	label string

	mu       sync.RWMutex
	lastUsed string
}

// GenerateSpeech implementa ports.TTSProvider.
func (p *OpenAICompatProvider) GenerateSpeech(ctx context.Context, text string) ([]byte, string, error) {
	var lastErr error
	for _, model := range p.Models {
		audio, mime, err := p.generateForModel(ctx, text, model)
		if err == nil {
			p.mu.Lock()
			p.lastUsed = model
			p.mu.Unlock()
			return audio, mime, nil
		}
		// Cancelamento/timeout são decisão do chamador, não falha do modelo:
		// tentar o próximo só desperdiçaria tempo de um contexto já morto.
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, "", err
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("tts: nenhum modelo configurado para %s", p.label)
	}
	return nil, "", lastErr
}

// Name implementa ports.TTSProvider, refletindo o modelo que de fato respondeu.
func (p *OpenAICompatProvider) Name() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.lastUsed != "" {
		return p.label + ":" + p.lastUsed
	}
	return p.label
}

func (p *OpenAICompatProvider) generateForModel(ctx context.Context, text, model string) ([]byte, string, error) {
	format := p.ResponseFormat
	if format == "" {
		format = "mp3"
	}

	payload := map[string]interface{}{
		"model":           model,
		"input":           text,
		"voice":           p.Voice,
		"response_format": format,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal tts payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.BaseURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	// O Piper auto-hospedado não exige autenticação; só manda o header quem tem chave.
	if p.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.APIKey)
	}

	resp, err := p.HTTPClient.Do(req)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, "", err
		}
		return nil, "", fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, "", ErrTTSQuotaExceeded
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("tts api error (status %d): %s", resp.StatusCode, string(body))
	}

	audioBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read response body: %w", err)
	}

	mime, err := sniffAudioMIME(audioBytes)
	if err != nil {
		return nil, "", err
	}
	return audioBytes, mime, nil
}

// sniffAudioMIME valida que a resposta é mesmo áudio e deduz o formato pelos
// magic bytes. Serve de guarda contra fornecedores que devolvem HTTP 200 com um
// corpo de erro em JSON/HTML — sem isso, o "áudio" só falharia lá na frente, no
// WhatsApp, sem pista da causa.
func sniffAudioMIME(data []byte) (string, error) {
	switch {
	// ID3 tag ("ID3") — MP3 com metadados
	case len(data) >= 3 && bytes.HasPrefix(data, []byte{0x49, 0x44, 0x33}):
		return "audio/mpeg", nil
	// MPEG ADTS sync word — MP3 sem tag
	case len(data) >= 2 && data[0] == 0xFF && (data[1]&0xE0) == 0xE0:
		return "audio/mpeg", nil
	// "RIFF"...."WAVE" — WAV, formato padrão do Piper
	case len(data) >= 12 && bytes.HasPrefix(data, []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WAVE")):
		return "audio/wav", nil
	// "OggS" — Ogg (Opus/Vorbis)
	case len(data) >= 4 && bytes.HasPrefix(data, []byte("OggS")):
		return "audio/ogg", nil
	default:
		return "", fmt.Errorf("%w: resposta não reconhecida como áudio", ErrCodecConversion)
	}
}
