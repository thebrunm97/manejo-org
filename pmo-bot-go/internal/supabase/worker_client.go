// worker_client.go extends supabase.Client with the methods required by the
// knowledge worker pool (polling, locking, progress updates, storage download).
package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ClaimNextIngestionJob atomically claims a pending job using an RPC that wraps
// SELECT ... FOR UPDATE SKIP LOCKED, ensuring only one worker processes each job.
// Returns nil, nil when there are no pending jobs.
func (c *Client) ClaimNextIngestionJob(ctx context.Context, workerID string) (*KnowledgeIngestionJob, error) {
	body, err := json.Marshal(map[string]string{"p_worker_id": workerID})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/rpc/claim_next_ingestion_job", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil // no job available
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claim job rpc: status %d — %s", resp.StatusCode, string(b))
	}

	var jobs []KnowledgeIngestionJob
	if err := json.NewDecoder(resp.Body).Decode(&jobs); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if len(jobs) == 0 {
		return nil, nil
	}
	return &jobs[0], nil
}

// UpdateIngestionJobStatus updates the status, step, progress and error of a job.
func (c *Client) UpdateIngestionJobStatus(ctx context.Context, jobID, status string, errMsg *string, pct *int, workerID string) error {
	now := time.Now()
	payload := map[string]interface{}{
		"status":    status,
		"worker_id": workerID,
	}
	if pct != nil {
		payload["progress_pct"] = *pct
	}
	if errMsg != nil {
		payload["error_log"] = *errMsg
	}
	if status == "extracting" {
		payload["started_at"] = now
	}
	if status == "indexed" || status == "failed" {
		payload["finished_at"] = now
	}
	if status != "pending" {
		payload["step"] = status
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		c.config.URL+"/rest/v1/ingestion_jobs?id=eq."+jobID, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update job status: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// UpdateIngestionJobVersionID links a version to an ingestion job after creation.
func (c *Client) UpdateIngestionJobVersionID(ctx context.Context, jobID, versionID string) error {
	body, err := json.Marshal(map[string]string{"version_id": versionID})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		c.config.URL+"/rest/v1/ingestion_jobs?id=eq."+jobID, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update job version_id: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// InsertKnowledgeVersion persists a new version record.
func (c *Client) InsertKnowledgeVersion(ctx context.Context, v KnowledgeVersion) error {
	body, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal version: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/knowledge_versions", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert version: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// GetKnowledgeDocumentByID fetches a single document by primary key.
func (c *Client) GetKnowledgeDocumentByID(ctx context.Context, docID string) (*KnowledgeDocument, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/knowledge_documents?id=eq."+docID+"&limit=1", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get document: status %d — %s", resp.StatusCode, string(b))
	}

	var docs []KnowledgeDocument
	if err := json.NewDecoder(resp.Body).Decode(&docs); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if len(docs) == 0 {
		return nil, fmt.Errorf("document not found: %s", docID)
	}
	return &docs[0], nil
}

// DownloadStorageFile downloads a file from a Supabase Storage bucket.
func (c *Client) DownloadStorageFile(ctx context.Context, bucket, path string) ([]byte, error) {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.config.URL, bucket, path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("storage download: status %d — %s", resp.StatusCode, string(b))
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	return data, nil
}
