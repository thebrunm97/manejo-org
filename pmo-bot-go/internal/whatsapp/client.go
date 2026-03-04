package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
