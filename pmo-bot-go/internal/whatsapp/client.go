package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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
	httpClient *http.Client
}

// NewClient initializes the WhatsApp client
func NewClient(cfg Config) (*Client, error) {
	if cfg.URL == "" || cfg.Token == "" || cfg.Session == "" {
		return nil, fmt.Errorf("WPPCONNECT_URL, WPPCONNECT_TOKEN, or WPP_SESSION are missing")
	}

	c := &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}

	// WPPCONNECT_TOKEN in .env is actually the SECRET_KEY
	// We need to generate a valid JWT token before making requests
	token, err := c.generateToken(cfg.Token)
	if err != nil {
		return nil, fmt.Errorf("failed to generate WPPConnect JWT token: %v", err)
	}

	c.config.Token = token // Replace SecretKey with actual JWT Token
	return c, nil
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
