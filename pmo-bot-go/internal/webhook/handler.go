package webhook

import (
	"context"
	"crypto/hmac"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
	"golang.org/x/time/rate"
	"github.com/Flagsmith/flagsmith-go-client/v3"
)

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Config struct {
	Token           string
	MaxMessageAge   float64
	GroqClient      *groq.Client
	SupabaseClient  *supabase.Client
	WhatsAppClient  ports.MessageSender
	GeminiClient    *gemini.Client
	TtsClient       *tts.Orchestrator
	MCPServer       *mcp.Server
	HistoryManager  *history.Manager
	FlagsmithClient *flagsmith.Client

	// HarnessQueue é a fila PostgreSQL durável (Harness de Produção).
	// Se nil, o handler opera em modo legado (goroutine direta).
	HarnessQueue interface {
		Enqueue(ctx context.Context, msg ports.IncomingMessage) error
	}
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// Handler is the webhook HTTP handler.
type Handler struct {
	cfg     Config
	limiter *rate.Limiter
}

// NewHandler creates a new webhook handler with the given config and Groq client.
func NewHandler(cfg Config) *Handler {
	if cfg.MaxMessageAge == 0 {
		cfg.MaxMessageAge = 600
	}
	return &Handler{
		cfg:     cfg,
		limiter: rate.NewLimiter(rate.Every(4*time.Second), 1), // 1 req a cada 4s = 15 RPM
	}
}

// ---------------------------------------------------------------------------
// Session-Level Mutex & Message Deduplication (Security Fix)
// ---------------------------------------------------------------------------

var (
	sessionMu   sync.Map // map[phone]*sync.Mutex — one lock per session
	processedMu sync.Map // map[msgID]struct{} — dedup by message ID
)

// getSessionMutex returns a dedicated mutex for each phone/session.
func getSessionMutex(phone string) *sync.Mutex {
	mu, _ := sessionMu.LoadOrStore(phone, &sync.Mutex{})
	return mu.(*sync.Mutex)
}

// RegisterRoutes registers the webhook routes on the Gin engine.
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.POST("/webhook", h.handleWebhook)
	r.POST("/webhook/evolution", h.handleWebhook)   // Primary route for Evolution API
	r.POST("/api/:session/webhook", h.handleWebhook) // Fallback for session-prefixed webhooks
	r.POST("/knowledge/upload", h.handleKnowledgeUpload)
	r.GET("/health", h.handleHealth)
}

// SetWhatsAppClient updates the WhatsApp client (used for lazy reconnection).
func (h *Handler) SetWhatsAppClient(c ports.MessageSender) {
	h.cfg.WhatsAppClient = c
}

// handleWebhook processes incoming Evolution API messages.
// REGRA DE OURO: Always returns HTTP 200 to avoid sender retry loops.
func (h *Handler) handleWebhook(c *gin.Context) {
	log.Println("🔍 [DEBUG] handleWebhook ENTERED")

	// 1. Token validation
	token := c.Query("token")
	if token == "" {
		auth := c.GetHeader("Authorization")
		if len(auth) > 7 && auth[:7] == "Bearer " {
			token = auth[7:]
		}
	}

	if !h.verifyToken(token) {
		log.Printf("🔒 Token inválido (%s) — acesso negado", token)
		c.JSON(http.StatusOK, gin.H{"status": "token_invalid", "error": "Access Denied"})
		return
	}

	// 2. Parse the Evolution payload via Adapter
	rawBody, _ := c.GetRawData()
	log.Printf("Raw Webhook Body: %s", string(rawBody))

	payload, err := evolution.ParseWebhook(rawBody)
	if err != nil {
		log.Printf("❌ Falha no Parse do Webhook: %v", err)
		c.JSON(http.StatusOK, gin.H{"status": "parse_error", "error": err.Error()})
		return
	}

	if payload == nil {
		log.Println("⏭️ Evento ignorado (não é Message ou messages.upsert)")
		c.JSON(http.StatusOK, gin.H{"status": "ignored_event"})
		return
	}

	// 3. Broadcast filter
	if payload.IsBroadcast {
		c.JSON(http.StatusOK, gin.H{"status": "ignored_broadcast"})
		return
	}

	// 4. Self-message filter (simplified in port)
	if payload.IsFromMe {
		log.Printf("⏭️  Mensagem enviada pelo bot — ignorando")
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "reason": "isFromMe"})
		return
	}

	// 5. TTL check
	age := time.Since(payload.Timestamp).Seconds()
	if age > h.cfg.MaxMessageAge {
		log.Printf("⏳ TTL DROP: Mensagem de %.1fs atrás ignorada (Max: %.1fs)", age, h.cfg.MaxMessageAge)
		c.JSON(http.StatusOK, gin.H{"status": "ignored_old", "age": age})
		return
	}

	// 6. Log receipt
	log.Printf("📨 Recebida De: %s | Tipo: %s | Body: %.100s",
		payload.From, payload.Type, payload.Body)

	if payload.IsAudio {
		log.Printf("[AUDIO-DEBUG] Recebida mensagem de áudio de %s (ID: %s)", payload.From, payload.ID)
	}

	// 7. Skip non-text messages if not audio or image
	if payload.Body == "" && !payload.IsAudio && !payload.IsImage {
		log.Println("⏭️  Mensagem sem texto (mídia não-suportada) — ignorando")
		c.JSON(http.StatusOK, gin.H{"status": "received", "note": "media not supported yet"})
		return
	}

	// 8. Session-Level Mutex & Message Deduplication
	msgID := payload.ID
	if msgID != "" {
		if _, loaded := processedMu.LoadOrStore(msgID, struct{}{}); loaded {
			log.Printf("🔁 [DEDUP] Mensagem %s já em processamento — ignorando duplicata", msgID)
			c.JSON(http.StatusOK, gin.H{"status": "duplicate"})
			return
		}
		// Cleanup: remove after 5 min
		go func(id string) {
			time.Sleep(5 * time.Minute)
			processedMu.Delete(id)
		}(msgID)
	}

	// ─── Dispatch: Harness (Produção) vs. Legado ───────────────────────────
	// Se HarnessQueue estiver configurado (HARNESS_ENABLED=true), a mensagem
	// é inserida na fila PostgreSQL durável e os workers dedicados a processam.
	// Se nil, cai no modo legado: goroutine direta (comportamento anterior).
	// Para rollback imediato: basta remover HarnessQueue do Config e reiniciar.
	if h.cfg.HarnessQueue != nil {
		enqueueCtx, enqueueCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer enqueueCancel()

		if err := h.cfg.HarnessQueue.Enqueue(enqueueCtx, *payload); err != nil {
			log.Printf("❌ [WEBHOOK] Falha ao enfileirar mensagem %s: %v — falling back to legacy", payload.ID, err)
			// Fallback automático para goroutine legada se o Enqueue falhar
			go h.processLegacy(*payload)
		} else {
			log.Printf("📬 [WEBHOOK] Mensagem %s enfileirada no Harness (from=%s)", payload.ID, payload.From)
		}
	} else {
		// Modo legado: goroutine direta (sem persistência de fila)
		go h.processLegacy(*payload)
	}

	// 9. Always Respond 200 OK
	c.JSON(http.StatusOK, gin.H{
		"status": "processed",
		"from":   payload.From,
	})
}

// handleHealth is a simple liveness probe.
func (h *Handler) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// processLegacy executa o fluxo de processamento legado (goroutine direta, sem persistência).
// Usado quando HARNESS_ENABLED=false ou como fallback automático se o Enqueue falhar.
// O comportamento é idêntico ao que existia antes do Harness.
func (h *Handler) processLegacy(msg ports.IncomingMessage) {
	go h.cfg.WhatsAppClient.SetPresence(msg.From, "composing")
	defer h.cfg.WhatsAppClient.SetPresence(msg.From, "available")

	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [CRITICAL] Panic no processamento legado: %v", r)
			h.cfg.WhatsAppClient.SendMessage(msg.From, "⚠️ Ocorreu um erro crítico inesperado. Minha equipe foi avisada.")
		}
	}()

	mu := getSessionMutex(msg.From)
	mu.Lock()
	defer mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	result := state.ProcessMessage(ctx, msg, h.cfg.SupabaseClient, h.cfg.GroqClient, h.cfg.WhatsAppClient, h.cfg.GeminiClient, h.cfg.TtsClient, h.cfg.MCPServer, h.cfg.HistoryManager, h.cfg.FlagsmithClient)
	if !result.Success {
		log.Printf("⚠️ [LEGACY] Processing completed with issues: %s", result.Reason)
	}
}


// handleKnowledgeUpload handles the knowledge base update via PDF upload
func (h *Handler) handleKnowledgeUpload(c *gin.Context) {
	// 1. Basic Token Check
	token := c.Query("token")
	if token == "" {
		auth := c.GetHeader("Authorization")
		if len(auth) > 7 && auth[:7] == "Bearer " {
			token = auth[7:]
		}
	}
	if !h.verifyToken(token) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Access Denied"})
		return
	}

	// 2. Parse PMO ID (optional)
	pmoIDStr := c.PostForm("pmo_id")
	var pmoID int64
	if pmoIDStr != "" {
		id, err := strconv.ParseInt(pmoIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid pmo_id"})
			return
		}
		pmoID = id

		// --- QUOTA CHECK ---
		tier, count, err := h.cfg.SupabaseClient.GetIngestionStats(pmoID)
		if err == nil {
			// Rule: 3 docs for non-pro
			if tier != "pro" && count >= 3 {
				c.JSON(http.StatusForbidden, gin.H{
					"error":  "Limite de cota atingido",
					"detail": "Usuários gratuitos podem ingerir até 3 documentos. Faça upgrade para Pro para ilimitado.",
					"count":  count,
					"tier":   tier,
				})
				return
			}
		} else {
			log.Printf("⚠️ [UPLOAD] Erro ao verificar quota: %v", err)
		}
		// -------------------
	}

	// 3. Get file from form
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// 4. Save to temp location (in-memory would be risky for large PDFs)
	tempDir := os.TempDir()
	tempPath := filepath.Join(tempDir, fmt.Sprintf("upload-%d-%s", time.Now().Unix(), file.Filename))
	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// 5. Create Ingestion Job in DB
	jobID, err := h.cfg.SupabaseClient.CreateIngestionJob(supabase.IngestionJob{
		PmoID:    pmoID,
		FileName: file.Filename,
		Status:   "pending",
	})
	if err != nil {
		log.Printf("⚠️ [UPLOAD] Falha ao criar job no Supabase: %v", err)
		// We still process the file even if job tracking fails, or we could return error
	}

	// 6. Fire and Forget (Async)
	go h.processKnowledgePDF(tempPath, file.Filename, pmoID, jobID)

	// 7. Return 202 Accepted
	c.JSON(http.StatusAccepted, gin.H{
		"status":  "processing",
		"message": "O documento está sendo processado em background.",
		"file":    file.Filename,
		"job_id":  jobID,
	})
}

// processKnowledgePDF reads, extracts, chunks, embeds and inserts document data using a worker pool.
func (h *Handler) processKnowledgePDF(path string, originalName string, pmoID int64, jobID string) {
	defer os.Remove(path) // Cleanup temp file

	// Recover from panics to mark job as failed
	defer func() {
		if r := recover(); r != nil {
			errStr := fmt.Sprintf("Panic recovered: %v", r)
			log.Printf("🚨 [ASYNC-RAG] CRITICAL ERROR: %s", errStr)
			if jobID != "" {
				h.cfg.SupabaseClient.FinishJob(jobID, "failed", errStr)
			}
		}
	}()

	log.Printf("📥 [ASYNC-RAG] Iniciando processamento de %s (PMO: %d, Job: %s)", originalName, pmoID, jobID)

	content, err := utils.ExtractTextFromPDF(path)
	if err != nil {
		errStr := fmt.Sprintf("Erro na extração de texto: %v", err)
		log.Printf("❌ [ASYNC-RAG] %s", errStr)
		if jobID != "" {
			h.cfg.SupabaseClient.FinishJob(jobID, "failed", errStr)
		}
		return
	}

	// Simple Chunking Strategy: ~1200 characters with 200 overlap
	chunks := utils.SimpleChunking(content, 1200, 200)
	totalChunks := len(chunks)
	log.Printf("🧩 [ASYNC-RAG] Texto extraído. Gerando %d chunks em Worker Pool...", totalChunks)

	if jobID != "" {
		h.cfg.SupabaseClient.UpdateJobProgress(jobID, 0, totalChunks)
	}

	// Worker Pool Setup
	const numWorkers = 3
	type job struct {
		index int
		chunk string
	}

	jobs := make(chan job, totalChunks)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup
	var processedCount int64

	// Start Workers
	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case j, ok := <-jobs:
					if !ok {
						return
					}

					chunk := strings.TrimSpace(j.chunk)
					if chunk == "" {
						atomic.AddInt64(&processedCount, 1)
						continue
					}

					// Rate Limiting
					if err := h.limiter.Wait(ctx); err != nil {
						log.Printf("⚠️ [Worker-%d] Rate limiter error: %v", workerID, err)
						cancel() // Fail-fast
						return
					}

					// Generate Embedding
					embedding, err := h.cfg.GeminiClient.GenerateEmbedding(chunk)
					if err != nil {
						log.Printf("⚠️ [Worker-%d] Erro ao gerar embedding para chunk %d: %v", workerID, j.index, err)
						// Check if it's a rate limit error (simplified check)
						if strings.Contains(err.Error(), "429") {
							log.Printf("🚫 [Worker-%d] Rate limit hit (429). Retrying after brief pause...", workerID)
							time.Sleep(2 * time.Second)
							// Retry once or just log and continue
							embedding, err = h.cfg.GeminiClient.GenerateEmbedding(chunk)
							if err != nil {
								log.Printf("❌ [Worker-%d] Retry failed for chunk %d: %v", workerID, j.index, err)
								continue
							}
						} else {
							continue
						}
					}

					// Insert into Supabase
					err = h.cfg.SupabaseClient.InsertFarmDocument(pmoID, originalName, chunk, embedding)
					if err != nil {
						log.Printf("⚠️ [Worker-%d] Erro ao inserir chunk %d no Supabase: %v", workerID, j.index, err)
						continue
					}

					newCount := atomic.AddInt64(&processedCount, 1)

					// Update progress periodically or on completion
					if jobID != "" && (newCount%5 == 0 || int(newCount) == totalChunks) {
						h.cfg.SupabaseClient.UpdateJobProgress(jobID, int(newCount), totalChunks)
					}
				}
			}
		}(w)
	}

	// Feed Jobs
	for i, chunk := range chunks {
		jobs <- job{index: i, chunk: chunk}
	}
	close(jobs)

	// Wait for completion
	wg.Wait()

	if jobID != "" {
		status := "completed"
		if int(atomic.LoadInt64(&processedCount)) < totalChunks {
			// Optional: mark as partial or completed if most chunks succeeded
			log.Printf("⚠️ [ASYNC-RAG] Processamento concluído com lacunas: %d/%d", processedCount, totalChunks)
		}
		h.cfg.SupabaseClient.FinishJob(jobID, status, "")
	}

	log.Printf("✅ [ASYNC-RAG] Documento %s processado (Total Chunks: %d)", originalName, totalChunks)
}

// verifyToken does constant-time token comparison.
func (h *Handler) verifyToken(received string) bool {
	if received == "" || h.cfg.Token == "" {
		return false
	}
	return hmac.Equal([]byte(received), []byte(h.cfg.Token))
}
