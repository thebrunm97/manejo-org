package supabase

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// CheckAndRegisterWebhook checks if a webhook event ID was already processed.
// Returns (true, nil) if it was already processed (duplicate).
// Returns (false, nil) if it was successfully registered (new event).
func (c *Client) CheckAndRegisterWebhook(eventID string) (bool, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/processed_webhooks", c.config.URL)
	payload := map[string]string{
		"event_id": eventID,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		return false, err
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict || resp.StatusCode == 409 {
		return true, nil
	}

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("processed_webhooks insert error (%d): %s", resp.StatusCode, string(respBody))
	}

	return false, nil
}
