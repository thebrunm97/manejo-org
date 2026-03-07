package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
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
		secretKey: cfg.Token, // cfg.Token initally holds the SECRET_KEY from env
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
		// We only care about errors (API unreachable or 401/404), not the connected boolean.
		// If connected is false but err is nil, it means WPPConnect API is working,
		// but the phone is disconnected. We don't need a new JWT token in that case.
		_, _, err := c.CheckConnection()

		if err != nil || c.config.Token == c.secretKey || c.config.Token == "" {
			token, genErr := c.generateToken(c.secretKey)
			if genErr == nil && token != "" {
				c.config.Token = token
				log.Println("✅ [WPP] Cliente WhatsApp reconectado (Novo Token JWT) com sucesso!")

				// 🚀 Proactively start session after token refresh
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

// StartSession initiates the WPPConnect session for the configured session name.
// It injects the webhook URL automatically as part of the startup payload.
func (c *Client) StartSession(ctx context.Context) error {
	reqURL := fmt.Sprintf("%s/api/%s/start-session", c.config.URL, c.config.Session)

	// Inject the webhook URL targeting the Go bot's handler
	webhookURL := os.Getenv("WEBHOOK_URL")
	if webhookURL == "" {
		webhookURL = "http://pmo-bot-go:8080/webhook/wppconnect"
	}

	// Append security token if present
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

	log.Printf("🚀 [WPP] Enviando comando start-session para %s (webhook: %s)...", c.config.Session, webhookURL)

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

	// Idempotency: 200/201 is success.
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("ℹ️ [WPP] Resposta do start-session (%d): %s", resp.StatusCode, string(body))

		// If it's a 400, it's likely already active or logged in, so we consider it "OK enough" to continue
		if resp.StatusCode == http.StatusBadRequest {
			return nil
		}
		return fmt.Errorf("start-session fail (HTTP %d): %s", resp.StatusCode, string(body))
	}

	log.Printf("✅ [WPP] Sessão iniciada com webhook: %s", webhookURL)
	return nil
}

// SendMessageRequest represents the payload to send a text message
type SendMessageRequest struct {
	Phone   string `json:"phone"`
	Message string `json:"message"`
	IsGroup bool   `json:"isGroup"`
}

// SendMessage sends a standard text message
func (c *Client) SendMessage(to, message string) error {
	reqURL := fmt.Sprintf("%s/api/%s/send-message", c.config.URL, c.config.Session)

	payload := SendMessageRequest{
		Phone:   to,
		Message: message,
		IsGroup: false,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	log.Printf("📤 [WPP] Enviando Mensagem para %s", to)
	_, err = c.doRequest(http.MethodPost, reqURL, bodyBytes)
	return err
}

// SendFileRequest represents the payload to send any file in base64
type SendFileRequest struct {
	Phone      string `json:"phone"`
	Base64     string `json:"base64"`
	Filename   string `json:"filename"`
	IsGroup    bool   `json:"isGroup"`
	IsDocument bool   `json:"isDocument"`
}

// SendVoice sends an audio or voice message (Base64) to a phone as a standard audio file.
// It uses the stable /send-file-base64 endpoint without PTT flags for maximum stability.
func (c *Client) SendVoice(to, base64Audio string, isPtt bool) error {
	reqURL := fmt.Sprintf("%s/api/%s/send-file-base64", c.config.URL, c.config.Session)

	recipient := to
	if !strings.Contains(recipient, "@") {
		recipient = recipient + "@lid"
	}

	payload := SendFileRequest{
		Phone:      recipient,
		Base64:     base64Audio,
		Filename:   "ManejoORG_Resposta.mp3",
		IsGroup:    false,
		IsDocument: true,
	}

	log.Printf("📤 [WPP] Enviando Arquivo de Audio para %s (Base64 len: %d)", recipient, len(base64Audio))
	if len(base64Audio) > 50 {
		log.Printf("📤 [WPP] Prefixo Base64: %s...", base64Audio[:50])
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = c.doRequest(http.MethodPost, reqURL, bodyBytes)
	return err
}

// SendReply sends a text message as a reply to a specific message ID
func (c *Client) SendReply(to, message, replyToMessageId string) error {
	reqURL := fmt.Sprintf("%s/api/%s/send-message", c.config.URL, c.config.Session)

	payload := map[string]interface{}{
		"phone":     to,
		"message":   message,
		"isGroup":   false,
		"messageId": replyToMessageId, // Used by WPPConnect to associate the reply
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = c.doRequest(http.MethodPost, reqURL, bodyBytes)
	return err
}

// RenderVoiceText formats a text message to look like a premium transcription card.
func RenderVoiceText(text string) string {
	return fmt.Sprintf("🗣️ *Voz da Ana (Transcrição)*\n────────────────────\n╰─➤ %s", text)
}

// CheckConnection checks the WPPConnect session status.
// Returns (connected bool, details map, error).
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

	// WPPConnect returns {"status": true, "message": "Connected"} when OK
	status, _ := result["status"].(bool)
	return status, result, nil
}

// doRequest handles the raw HTTP request to the WPPConnect server
func (c *Client) doRequest(method, url string, payload []byte) ([]byte, error) {
	var bodyReader io.Reader
	if payload != nil {
		bodyReader = bytes.NewReader(payload)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	// WPPConnect uses Bearer token authentication
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
