package wppconnect

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// Config represents the WPPConnect server configuration
type Config struct {
	URL     string
	Token   string
	Session string
}

// Client wraps HTTP communication with WPPConnect Server
type Client struct {
	config     Config
	secretKey  string
	httpClient *http.Client
}

// NewClient initializes the WhatsApp client
func NewClient(cfg Config) (*Client, error) {
	if cfg.URL == "" || cfg.Token == "" || cfg.Session == "" {
		return nil, fmt.Errorf("WPPCONNECT_URL, WPPCONNECT_TOKEN, or WPP_SESSION are missing")
	}

	c := &Client{
		config:    cfg,
		secretKey: cfg.Token, // cfg.Token initially holds the SECRET_KEY from env
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}

	// Try to generate token initially
	token, err := c.generateToken(c.secretKey)
	if err != nil {
		log.Printf("⚠️ Falha inicial ao conectar no WPPConnect: %v. Auto-Reconnect tentará em background.", err)
	} else {
		c.config.Token = token // Replace SecretKey with actual JWT Token
		log.Println("✅ [WPP] Conectado e Token JWT gerado com sucesso!")

		// 🚀 Proactively start session on startup
		ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		defer cancel()
		if err := c.StartSession(ctx); err != nil {
			log.Printf("⚠️ [WPP] Aviso ao iniciar sessão: %v (Pode já estar aberta)", err)
		}
	}

	// Start auto-reconnect loop in background
	go c.autoReconnectLoop()

	return c, nil
}

func (c *Client) autoReconnectLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		_, _, err := c.CheckConnection()
		if err != nil || c.config.Token == c.secretKey || c.config.Token == "" {
			token, genErr := c.generateToken(c.secretKey)
			if genErr == nil && token != "" {
				c.config.Token = token
				log.Println("✅ [WPP] Cliente WhatsApp reconectado (Novo Token JWT) com sucesso!")

				ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
				if err := c.StartSession(ctx); err != nil {
					log.Printf("⚠️ [WPP] Aviso ao iniciar sessão pós-refresh: %v", err)
				}
				cancel()
			}
		}
	}
}

func (c *Client) generateToken(secretKey string) (string, error) {
	reqURL := fmt.Sprintf("%s/api/%s/%s/generate-token", c.config.URL, c.config.Session, secretKey)
	req, err := http.NewRequest(http.MethodPost, reqURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}
	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.Token, nil
}

func (c *Client) StartSession(ctx context.Context) error {
	reqURL := fmt.Sprintf("%s/api/%s/start-session", c.config.URL, c.config.Session)
	webhookURL := os.Getenv("WEBHOOK_URL")
	if webhookURL == "" {
		webhookURL = "http://pmo-bot-go:8080/webhook/wppconnect"
	}
	if token := os.Getenv("WPPCONNECT_TOKEN"); token != "" {
		if strings.Contains(webhookURL, "?") {
			webhookURL += "&token=" + token
		} else {
			webhookURL += "?token=" + token
		}
	}
	payload := map[string]interface{}{
		"webhook":    webhookURL,
		"waitQrCode": true,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.config.Token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		if resp.StatusCode == http.StatusBadRequest {
			return nil
		}
		return fmt.Errorf("start-session fail (HTTP %d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// Interface Implementation (ports.MessageSender)

func (c *Client) SendMessage(to, message string) error {
	reqURL := fmt.Sprintf("%s/api/%s/send-message", c.config.URL, c.config.Session)
	payload := map[string]interface{}{
		"phone":   to,
		"message": utils.SanitizeForWhatsApp(message),
		"isGroup": false,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, bodyBytes)
	return err
}

func (c *Client) SendButton(to string, title, description, footer string, buttons []map[string]string) error {
	var sb strings.Builder
	if title != "" {
		sb.WriteString("*")
		sb.WriteString(title)
		sb.WriteString("*\n\n")
	}
	sb.WriteString(description)
	sb.WriteString("\n\n")
	if footer != "" {
		sb.WriteString("_")
		sb.WriteString(footer)
		sb.WriteString("_\n\n")
	}
	for _, btn := range buttons {
		sb.WriteString(fmt.Sprintf("[%s]\n", btn["displayText"]))
	}
	return c.SendMessage(to, sb.String())
}

func (c *Client) SendVoice(to, base64Audio string, isPtt bool) error {
	reqURL := fmt.Sprintf("%s/api/%s/send-file-base64", c.config.URL, c.config.Session)
	recipient := to
	if !strings.Contains(recipient, "@") {
		recipient = recipient + "@lid"
	}
	payload := map[string]interface{}{
		"phone":      recipient,
		"base64":     base64Audio,
		"filename":   "ManejoORG_Resposta.mp3",
		"isGroup":    false,
		"isDocument": true,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, bodyBytes)
	return err
}

func (c *Client) SendReply(to, message, replyToMessageId string) error {
	reqURL := fmt.Sprintf("%s/api/%s/send-message", c.config.URL, c.config.Session)
	payload := map[string]interface{}{
		"phone":     to,
		"message":   utils.SanitizeForWhatsApp(message),
		"isGroup":   false,
		"messageId": replyToMessageId,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, bodyBytes)
	return err
}

func (c *Client) DownloadAudio(messageId string, rawPayload []byte) ([]byte, error) {
	data, _, err := c.downloadMedia(messageId)
	return data, err
}

func (c *Client) DownloadImage(messageId string, rawPayload []byte) ([]byte, string, error) {
	return c.downloadMedia(messageId)
}

// Internal Helpers

func (c *Client) CheckConnection() (bool, map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/api/%s/check-connection-session", c.config.URL, c.config.Session)
	shortClient := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return false, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.config.Token)
	resp, err := shortClient.Do(req)
	if err != nil {
		return false, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, nil, err
	}
	if resp.StatusCode >= 400 {
		return false, nil, fmt.Errorf("wppconnect server error (%d): %s", resp.StatusCode, string(body))
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return false, nil, err
	}
	status, _ := result["status"].(bool)
	return status, result, nil
}

func (c *Client) downloadMedia(messageId string) ([]byte, string, error) {
	reqURL := fmt.Sprintf("%s/api/%s/get-media-by-message/%s", c.config.URL, c.config.Session, messageId)
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.config.Token)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode >= 400 {
		return nil, "", fmt.Errorf("wppconnect server error downloading media (%d): %s", resp.StatusCode, string(body))
	}
	var rawData interface{}
	if err = json.Unmarshal(body, &rawData); err != nil {
		return nil, "", fmt.Errorf("failed to decode media JSON: %w", err)
	}
	b64String := ""
	mimetype := ""
	if m, ok := rawData.(map[string]interface{}); ok {
		if b, exists := m["base64"]; exists {
			b64String = b.(string)
		} else if b, exists := m["raw"]; exists {
			b64String = b.(string)
		}
		if mt, exists := m["mimetype"]; exists {
			mimetype = mt.(string)
		}
	} else if s, ok := rawData.(string); ok {
		b64String = s
	}
	if b64String == "" {
		return nil, "", fmt.Errorf("could not extract base64 from response")
	}
	if strings.Contains(b64String, "base64,") {
		parts := strings.SplitN(b64String, "base64,", 2)
		if len(parts) == 2 {
			if mimetype == "" && strings.Contains(parts[0], "data:") {
				header := parts[0]
				start := strings.Index(header, "data:") + 5
				end := strings.Index(header, ";")
				if start > 4 && end > start {
					mimetype = header[start:end]
				}
			}
			b64String = parts[1]
		}
	}
	data, err := base64.StdEncoding.DecodeString(b64String)
	return data, mimetype, err
}

func (c *Client) doRequest(method, url string, payload []byte) ([]byte, error) {
	if os.Getenv("MOCK_WHATSAPP") == "true" {
		if !strings.Contains(url, "benchmark-runner") && !strings.Contains(url, "localhost:3333") {
			return []byte(`{"status":"success","message":"Mocked success"}`), nil
		}
	}
	var bodyReader io.Reader
	if payload != nil {
		bodyReader = bytes.NewReader(payload)
	}
	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.config.Token)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("wppconnect server error (%d): %s", resp.StatusCode, string(body))
	}
	return body, nil
}

// Webhook handling

// ParseWebhook converts a raw WPPConnect JSON payload into a normalized ports.IncomingMessage
func ParseWebhook(rawBody []byte) (ports.IncomingMessage, error) {
	var payload WPPMessage
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return ports.IncomingMessage{}, err
	}

	timestamp := time.Now()
	if payload.Timestamp != nil {
		ts := *payload.Timestamp
		if ts > 100_000_000_000 {
			ts /= 1000.0
		}
		timestamp = time.Unix(int64(ts), 0)
	}

	if payload.MimeType != nil {
		// mime = *payload.MimeType // unused for now
	}

	return ports.IncomingMessage{
		ID:                      payload.MessageID(),
		From:                    payload.From,
		Body:                    payload.Body,
		Type:                    payload.Type,
		IsAudio:                 payload.IsAudio(),
		RespondWithAudio:        payload.IsAudio(),
		HasExplicitResponseMode: true,
		IsImage:                 payload.IsImage(),
		IsFromMe:                payload.FromMe,
		Timestamp:               timestamp,
	}, nil
}

type WPPMessage struct {
	Event     string      `json:"event"`
	From      string      `json:"from"`
	FromMe    bool        `json:"fromMe"`
	ID        interface{} `json:"id"`
	Type      string      `json:"type"`
	Body      string      `json:"body"`
	ChatID    interface{} `json:"chatId"`
	Timestamp *float64    `json:"timestamp"`
	MimeType  *string     `json:"mimetype,omitempty"`
}

func (m *WPPMessage) MessageID() string {
	switch v := m.ID.(type) {
	case string:
		return v
	case map[string]interface{}:
		if s, ok := v["_serialized"].(string); ok {
			return s
		}
		if s, ok := v["id"].(string); ok {
			return s
		}
	}
	return ""
}

func (m *WPPMessage) IsAudio() bool {
	if m.Type == "ptt" || m.Type == "audio" {
		return true
	}
	if m.MimeType != nil {
		return strings.Contains(strings.ToLower(*m.MimeType), "audio")
	}
	return false
}

func (m *WPPMessage) IsImage() bool {
	if m.Type == "image" {
		return true
	}
	if m.MimeType != nil {
		return strings.Contains(strings.ToLower(*m.MimeType), "image")
	}
	return false
}

func (m *WPPMessage) IsBroadcast() bool {
	from := m.From
	if len(from) >= 16 && from[len(from)-10:] == "@broadcast" {
		return true
	}
	return from == "status@broadcast"
}

func (m *WPPMessage) ShouldProcess() bool {
	event := strings.ToLower(m.Event)
	if m.FromMe {
		return false
	}
	return event == "onmessage" || event == "on-message"
}
