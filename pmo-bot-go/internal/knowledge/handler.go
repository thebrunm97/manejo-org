// Package knowledge implements the admin HTTP handlers for the Knowledge Ops Panel.
// It exposes endpoints for document ingestion (async via job queue) and version
// state transitions (draft -> approved -> live -> archived).
//
// All write operations expect the caller to be authenticated with a JWT containing
// a knowledge_role custom claim. The Supabase client uses the service role key,
// so RLS is bypassed server-side; the role check is enforced here in middleware.
package knowledge

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"golang.org/x/sync/errgroup"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

// Handler holds the dependencies for all knowledge admin endpoints.
type Handler struct {
	sb            *supabase.Client
	openRouterKey string
	groqKey       string
}

// NewHandler creates a new knowledge admin handler.
func NewHandler(sb *supabase.Client, openRouterKey, groqKey string) *Handler {
	return &Handler{sb: sb, openRouterKey: openRouterKey, groqKey: groqKey}
}

// RegisterRoutes registers the /api/v1/admin/knowledge/* routes on the provided router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/knowledge")
	g.POST("/ingest", h.Ingest)
	g.GET("/jobs/:id", h.GetJob)
	g.GET("/documents", h.ListDocuments)
	g.DELETE("/documents/:id", h.DeleteDocument)
	g.POST("/versions/:id/transition", h.TransitionVersion)
	g.POST("/playground/rag", h.PlaygroundRAG)
	g.POST("/playground/runs/:id/judge", h.ManualJudgeRun)
	g.GET("/playground/models", h.ListArenaModels)
	g.POST("/playground/models/sync", h.SyncOpenRouterModels)
}

// ─── Request / Response DTOs ──────────────────────────────────────────────────

// IngestRequest represents the payload for POST /knowledge/ingest.
type IngestRequest struct {
	Title       string                 `json:"title" binding:"required"`
	SourceType  string                 `json:"source_type" binding:"required,oneof=PDF MARKDOWN"`
	StoragePath string                 `json:"storage_path" binding:"required"`
	MimeType    string                 `json:"mime_type"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// IngestResponse is returned after a successful enqueue.
type IngestResponse struct {
	DocumentID string `json:"document_id"`
	JobID      string `json:"job_id"`
	Status     string `json:"status"`
}

// TransitionRequest represents the payload for POST /versions/:id/transition.
type TransitionRequest struct {
	TargetStatus string `json:"target_status" binding:"required,oneof=approved live archived"`
}

// PlaygroundConfig represents a single LLM configuration to test.
type PlaygroundConfig struct {
	ProviderName   string   `json:"provider_name"`
	ModelName      string   `json:"model_name"`
	FallbackModels []string `json:"fallback_models,omitempty"`
	VariantName    string   `json:"variant_name"`
	Temperature    float32  `json:"temperature"`
	SystemPrompt   string   `json:"system_prompt,omitempty"`
}

// PlaygroundRequest represents the payload for POST /playground/rag.
type PlaygroundRequest struct {
	Query   string             `json:"query" binding:"required"`
	Configs []PlaygroundConfig `json:"configs"` // optional for simple tests
}

// PlaygroundResponse is returned by POST /playground/rag.
type PlaygroundResponse struct {
	ExperimentID string                          `json:"experiment_id"`
	Query        string                          `json:"query"`
	Chunks       []supabase.DocumentMatchContext `json:"chunks"`
	Runs         []supabase.RagExperimentRun     `json:"runs"`
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// Ingest creates a knowledge_document + ingestion_job and returns immediately.
// The actual extraction/chunking/embedding is handled by the Worker Pool (worker.go).
func (h *Handler) Ingest(c *gin.Context) {
	var req IngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	docID := uuid.New().String()
	jobID := uuid.New().String()

	// 1. Check for duplicates
	existingDoc, err := h.sb.GetKnowledgeDocumentByTitle(ctx, req.Title)
	if err != nil {
		log.Printf("[KnowledgeHandler] Failed to check for existing document: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check for duplicates"})
		return
	}
	if existingDoc != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "A document with this title already exists"})
		return
	}

	// 2. Persist the document record
	if err := h.sb.InsertKnowledgeDocument(ctx, supabase.KnowledgeDocument{
		ID:          docID,
		Title:       req.Title,
		SourceType:  req.SourceType,
		StoragePath: req.StoragePath,
		MimeType:    req.MimeType,
		Metadata:    req.Metadata,
	}); err != nil {
		log.Printf("[KnowledgeHandler] Failed to insert document: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create document record"})
		return
	}

	// 3. Enqueue ingestion job (worker picks it up via polling)
	if err := h.sb.InsertIngestionJob(ctx, supabase.KnowledgeIngestionJob{
		ID:         jobID,
		DocumentID: docID,
		Status:     "pending",
	}); err != nil {
		log.Printf("[KnowledgeHandler] Failed to insert ingestion job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue ingestion job"})
		return
	}

	c.JSON(http.StatusAccepted, IngestResponse{
		DocumentID: docID,
		JobID:      jobID,
		Status:     "pending",
	})
}

// ListArenaModels handles GET /knowledge/playground/models
func (h *Handler) ListArenaModels(c *gin.Context) {
	models, err := h.sb.GetActiveArenaModels(c.Request.Context())
	if err != nil {
		log.Printf("[KnowledgeHandler] Failed to list arena models: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get arena models"})
		return
	}
	c.JSON(http.StatusOK, models)
}

// SyncOpenRouterModels handles POST /playground/models/sync
func (h *Handler) SyncOpenRouterModels(c *gin.Context) {
	ctx := c.Request.Context()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://openrouter.ai/api/v1/models", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build request"})
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch openrouter models"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "openrouter api returned error status"})
		return
	}

	var payload struct {
		Data []struct {
			ID                  string   `json:"id"`
			Name                string   `json:"name"`
			ContextLength       int      `json:"context_length"`
			Pricing             struct {
				Prompt     string `json:"prompt"`
				Completion string `json:"completion"`
			} `json:"pricing"`
			SupportedParameters []string `json:"supported_parameters"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse openrouter response"})
		return
	}

	var sbModels []supabase.RagArenaModel
	now := time.Now()

	for _, item := range payload.Data {
		var promptPrice, completionPrice float64
		fmt.Sscanf(item.Pricing.Prompt, "%f", &promptPrice)
		fmt.Sscanf(item.Pricing.Completion, "%f", &completionPrice)

		supportsTools := false
		supportsStructuredOutputs := false

		for _, param := range item.SupportedParameters {
			if param == "tools" {
				supportsTools = true
			}
			// As requested, check for strict schema support parameters rather than just response_format
			if param == "json_schema" || param == "structured_outputs" {
				supportsStructuredOutputs = true
			}
		}

		sbModels = append(sbModels, supabase.RagArenaModel{
			ModelID:                   item.ID,
			ProviderName:              "openrouter",
			Label:                     item.Name,
			SupportsTools:             supportsTools,
			SupportsStructuredOutputs: supportsStructuredOutputs,
			ContextLength:             item.ContextLength,
			PromptPrice:               promptPrice,
			CompletionPrice:           completionPrice,
			LastSyncedAt:              &now,
		})
	}

	if err := h.sb.UpsertArenaModels(ctx, sbModels); err != nil {
		log.Printf("[KnowledgeHandler] Failed to bulk upsert models: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save models in database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Models synced successfully",
		"total_synced": len(sbModels),
	})
}

// GetJob returns the current status of an ingestion job.
func (h *Handler) GetJob(c *gin.Context) {
	jobID := c.Param("id")
	if _, err := uuid.Parse(jobID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid job id"})
		return
	}

	job, err := h.sb.GetIngestionJob(c.Request.Context(), jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

// ListDocuments returns the full document list with their latest job status.
func (h *Handler) ListDocuments(c *gin.Context) {
	docs, err := h.sb.ListKnowledgeDocuments(c.Request.Context())
	if err != nil {
		log.Printf("[KnowledgeHandler] Failed to list documents: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch documents"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"documents": docs, "total": len(docs)})
}

// DeleteDocument deletes a knowledge document by ID.
func (h *Handler) DeleteDocument(c *gin.Context) {
	docID := c.Param("id")
	if _, err := uuid.Parse(docID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}

	if err := h.sb.DeleteKnowledgeDocument(c.Request.Context(), docID); err != nil {
		log.Printf("[KnowledgeHandler] Failed to delete document %s: %v", docID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete document"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Document deleted successfully"})
}

// TransitionVersion moves a knowledge_version through the approval lifecycle.
// Only the publisher role can move to 'live'. When transitioning to 'live',
// it archives the previous live version and updates the document pointer.
func (h *Handler) TransitionVersion(c *gin.Context) {
	versionID := c.Param("id")
	if _, err := uuid.Parse(versionID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid version id"})
		return
	}

	var req TransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	if req.TargetStatus == "live" {
		if err := h.sb.PublishKnowledgeVersion(ctx, versionID); err != nil {
			log.Printf("[KnowledgeHandler] Failed to publish version %s: %v", versionID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("publish failed: %v", err)})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"version_id": versionID,
			"status":     "live",
			"message":    "Version published. Previous live version archived. Hot-reload triggered.",
		})
		return
	}

	// Generic draft -> approved or live -> archived transition
	if err := h.sb.TransitionKnowledgeVersionStatus(ctx, versionID, req.TargetStatus); err != nil {
		log.Printf("[KnowledgeHandler] Transition failed for version %s -> %s: %v", versionID, req.TargetStatus, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transition failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"version_id": versionID, "status": req.TargetStatus})
}

// PlaygroundRAG tests the RAG pipeline by generating an embedding and retrieving chunks
// for the global knowledge base (pmo_id = 0), then runs multiple LLMs concurrently to generate responses.
func (h *Handler) PlaygroundRAG(c *gin.Context) {
	var req PlaygroundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	experimentID := uuid.New().String()
	startTime := time.Now()

	// 1. Generate Query Embedding
	embedding, err := h.sb.GetEmbedding(req.Query, "PRODUCAO")
	if err != nil {
		log.Printf("[Playground] Error generating embedding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate embedding"})
		return
	}

	// 2. Perform Vector Search (using PMO ID 0 for global base)
	// match_threshold: 0.50 (slightly lower for testing), match_count: 10, window_size: 2
	matches, err := h.sb.MatchFarmDocumentsContext(0, embedding, 0.50, 10, 2)
	if err != nil {
		log.Printf("[Playground] Vector search error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "vector search failed"})
		return
	}

	// Convert matches to a raw JSON array for storage
	chunksJSON, _ := json.Marshal(matches)

	// Persist the Retrieval Snapshot
	exp := supabase.RagExperiment{
		ID:                      experimentID,
		QueryText:               req.Query,
		QueryNormalized:         req.Query,
		PmoID:                   0,
		RetrievalStrategy:       "vector_similarity_0.5_top5",
		TopK:                    5,
		RetrievedChunksSnapshot: chunksJSON,
	}
	if err := h.sb.InsertRagExperiment(ctx, exp); err != nil {
		log.Printf("[Playground] Error saving experiment: %v", err)
		// We can still proceed, but it won't be saved in history
	}

	// 3. Concurrently Generate LLM Responses using errgroup
	var runs []supabase.RagExperimentRun

	if len(req.Configs) > 0 {
		runs = make([]supabase.RagExperimentRun, len(req.Configs))

		// Create a semaphore to limit concurrency (e.g. max 5 concurrent requests)
		sem := make(chan struct{}, 5)
		eg, egCtx := errgroup.WithContext(ctx)

		// Build the context string from chunks
		var sbContext strings.Builder
		for i, m := range matches {
			sbContext.WriteString(fmt.Sprintf("--- Excerpt %d (Source: %s) ---\n%s\n\n", i+1, m.DocumentName, m.Content))
		}
		contextText := sbContext.String()

		for i, cfg := range req.Configs {
			i, cfg := i, cfg // capture loop variables
			eg.Go(func() error {
				sem <- struct{}{}
				defer func() { <-sem }()

				runID := uuid.New().String()
				run := supabase.RagExperimentRun{
					ID:              runID,
					RagExperimentID: exp.ID,
					ProviderName:    cfg.ProviderName,
					RequestedModel:  cfg.ModelName,
					Status:          "pending",
				}

				runStartTime := time.Now()

				// Configure provider
				var provider llm.LLMProvider
				var providerErr error

				if cfg.ProviderName == "groq" && h.groqKey != "" {
					config := llm.FactoryConfig{
						ActiveProvider: llm.ProviderGroq,
						GroqAPIKey:     h.groqKey,
						ActiveModel:    cfg.ModelName,
					}
					provider, providerErr = llm.NewOpenAICompatibleProvider(config, llm.PromptConfig{})
				} else if h.openRouterKey != "" {
					config := llm.FactoryConfig{
						ActiveProvider:   llm.ProviderOpenRouter,
						OpenRouterAPIKey: h.openRouterKey,
						ActiveModel:      cfg.ModelName,
					}
					provider, providerErr = llm.NewOpenAICompatibleProvider(config, llm.PromptConfig{})
				} else {
					run.Status = "failed"
					run.ErrorMessage = "timeout (global limit 12s)"
					runs[i] = run
					_ = h.sb.InsertRagExperimentRun(ctx, run)
					return nil // don't fail the group
				}

				if providerErr != nil {
					run.Status = "failed"
					run.ErrorMessage = providerErr.Error()
					runs[i] = run
					_ = h.sb.InsertRagExperimentRun(ctx, run)
					return nil
				}

				sysPrompt := cfg.SystemPrompt
				if sysPrompt == "" {
					sysPrompt = "Você é um assistente especialista agronômico que responde perguntas com base estritamente no contexto fornecido. IMPORTANTE: Responda apenas em texto puro. NUNCA utilize asteriscos (*) ou qualquer formatação Markdown."
				}

				promptText := fmt.Sprintf("Contexto:\n%s\n\nPergunta: %s", contextText, req.Query)

				chatReq := llm.ChatRequest{
					Model:          cfg.ModelName,
					FallbackModels: cfg.FallbackModels,
					SystemPrompt:   sysPrompt,
					UserPrompt:     promptText,
					Temperature:    float64(cfg.Temperature),
				}

				resp, err := provider.ChatRaw(egCtx, chatReq)

				run.DurationMs = int(time.Since(runStartTime).Milliseconds())

				if err != nil {
					run.Status = "failed"
					if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "context deadline exceeded") {
						run.Status = "timeout"
						run.ErrorMessage = "timeout"
					} else {
						run.ErrorMessage = err.Error()
					}
				} else if resp.Text != "" {
					run.Status = "success"
					run.ResponseText = resp.Text
					run.InputTokens = resp.Usage.PromptTokens
					run.OutputTokens = resp.Usage.CompletionTokens
					run.TotalTokens = resp.Usage.PromptTokens + resp.Usage.CompletionTokens
					run.OpenRouterGenerationID = resp.ProviderResponseID
					run.ActualModelUsed = resp.ActualModel
				} else {
					run.Status = "failed"
					run.ErrorMessage = "empty_response"
				}

				runs[i] = run
				// Persist run asynchronously
				err = h.sb.InsertRagExperimentRun(ctx, run)
				if err != nil {
					log.Printf("[Playground] Failed to insert run %s: %v", run.ID, err)
				}

				// Async Hooks (Judge & Telemetry)
				if run.Status == "success" {
					if cfg.ProviderName == "openrouter" && run.OpenRouterGenerationID != "" {
						go h.asyncFetchTelemetry(run.ID, run.OpenRouterGenerationID)
					}

					go func() {
						ctxTimeout, cancel := context.WithTimeout(context.Background(), 35*time.Second)
						defer cancel()

						eval := supabase.RagExperimentEvaluation{
							RunID:              run.ID,
							Status:             "pending",
							JudgeModelID:       os.Getenv("LLM_JUDGE_MODEL_ID"),
							JudgePromptVersion: os.Getenv("JUDGE_PROMPT_VERSION"),
							JudgeSchemaVersion: os.Getenv("JUDGE_SCHEMA_VERSION"),
						}
						if eval.JudgeModelID == "" {
							eval.JudgeModelID = "openai/gpt-4o"
						}
						if eval.JudgePromptVersion == "" {
							eval.JudgePromptVersion = "judge_v2"
						}
						if eval.JudgeSchemaVersion == "" {
							eval.JudgeSchemaVersion = "v2"
						}

						insertedEval, err := h.sb.InsertRagExperimentEvaluation(ctxTimeout, eval)
						if err != nil {
							log.Printf("[Playground] Failed to insert pending evaluation: %v", err)
							return
						}

						cfg := llm.FactoryConfig{
							ActiveProvider:   llm.ProviderOpenRouter,
							OpenRouterAPIKey: h.openRouterKey,
						}
						judgeProvider, err := llm.NewOpenAICompatibleProvider(cfg, llm.PromptConfig{})
						if err == nil {
							evaluator := NewAutomatedEvaluator(h.sb, judgeProvider)
							evaluator.EvaluateRunAsync(exp, run, insertedEval.ID)
						} else {
							log.Printf("[Playground] Failed to create judge provider: %v", err)
						}
					}()
				}

				return nil
			})
		}

		// Wait for all requests to finish
		_ = eg.Wait()
	}

	resp := PlaygroundResponse{
		ExperimentID: experimentID,
		Query:        req.Query,
		Chunks:       matches,
		Runs:         runs,
	}

	log.Printf("[Playground] Completed benchmark for '%s' in %v with %d variants", req.Query, time.Since(startTime), len(req.Configs))
	c.JSON(http.StatusOK, resp)
}

// ManualJudgeRun allows triggering a manual or re-evaluation for a specific run.
// It forces the run into the pending state for the batch worker to process.
func (h *Handler) ManualJudgeRun(c *gin.Context) {
	runID := c.Param("id")
	if _, err := uuid.Parse(runID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid run id"})
		return
	}

	ctx := c.Request.Context()
	
	// Fetch the run to ensure it exists and was successful
	run, err := h.sb.GetRagExperimentRun(ctx, runID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	
	if run.Status != "success" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only successful runs can be judged"})
		return
	}

	eval := supabase.RagExperimentEvaluation{
		RunID:              run.ID,
		Status:             "pending",
		JudgeModelID:       os.Getenv("LLM_JUDGE_MODEL_ID"),
		JudgePromptVersion: os.Getenv("JUDGE_PROMPT_VERSION"),
		JudgeSchemaVersion: os.Getenv("JUDGE_SCHEMA_VERSION"),
	}
	if eval.JudgeModelID == "" {
		eval.JudgeModelID = "openai/gpt-4o"
	}
	if eval.JudgePromptVersion == "" {
		eval.JudgePromptVersion = "judge_v2"
	}
	if eval.JudgeSchemaVersion == "" {
		eval.JudgeSchemaVersion = "v2"
	}

	insertedEval, err := h.sb.InsertRagExperimentEvaluation(ctx, eval)
	if err != nil {
		log.Printf("[Playground] Failed to insert manual judgment for run %s: %v", runID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue manual judgment"})
		return
	}

	// Fetch experiment
	exp, err := h.sb.GetRagExperiment(ctx, run.RagExperimentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch experiment"})
		return
	}

	// Trigger async evaluation
	go func() {
		cfg := llm.FactoryConfig{
			ActiveProvider:   llm.ProviderOpenRouter,
			OpenRouterAPIKey: h.openRouterKey,
		}
		judgeProvider, err := llm.NewOpenAICompatibleProvider(cfg, llm.PromptConfig{})
		if err == nil {
			evaluator := NewAutomatedEvaluator(h.sb, judgeProvider)
			evaluator.EvaluateRunAsync(*exp, *run, insertedEval.ID)
		} else {
			log.Printf("[Playground] Failed to create judge provider: %v", err)
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{
		"message": "evaluation enqueued",
		"run_id":  runID,
		"eval_id": insertedEval.ID,
		"status":  "pending",
	})
}

// asyncFetchTelemetry fetches telemetry and exact cost from OpenRouter's Generation Stats API.
// It uses exponential backoff (max 5 retries) because the generation stats take a few seconds
// to become available after the stream/completion finishes.
func (h *Handler) asyncFetchTelemetry(runID string, generationID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	const maxRetries = 5
	var stats *llm.OpenRouterGenerationStats
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		// Wait before trying/retrying (exponential backoff)
		// e.g. 1s, 2s, 4s, 8s, 16s
		backoff := time.Duration(1<<attempt) * time.Second
		select {
		case <-time.After(backoff):
		case <-ctx.Done():
			log.Printf("[Telemetry] Fetch aborted for run %s: %v", runID, ctx.Err())
			return
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://openrouter.ai/api/v1/generation?id="+generationID, nil)
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Authorization", "Bearer "+h.openRouterKey)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("status %d", resp.StatusCode)
			resp.Body.Close()
			continue
		}

		var payload struct {
			Data llm.OpenRouterGenerationStats `json:"data"`
		}
		err = json.NewDecoder(resp.Body).Decode(&payload)
		resp.Body.Close()

		if err != nil {
			lastErr = err
			continue
		}

		stats = &payload.Data
		break
	}

	if stats == nil {
		log.Printf("[Telemetry] Failed to fetch stats for run %s (gen: %s) after %d retries. Last error: %v", runID, generationID, maxRetries, lastErr)
		return
	}

	// Update the database
	err := h.sb.UpdateExperimentRunTelemetry(ctx, runID, stats.CacheReadTokens, stats.CacheWriteTokens, stats.TotalCost, generationID)
	if err != nil {
		log.Printf("[Telemetry] Failed to update db for run %s: %v", runID, err)
	} else {
		log.Printf("[Telemetry] Successfully updated telemetry for run %s (cost: $%f, cache_read: %d)", runID, stats.TotalCost, stats.CacheReadTokens)
	}
}

// ─── Supabase DTO types (used by client.go) ───────────────────────────────────

// Ensure the supabase package exposes these types and methods.
// The declarations below live in internal/supabase/knowledge.go.
var _ = (*supabase.KnowledgeDocument)(nil)
var _ = (*supabase.KnowledgeIngestionJob)(nil)
var _ = time.Now
var _ = context.Background
