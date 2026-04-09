package evolution

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
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

// SetPresence sends a presence update (composing, recording, etc.) to a chat.
func (a *EvolutionAdapter) SetPresence(to string, presence string) error {
	url := fmt.Sprintf("%s/message/presence", a.BaseURL)
	payload := map[string]interface{}{
		"number":       to,
		"state":        presence,
		"delay":        15000,
		"instanceName": a.InstanceName,
	}
	
	err := a.doRequest(http.MethodPost, url, payload)
	if err != nil {
		log.Printf("⚠️ [Evolution] Falha ao definir presença (%s) para %s: %v", presence, to, err)
	}
	return err
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

// GetConnectionState returns the current state of the WhatsApp connection.
func (a *EvolutionAdapter) GetConnectionState() (string, error) {
	// For Evolution Go, the correct endpoint is /instance/status
	// The apikey identifies which instance to check.
	url := fmt.Sprintf("%s/instance/status", a.BaseURL)
	
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", a.APIKey)

	// Use a short timeout for the connection state check
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	// Evolution Go returns {"message": "success", "data": {"Connected": true, "LoggedIn": true}}
	var result struct {
		Data struct {
			Connected bool `json:"Connected"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Data.Connected {
		return "open", nil
	}
	return "close", nil
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

// EvolutionWebhook represents the top-level webhook structure (compatible with Go version).
type EvolutionWebhook struct {
	Event string `json:"event"`
	Data  struct {
		Info struct {
			ID        string `json:"ID"`
			Chat      string `json:"Chat"`
			Sender    string `json:"Sender"`
			IsFromMe  bool   `json:"IsFromMe"`
			Timestamp string `json:"Timestamp"`
			Type      string `json:"Type"`
		} `json:"info"`
		Message struct {
			Conversation        string `json:"conversation"`
			ExtendedTextMessage struct {
				Text string `json:"text"`
			} `json:"extendedTextMessage"`
		} `json:"message"`
	} `json:"data"`
}

// ParseWebhook converts an Evolution API webhook payload into a ports.IncomingMessage.
func ParseWebhook(rawBody []byte) (*ports.IncomingMessage, error) {
	var payload EvolutionWebhook
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal webhook: %w", err)
	}

	// Evolution Go uses "Message", Legacy Evolution Node uses "messages.upsert"
	if payload.Event != "messages.upsert" && payload.Event != "Message" {
		return nil, nil // Ignored event
	}

	// Extract body
	body := payload.Data.Message.Conversation
	if body == "" && payload.Data.Message.ExtendedTextMessage.Text != "" {
		body = payload.Data.Message.ExtendedTextMessage.Text
	}

	// Extract Sender/Chat correctly
	from := payload.Data.Info.Chat
	if from == "" {
		from = payload.Data.Info.Sender
	}

	// Parse Timestamp
	ts := time.Now()
	if payload.Data.Info.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, payload.Data.Info.Timestamp); err == nil {
			ts = t
		}
	}

	// If timestamp is still zero or very old, use current time
	if ts.IsZero() {
		ts = time.Now()
	}

	return &ports.IncomingMessage{
		ID:        payload.Data.Info.ID,
		From:      from,
		Body:      body,
		IsFromMe:  payload.Data.Info.IsFromMe,
		Timestamp: ts,
		Type:      "text",
	}, nil
}
