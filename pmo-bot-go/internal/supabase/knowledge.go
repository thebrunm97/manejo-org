// Package knowledge provides the Supabase DTO types and persistence methods
// used by the Knowledge Ops Panel (knowledge/handler.go).
// These types extend the existing supabase.Client without modifying client.go.
package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// ─── Domain types ─────────────────────────────────────────────────────────────

// KnowledgeDocument represents a raw knowledge artifact (PDF or Markdown file).
type KnowledgeDocument struct {
	ID                   string                 `json:"id,omitempty"`
	Title                string                 `json:"title"`
	SourceType           string                 `json:"source_type"`
	StoragePath          string                 `json:"storage_path,omitempty"`
	MimeType             string                 `json:"mime_type,omitempty"`
	Metadata             map[string]interface{} `json:"metadata,omitempty"`
	CurrentLiveVersionID *string                `json:"current_live_version_id,omitempty"`
	CreatedBy            *string                `json:"created_by,omitempty"`
	CreatedAt            *time.Time             `json:"created_at,omitempty"`
}

// KnowledgeIngestionJob represents a single entry in the async processing queue.
type KnowledgeIngestionJob struct {
	ID           string     `json:"id,omitempty"`
	DocumentID   string     `json:"document_id"`
	VersionID    *string    `json:"version_id,omitempty"`
	Status       string     `json:"status"`
	Step         *string    `json:"step,omitempty"`
	ProgressPct  int        `json:"progress_pct,omitempty"`
	AttemptCount int        `json:"attempt_count,omitempty"`
	ErrorLog     *string    `json:"error_log,omitempty"`
	WorkerID     *string    `json:"worker_id,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
	CreatedAt    *time.Time  `json:"created_at,omitempty"`
}

// KnowledgeVersion represents a publishable revision of a document.
type KnowledgeVersion struct {
	ID                  string     `json:"id,omitempty"`
	DocumentID          string     `json:"document_id"`
	Content             string     `json:"content,omitempty"`
	ContentFormat       string     `json:"content_format,omitempty"`
	VersionNumber       int        `json:"version_number,omitempty"`
	Status              string     `json:"status"`
	SupersedesVersionID *string    `json:"supersedes_version_id,omitempty"`
	CreatedBy           *string    `json:"created_by,omitempty"`
	ApprovedBy          *string    `json:"approved_by,omitempty"`
	PublishedBy         *string    `json:"published_by,omitempty"`
	CreatedAt           *time.Time `json:"created_at,omitempty"`
	ApprovedAt          *time.Time `json:"approved_at,omitempty"`
	PublishedAt         *time.Time `json:"published_at,omitempty"`
}

// RagExperiment represents a RAG benchmark experiment snapshot.
type RagExperiment struct {
	ID                      string          `json:"id,omitempty"`
	QueryText               string          `json:"query_text"`
	QueryNormalized         string          `json:"query_normalized,omitempty"`
	PmoID                   int64           `json:"pmo_id"`
	RetrievalStrategy       string          `json:"retrieval_strategy"`
	RetrievalVersion        string          `json:"retrieval_version,omitempty"`
	TopK                    int             `json:"top_k"`
	RetrievedChunksSnapshot json.RawMessage `json:"retrieved_chunks_snapshot"`
}

// RagExperimentRun encapsulates a single run of a query against a specific model within an experiment.
type RagExperimentRun struct {
	ID                string         `json:"id"`
	RagExperimentID   string         `json:"experiment_id"`
	RequestedModel         string                    `json:"requested_model_name"`
	ActualModelUsed        string                    `json:"actual_model_used,omitempty"`
	ProviderName           string                    `json:"provider_name,omitempty"`
	InputTokens            int                       `json:"tokens_used_prompt"`
	OutputTokens           int                       `json:"tokens_used_completion"`
	TotalTokens            int                       `json:"-"` // not in db
	DurationMs             int                       `json:"latency_ms"`
	Status                 string                    `json:"status"`
	ErrorMessage           string                    `json:"error_type,omitempty"`
	ResponseText           string                    `json:"response_text,omitempty"`
	TokensCacheRead        int                       `json:"tokens_cache_read,omitempty"`
	TokensCacheWrite       int                       `json:"tokens_cache_write,omitempty"`
	ExactCostUSD           float64                   `json:"exact_cost_usd,omitempty"`
	OpenRouterGenerationID string                    `json:"openrouter_generation_id,omitempty"`
	CreatedAt              time.Time                 `json:"created_at"`
	Evaluations            []RagExperimentEvaluation `json:"-"` // nested relation, not for insert
}

// RagArenaModel represents a configured model for the RAG Playground.
type RagArenaModel struct {
	ID                        string    `json:"id"`
	ModelID                   string    `json:"model_id"`
	FallbackModels            []string  `json:"fallback_models,omitempty"`
	ProviderName              string    `json:"provider_name"`
	Label                     string    `json:"label"`
	Temperature               float64   `json:"temperature"`
	IsActive                  bool      `json:"is_active"`
	IsDefault                 bool      `json:"is_default"`
	SortOrder                 int       `json:"sort_order"`
	SupportsTools             bool      `json:"supports_tools"`
	SupportsStructuredOutputs bool      `json:"supports_structured_outputs"`
	ContextLength             int       `json:"context_length"`
	PromptPrice               float64   `json:"prompt_price"`
	CompletionPrice           float64   `json:"completion_price"`
	LastSyncedAt              *time.Time `json:"last_synced_at,omitempty"`
	Notes                     string    `json:"notes,omitempty"`
	CreatedAt                 string    `json:"created_at"`
}

// ─── Persistence Methods ───────────────────────────────────────────────────────

// InsertKnowledgeDocument persists a new document record.
func (c *Client) InsertKnowledgeDocument(ctx context.Context, doc KnowledgeDocument) error {
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("marshal document: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/knowledge_documents", bytes.NewReader(body))
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
		return fmt.Errorf("supabase insert document: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// InsertIngestionJob enqueues a new ingestion job.
func (c *Client) InsertIngestionJob(ctx context.Context, job KnowledgeIngestionJob) error {
	body, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("marshal job: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/ingestion_jobs", bytes.NewReader(body))
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
		return fmt.Errorf("supabase insert job: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// GetIngestionJob fetches a single ingestion job by ID.
func (c *Client) GetIngestionJob(ctx context.Context, jobID string) (*KnowledgeIngestionJob, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/ingestion_jobs?id=eq."+jobID+"&limit=1", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase get job: status %d — %s", resp.StatusCode, string(b))
	}

	var jobs []KnowledgeIngestionJob
	if err := json.NewDecoder(resp.Body).Decode(&jobs); err != nil {
		return nil, fmt.Errorf("decode jobs: %w", err)
	}
	if len(jobs) == 0 {
		return nil, fmt.Errorf("job not found: %s", jobID)
	}
	return &jobs[0], nil
}

// ListKnowledgeDocuments returns all documents with their latest ingestion job status.
func (c *Client) ListKnowledgeDocuments(ctx context.Context) ([]KnowledgeDocument, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/knowledge_documents?order=created_at.desc", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase list documents: status %d — %s", resp.StatusCode, string(b))
	}

	var docs []KnowledgeDocument
	if err := json.NewDecoder(resp.Body).Decode(&docs); err != nil {
		return nil, fmt.Errorf("decode documents: %w", err)
	}
	return docs, nil
}

// GetActiveArenaModels returns all currently active models for the RAG Arena.
func (c *Client) GetActiveArenaModels(ctx context.Context) ([]RagArenaModel, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/rag_arena_models?is_active=eq.true&order=sort_order.asc", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase list rag_arena_models: status %d — %s", resp.StatusCode, string(b))
	}

	var models []RagArenaModel
	if err := json.NewDecoder(resp.Body).Decode(&models); err != nil {
		return nil, fmt.Errorf("decode rag_arena_models response: %w", err)
	}

	return models, nil
}

// UpsertArenaModels bulk updates/inserts RAG models using the upsert_arena_models RPC.
func (c *Client) UpsertArenaModels(ctx context.Context, models []RagArenaModel) error {
	body, err := json.Marshal(map[string]interface{}{"p_models": models})
	if err != nil {
		return fmt.Errorf("marshal models for upsert: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/rpc/upsert_arena_models", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase upsert arena models: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// GetArenaModelByID fetches a specific model by its model_id (e.g. 'openai/gpt-4o-mini')
func (c *Client) GetArenaModelByID(ctx context.Context, modelID string) (*RagArenaModel, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/rag_arena_models?model_id=eq."+url.QueryEscape(modelID)+"&limit=1", nil)
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
		return nil, fmt.Errorf("supabase get arena model: status %d — %s", resp.StatusCode, string(b))
	}

	var models []RagArenaModel
	if err := json.NewDecoder(resp.Body).Decode(&models); err != nil {
		return nil, fmt.Errorf("decode rag_arena_models response: %w", err)
	}

	if len(models) == 0 {
		return nil, fmt.Errorf("arena model not found: %s", modelID)
	}

	return &models[0], nil
}

// GetKnowledgeDocumentByTitle fetches a single document by its exact title.
// Returns nil if no document is found.
func (c *Client) GetKnowledgeDocumentByTitle(ctx context.Context, title string) (*KnowledgeDocument, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/knowledge_documents?title=eq."+url.QueryEscape(title)+"&limit=1", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase get document by title: status %d — %s", resp.StatusCode, string(b))
	}

	var docs []KnowledgeDocument
	if err := json.NewDecoder(resp.Body).Decode(&docs); err != nil {
		return nil, fmt.Errorf("decode documents: %w", err)
	}
	if len(docs) == 0 {
		return nil, nil // Not found
	}
	return &docs[0], nil
}

// TransitionKnowledgeVersionStatus updates the status field of a knowledge_version.
func (c *Client) TransitionKnowledgeVersionStatus(ctx context.Context, versionID, targetStatus string) error {
	body, err := json.Marshal(map[string]string{"status": targetStatus})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		c.config.URL+"/rest/v1/knowledge_versions?id=eq."+versionID, bytes.NewReader(body))
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
		return fmt.Errorf("supabase transition version: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// PublishKnowledgeVersion atomically:
//  1. Archives the current live version for this document.
//  2. Moves the target version to 'live'.
//  3. Updates knowledge_documents.current_live_version_id.
//
// Uses a Supabase RPC to ensure atomicity. The RPC is defined in migrations.
func (c *Client) PublishKnowledgeVersion(ctx context.Context, versionID string) error {
	body, err := json.Marshal(map[string]string{"p_version_id": versionID})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/rpc/publish_knowledge_version", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase publish version: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// DeleteKnowledgeDocument deletes a document and implicitly cascades to versions/chunks/jobs if configured in DB.
func (c *Client) DeleteKnowledgeDocument(ctx context.Context, id string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete,
		c.config.URL+"/rest/v1/knowledge_documents?id=eq."+id, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase delete document: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

type RagExperimentEvaluation struct {
	ID                     string          `json:"id,omitempty"`
	RunID                  string          `json:"run_id"`
	Status                 string          `json:"status"`
	JudgeModelID           string          `json:"judge_model_id,omitempty"`
	JudgePromptVersion     string          `json:"judge_prompt_version,omitempty"`
	JudgeSchemaVersion     string          `json:"judge_schema_version,omitempty"`
	FaithfulnessScore      *float64        `json:"faithfulness_score,omitempty"`
	AnswerRelevanceScore   *float64        `json:"answer_relevance_score,omitempty"`
	ContextRelevanceScore  *float64        `json:"context_relevance_score,omitempty"`
	ConfidenceScore        *float64        `json:"confidence_score,omitempty"`
	Verdict                *string         `json:"verdict,omitempty"`
	ReasoningShort         *string         `json:"reasoning_short,omitempty"`
	UnsupportedClaims      json.RawMessage `json:"unsupported_claims,omitempty"`
	MissingPoints          json.RawMessage `json:"missing_points,omitempty"`
	ErrorMessage           *string         `json:"error_message,omitempty"`
	CreatedAt              time.Time       `json:"created_at,omitempty"`
	UpdatedAt              *time.Time      `json:"updated_at,omitempty"`
	EvaluatedAt            *time.Time      `json:"evaluated_at,omitempty"`
}

// InsertRagExperiment persists a new RAG experiment snapshot.
func (c *Client) InsertRagExperiment(ctx context.Context, row RagExperiment) error {
	body, err := json.Marshal(row)
	if err != nil {
		return fmt.Errorf("marshal exp: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/rag_experiments", bytes.NewReader(body))
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
		return fmt.Errorf("supabase insert rag_experiment: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

func (c *Client) InsertRagExperimentRun(ctx context.Context, run RagExperimentRun) error {
	body, err := json.Marshal(run)
	if err != nil {
		return fmt.Errorf("marshal run: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/rag_experiment_runs", bytes.NewReader(body))
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
		return fmt.Errorf("supabase insert rag_experiment_run: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// UpdateExperimentRunTelemetry updates a run with async telemetry data from OpenRouter.
func (c *Client) UpdateExperimentRunTelemetry(ctx context.Context, runID string, cacheRead, cacheWrite int, exactCost float64, generationID string) error {
	updates := map[string]interface{}{
		"tokens_cache_read":        cacheRead,
		"tokens_cache_write":       cacheWrite,
		"exact_cost_usd":           exactCost,
		"openrouter_generation_id": generationID,
	}
	body, err := json.Marshal(updates)
	if err != nil {
		return fmt.Errorf("marshal telemetry updates: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		c.config.URL+"/rest/v1/rag_experiment_runs?id=eq."+runID, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase patch rag_experiment_run telemetry: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// GetRagExperimentRun fetches a single run by ID.
func (c *Client) GetRagExperimentRun(ctx context.Context, id string) (*RagExperimentRun, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/rag_experiment_runs?id=eq."+id+"&limit=1", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Accept", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase get run: status %d — %s", resp.StatusCode, string(b))
	}
	var runs []RagExperimentRun
	if err := json.NewDecoder(resp.Body).Decode(&runs); err != nil {
		return nil, fmt.Errorf("decode run: %w", err)
	}
	if len(runs) == 0 {
		return nil, fmt.Errorf("run not found")
	}
	return &runs[0], nil
}

// GetRagExperiment fetches a single experiment by ID.
func (c *Client) GetRagExperiment(ctx context.Context, id string) (*RagExperiment, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/rag_experiments?id=eq."+id+"&limit=1", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Accept", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase get experiment: status %d — %s", resp.StatusCode, string(b))
	}
	var exps []RagExperiment
	if err := json.NewDecoder(resp.Body).Decode(&exps); err != nil {
		return nil, fmt.Errorf("decode experiment: %w", err)
	}
	if len(exps) == 0 {
		return nil, fmt.Errorf("experiment not found")
	}
	return &exps[0], nil
}

// InsertRagExperimentEvaluation persists a RAG evaluation.
func (c *Client) InsertRagExperimentEvaluation(ctx context.Context, row RagExperimentEvaluation) (*RagExperimentEvaluation, error) {
	body, err := json.Marshal(row)
	if err != nil {
		return nil, fmt.Errorf("marshal evaluation: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/rag_experiment_evaluations", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=representation")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase insert evaluation: status %d — %s", resp.StatusCode, string(b))
	}
	var out []RagExperimentEvaluation
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no evaluation returned")
	}
	return &out[0], nil
}

// UpdateRagExperimentEvaluation updates an evaluation by ID.
func (c *Client) UpdateRagExperimentEvaluation(ctx context.Context, evalID string, updates map[string]any) error {
	body, err := json.Marshal(updates)
	if err != nil {
		return fmt.Errorf("marshal updates: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		c.config.URL+"/rest/v1/rag_experiment_evaluations?id=eq."+evalID, bytes.NewReader(body))
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
		return fmt.Errorf("supabase update evaluation: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// GetPendingRagExperimentEvaluations fetches pending evaluations.
func (c *Client) GetPendingRagExperimentEvaluations(ctx context.Context, limit int) ([]RagExperimentEvaluation, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/rag_experiment_evaluations?status=eq.pending&order=created_at.asc&limit="+fmt.Sprintf("%d", limit), nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Accept", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase get pending evaluations: status %d — %s", resp.StatusCode, string(b))
	}
	var evals []RagExperimentEvaluation
	if err := json.NewDecoder(resp.Body).Decode(&evals); err != nil {
		return nil, fmt.Errorf("decode evals: %w", err)
	}
	return evals, nil
}

// setHeaders is a convenience method to apply standard Supabase auth headers.
func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
}
