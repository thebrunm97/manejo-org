// Package knowledge provides the async Worker Pool that processes ingestion jobs.
// It polls the `ingestion_jobs` table and executes the pipeline:
//   pending -> extracting -> chunking -> embedding -> indexed (or failed)
//
// Design principles:
//   - Uses SELECT FOR UPDATE SKIP LOCKED via Supabase RPC for concurrent-safe polling.
//   - MaxAttempts prevents infinite retries on broken documents.
//   - The worker creates a knowledge_version (status='draft') as output of a successful run.
//   - Graceful shutdown via context cancellation.
package knowledge

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"golang.org/x/text/encoding/charmap"
)

const (
	workerPollInterval = 5 * time.Second
)

// WorkerPool manages N concurrent ingestion goroutines.
type WorkerPool struct {
	sb          *supabase.Client
	concurrency int
}

// NewWorkerPool creates a new ingestion worker pool.
func NewWorkerPool(sb *supabase.Client, concurrency int) *WorkerPool {
	if concurrency <= 0 {
		concurrency = 2
	}
	return &WorkerPool{sb: sb, concurrency: concurrency}
}

// Start launches the worker goroutines. It blocks until ctx is cancelled.
func (p *WorkerPool) Start(ctx context.Context) {
	log.Printf("[KnowledgeWorker] Starting %d worker(s) (poll interval: %s)", p.concurrency, workerPollInterval)
	for i := 0; i < p.concurrency; i++ {
		go p.runWorker(ctx, fmt.Sprintf("worker-%d", i))
	}
	<-ctx.Done()
	log.Println("[KnowledgeWorker] Shutting down worker pool")
}

// runWorker is the main loop for a single worker goroutine.
func (p *WorkerPool) runWorker(ctx context.Context, workerID string) {
	ticker := time.NewTicker(workerPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			job, err := p.sb.ClaimNextIngestionJob(ctx, workerID)
			if err != nil {
				// No job available is expected and not an error
				continue
			}
			if job == nil {
				continue
			}

			log.Printf("[%s] Claimed job %s (document: %s)", workerID, job.ID, job.DocumentID)
			if err := p.processJob(ctx, job, workerID); err != nil {
				log.Printf("[%s] Job %s FAILED (attempt %d): %v", workerID, job.ID, job.AttemptCount, err)
				errMsg := err.Error()
				_ = p.sb.UpdateIngestionJobStatus(ctx, job.ID, "failed", &errMsg, nil, workerID)
			}
		}
	}
}

// processJob executes the full extraction pipeline for a single job.
func (p *WorkerPool) processJob(ctx context.Context, job *supabase.KnowledgeIngestionJob, workerID string) error {
	docID := job.DocumentID

	// ── Step 1: Download document from Storage ─────────────────────────────
	p.updateStep(ctx, job.ID, "extracting", 5, workerID)

	doc, err := p.sb.GetKnowledgeDocumentByID(ctx, docID)
	if err != nil {
		return fmt.Errorf("fetch document: %w", err)
	}

	// ── Step 2: Extract text from file ────────────────────────────────────
	// MVP: raw text extraction. PDF support will use pdfcpu or an external OCR call.
	// MARKDOWN files are used as-is.
	extractedText, err := p.extractText(ctx, doc)
	if err != nil {
		return fmt.Errorf("extract text: %w", err)
	}
	p.updateStep(ctx, job.ID, "chunking", 30, workerID)

	// ── Step 3: Create draft knowledge_version ────────────────────────────
	// The version holds the raw extracted content. Future steps will
	// handle semantic chunking and vector embedding via the OKF pipeline.
	versionID := uuid.New().String()
	version := supabase.KnowledgeVersion{
		ID:            versionID,
		DocumentID:    docID,
		Content:       extractedText,
		ContentFormat: contentFormat(doc.SourceType),
		VersionNumber: 1, // TODO: increment from previous versions
		Status:        "draft",
	}

	if err := p.sb.InsertKnowledgeVersion(ctx, version); err != nil {
		return fmt.Errorf("create version: %w", err)
	}
	p.updateStep(ctx, job.ID, "embedding", 60, workerID)

	// ── Step 4: Update the job with the version reference ─────────────────
	// Embedding into farm_documents (pgvector) is deferred to a separate
	// embedder goroutine or can be triggered from here in Phase 2.
	// For Phase 1, we mark the job as indexed once the draft version exists.
	p.updateStep(ctx, job.ID, "indexed", 100, workerID)

	// Link version to job
	_ = p.sb.UpdateIngestionJobVersionID(ctx, job.ID, versionID)

	log.Printf("[KnowledgeWorker] Job %s completed. Draft version %s created.", job.ID, versionID)
	return nil
}

// extractText returns the text content of a document.
// For MARKDOWN: reads file from Supabase Storage and returns as-is.
// For PDF: Phase 1 stub — returns a placeholder. Full OCR is Phase 2.
func (p *WorkerPool) extractText(ctx context.Context, doc *supabase.KnowledgeDocument) (string, error) {
	if doc.StoragePath == "" {
		return "", fmt.Errorf("document %s has no storage_path", doc.ID)
	}

	switch strings.ToUpper(doc.SourceType) {
	case "MARKDOWN":
		content, err := p.sb.DownloadStorageFile(ctx, "knowledge-docs", doc.StoragePath)
		if err != nil {
			return "", fmt.Errorf("download markdown: %w", err)
		}
		
		// Fix character encoding if not valid UTF-8
		if !utf8.Valid(content) {
			dec := charmap.Windows1252.NewDecoder()
			b, err := dec.Bytes(content)
			if err == nil {
				content = b
			}
		}

		// Strip null bytes as PostgreSQL TEXT fields do not support them (\u0000)
		cleanStr := strings.ReplaceAll(string(content), "\x00", "")
		return cleanStr, nil

	case "PDF":
		// Phase 1 stub: mark for manual review until PDF parser is integrated.
		// The draft version will have a placeholder that reminds the editor to
		// paste curated content via the Rules Editor in the frontend.
		return fmt.Sprintf(
			"[PENDING_EXTRACTION] PDF document '%s' uploaded successfully.\n"+
				"Please use the Rules Editor to paste or review the extracted content before approving.\n"+
				"Source: %s",
			doc.Title, doc.StoragePath,
		), nil

	default:
		return "", fmt.Errorf("unsupported source_type: %s", doc.SourceType)
	}
}

// contentFormat maps source_type to the content_format stored in knowledge_versions.
func contentFormat(sourceType string) string {
	if strings.ToUpper(sourceType) == "MARKDOWN" {
		return "MARKDOWN"
	}
	return "RAW_TEXT"
}

// updateStep is a convenience method to log and persist worker progress.
func (p *WorkerPool) updateStep(ctx context.Context, jobID, step string, pct int, workerID string) {
	log.Printf("[KnowledgeWorker] Job %s — step: %s (%d%%)", jobID, step, pct)
	_ = p.sb.UpdateIngestionJobStatus(ctx, jobID, step, nil, &pct, workerID)
}
