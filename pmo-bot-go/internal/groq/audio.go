package groq

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

const (
	audioApiURL = "https://api.groq.com/openai/v1/audio/transcriptions"
	audioModel  = "whisper-large-v3-turbo"
)

// AudioTranscriptionRequest struct para STT via HTTP multipart form
type AudioTranscriptionRequest struct {
	FileData []byte
	FileName string
	Model    string
	Language string
}

// AudioTranscriptionResponse resposta simples de texto
type AudioTranscriptionResponse struct {
	Text string `json:"text"`
}

// Transcribe envia o áudio (em bytes) para o modelo Whisper da Groq
func (c *Client) Transcribe(ctx context.Context, req AudioTranscriptionRequest) (*AudioTranscriptionResponse, error) {
	if req.Model == "" {
		req.Model = audioModel
	}
	if req.Language == "" {
		req.Language = "pt"
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add file
	part, err := writer.CreateFormFile("file", req.FileName)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(req.FileData)); err != nil {
		return nil, fmt.Errorf("failed to copy file data: %w", err)
	}

	// Add metadata fields
	if err := writer.WriteField("model", req.Model); err != nil {
		return nil, fmt.Errorf("failed to write model field: %w", err)
	}
	if err := writer.WriteField("language", req.Language); err != nil {
		return nil, fmt.Errorf("failed to write language field: %w", err)
	}
	if err := writer.WriteField("response_format", "json"); err != nil {
		return nil, fmt.Errorf("failed to write format field: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request with strict timeout context
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, audioApiURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create groq audio request: %w", err)
	}

	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	// Retry loop for transient failures
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt) * 200 * time.Millisecond
			select {
			case <-ctx.Done():
				return nil, fmt.Errorf("context cancelled during backoff: %w", ctx.Err())
			case <-time.After(backoff):
			}
		}

		resp, err := c.httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("http request failed: %w", err)
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("failed to read groq audio response body: %w", err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("groq audio API returned error %d: %s", resp.StatusCode, string(respBody))
			continue
		}

		var result AudioTranscriptionResponse
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("failed to parse groq audio response JSON: %w", err)
		}

		return &result, nil
	}

	return nil, fmt.Errorf("groq STT failed after %d attempts: %w", maxRetries+1, lastErr)
}
