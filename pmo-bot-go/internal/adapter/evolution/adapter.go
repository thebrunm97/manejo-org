package evolution

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// EvolutionAdapter implements the ports.MessageSender interface for Evolution API.
type EvolutionAdapter struct {
	BaseURL      string
	InstanceName string
	APIKey       string
	httpClient   *http.Client
}

// NewEvolutionAdapter creates a new instance of EvolutionAdapter.
func NewEvolutionAdapter(baseURL, instanceName, apiKey string) *EvolutionAdapter {
	return &EvolutionAdapter{
		BaseURL:      baseURL,
		InstanceName: instanceName,
		APIKey:       apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendMessage sends a text message.
func (a *EvolutionAdapter) SendMessage(to, text string) error {
	url := fmt.Sprintf("%s/send/text", a.BaseURL)
	payload := map[string]interface{}{
		"number":       to,
		"text":         text,
		"instanceName": a.InstanceName,
	}
	return a.doRequest(http.MethodPost, url, payload)
}

// SendVoice sends an audio message (PTT).
func (a *EvolutionAdapter) SendVoice(to, base64Audio string, isPtt bool) error {
	url := fmt.Sprintf("%s/send/media", a.BaseURL)
	payload := map[string]interface{}{
		"number":       to,
		"media":        base64Audio,
		"mediatype":    "audio",
		"ptt":          isPtt,
		"instanceName": a.InstanceName,
	}
	return a.doRequest(http.MethodPost, url, payload)
}

// SendReply is not fully implemented yet in Evolution Go, returning a stub.
func (a *EvolutionAdapter) SendReply(to, message, replyToMessageID string) error {
	return errors.New("SendReply not implemented yet for Evolution API")
}

// DownloadAudio is not fully implemented yet, returning a stub.
func (a *EvolutionAdapter) DownloadAudio(messageID string) ([]byte, error) {
	return nil, errors.New("DownloadAudio not implemented yet for Evolution API")
}

// DownloadImage is not fully implemented yet, returning a stub.
func (a *EvolutionAdapter) DownloadImage(messageID string) ([]byte, string, error) {
	return nil, "", errors.New("DownloadImage not implemented yet for Evolution API")
}

// doRequest helper to handle HTTP requests and error responses.
func (a *EvolutionAdapter) doRequest(method, url string, payload interface{}) error {
	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.APIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("evolution api error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// Webhook handling

// EvolutionWebhook represents the top-level webhook structure.
type EvolutionWebhook struct {
	Event string      `json:"event"`
	Data  WebhookData `json:"data"`
}

// WebhookData represents the 'data' field in the webhook.
type WebhookData struct {
	Key              WebhookKey     `json:"key"`
	Message          WebhookMessage `json:"message"`
	MessageTimestamp int64          `json:"messageTimestamp"`
	PushName         string         `json:"pushName"`
	InstanceName     string         `json:"instanceName"`
}

// WebhookKey represents the message identification key.
type WebhookKey struct {
	RemoteJid string `json:"remoteJid"`
	FromMe    bool   `json:"fromMe"`
	ID        string `json:"id"`
}

// WebhookMessage represents the actual message content.
type WebhookMessage struct {
	Conversation string `json:"conversation"`
}

// ParseWebhook converts an Evolution API webhook payload into a ports.IncomingMessage.
func ParseWebhook(rawBody []byte) (*ports.IncomingMessage, error) {
	var payload EvolutionWebhook
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal webhook: %w", err)
	}

	// Only process messages.upsert
	if payload.Event != "messages.upsert" {
		return nil, nil // Ignored event
	}

	return &ports.IncomingMessage{
		ID:        payload.Data.Key.ID,
		From:      payload.Data.Key.RemoteJid,
		Body:      payload.Data.Message.Conversation,
		IsFromMe:  payload.Data.Key.FromMe,
		Timestamp: time.Unix(payload.Data.MessageTimestamp, 0),
		Type:      "text", // Default to text for now
	}, nil
}
