package whatsapp

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// WppMediaResponse represents the JSON returned by GET /get-media-by-message/:id
type WppMediaResponse struct {
	Mimetype string `json:"mimetype"`
	Base64   string `json:"base64"` // Could be nested in .data
}

// DownloadAudio queries the WPPConnect server for the raw base64 of an audio message
func (c *Client) DownloadAudio(messageId string) ([]byte, error) {
	data, _, err := c.downloadMedia(messageId)
	return data, err
}

// DownloadImage queries the WPPConnect server for the raw base64 of an image message
func (c *Client) DownloadImage(messageId string) ([]byte, string, error) {
	return c.downloadMedia(messageId)
}

// downloadMedia is the internal helper for all media types
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
	if err := json.Unmarshal(body, &rawData); err != nil {
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

	// Remove base64 header (e.g., "data:image/jpeg;base64,")
	if strings.Contains(b64String, "base64,") {
		parts := strings.SplitN(b64String, "base64,", 2)
		if len(parts) == 2 {
			// Extract mimetype if header exists and we don't have it yet
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
