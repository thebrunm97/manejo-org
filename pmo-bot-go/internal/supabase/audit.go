package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

// ErrDuplicateMessage is returned when a message_id already exists in the raw_payloads table
var ErrDuplicateMessage = errors.New("duplicate message_id in raw_payloads")

// InsertRawPayload persists the raw incoming webhook payload.
// Returns the generated raw payload UUID or ErrDuplicateMessage if already exists.
func (c *Client) InsertRawPayload(ctx context.Context, messageID string, rawPayload []byte, source string) (string, error) {
	if messageID == "" {
		return "", errors.New("messageID cannot be empty")
	}

	reqURL := fmt.Sprintf("%s/rest/v1/raw_payloads", c.config.URL)
	record := map[string]interface{}{
		"message_id":        messageID,
		"payload_data":      json.RawMessage(rawPayload),
		"source":            source,
		"processing_status": "PENDING",
	}

	payloadBytes, err := json.Marshal(record)
	if err != nil {
		return "", fmt.Errorf("InsertRawPayload marshal error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return "", fmt.Errorf("InsertRawPayload request error: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation") // Returns inserted row including generated id

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("InsertRawPayload HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("InsertRawPayload read response failed: %w", err)
	}

	// 409 Conflict indicates uniqueness constraint violation (duplicate webhook)
	if resp.StatusCode == http.StatusConflict || resp.StatusCode == 409 {
		return "", ErrDuplicateMessage
	}

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("InsertRawPayload Supabase error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	var results []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(bodyBytes, &results); err != nil {
		return "", fmt.Errorf("InsertRawPayload failed to unmarshal response: %w. Body: %s", err, string(bodyBytes))
	}

	if len(results) == 0 {
		return "", fmt.Errorf("InsertRawPayload empty results returned from Supabase")
	}

	return results[0].ID, nil
}

// UpdateRawPayloadStatus updates the processing status and optional error message of a raw payload.
func (c *Client) UpdateRawPayloadStatus(ctx context.Context, rawPayloadID string, status string, errMsg string) error {
	if rawPayloadID == "" {
		return errors.New("rawPayloadID cannot be empty")
	}

	reqURL := fmt.Sprintf("%s/rest/v1/raw_payloads?id=eq.%s", c.config.URL, rawPayloadID)
	updateData := map[string]interface{}{
		"processing_status": status,
	}
	if errMsg != "" {
		updateData["processing_error"] = errMsg
	} else {
		updateData["processing_error"] = nil
	}

	payloadBytes, err := json.Marshal(updateData)
	if err != nil {
		return fmt.Errorf("UpdateRawPayloadStatus marshal error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, reqURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("UpdateRawPayloadStatus request error: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("UpdateRawPayloadStatus HTTP PATCH request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("UpdateRawPayloadStatus Supabase error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}
