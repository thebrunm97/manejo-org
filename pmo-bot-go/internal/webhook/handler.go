package webhook

import (
	"bytes"
	"crypto/hmac"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/ledongthuc/pdf"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/whatsapp"
)

// ---------------------------------------------------------------------------
// WPPConnect Payload Structs (mapped 1:1 from pmo_bot/models/whatsapp.py)
// ---------------------------------------------------------------------------

// SenderProfile contains nested sender info that WPPConnect includes.
type SenderProfile struct {
	ID              interface{} `json:"id"`
	ProfilePicThumb interface{} `json:"profilePicThumbObj,omitempty"`
}

// WPPMessage is the strongly-typed struct for the WPPConnect webhook payload.
type WPPMessage struct {
	Event     string         `json:"event"`
	From      string         `json:"from"`
	FromMe    bool           `json:"fromMe"`
	ID        interface{}    `json:"id"`
	Type      string         `json:"type"`
	Body      string         `json:"body"`
	ChatID    interface{}    `json:"chatId"`
	Timestamp *float64       `json:"timestamp"`
	MimeType  *string        `json:"mimetype,omitempty"`
	Sender    *SenderProfile `json:"sender,omitempty"`
}

// NormalizedChatID extracts a clean string from the chatId field.
func (m *WPPMessage) NormalizedChatID() string {
	switch v := m.ChatID.(type) {
	case string:
		return v
	case map[string]interface{}:
		if s, ok := v["_serialized"].(string); ok {
			return s
		}
		user, _ := v["user"].(string)
		server, _ := v["server"].(string)
		if server == "" {
			server = "c.us"
		}
		return user + "@" + server
	}
	return ""
}

// MessageID extracts a clean string ID for deduplication.
func (m *WPPMessage) MessageID() string {
	switch v := m.ID.(type) {
	case string:
		return v
	case map[string]interface{}:
		if s, ok := v["_serialized"].(string); ok {
			return s
		}
		if s, ok := v["id"].(string); ok {
			return s
		}
	}
	return ""
}

// ShouldProcess checks if the message should be processed.
func (m *WPPMessage) ShouldProcess() bool {
	return !m.FromMe && m.Event == "onmessage"
}

// IsAudio checks if the message is an audio/voice note.
func (m *WPPMessage) IsAudio() bool {
	if m.Type == "ptt" || m.Type == "audio" {
		return true
	}
	if m.MimeType != nil {
		mime := *m.MimeType
		for i := 0; i+4 < len(mime); i++ {
			if mime[i:i+5] == "audio" {
				return true
			}
		}
	}
	return false
}

// IsBroadcast checks if the sender is a broadcast channel.
func (m *WPPMessage) IsBroadcast() bool {
	from := m.From
	if len(from) >= 16 && from[len(from)-10:] == "@broadcast" {
		return true
	}
	return from == "status@broadcast"
}

// AgeSeconds returns the age of the message in seconds.
func (m *WPPMessage) AgeSeconds() float64 {
	if m.Timestamp == nil {
		return -1
	}
	ts := *m.Timestamp
	if ts > 100_000_000_000 {
		ts /= 1000.0
	}
	return float64(time.Now().Unix()) - ts
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Config struct {
	Token          string
	MaxMessageAge  float64
	GroqClient     *groq.Client
	SupabaseClient *supabase.Client
	WhatsAppClient *whatsapp.Client
	GeminiClient   *gemini.Client
	TtsClient      *tts.Orchestrator
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// Handler is the webhook HTTP handler.
type Handler struct {
	cfg Config
}

// NewHandler creates a new webhook handler with the given config and Groq client.
func NewHandler(cfg Config) *Handler {
	if cfg.MaxMessageAge == 0 {
		cfg.MaxMessageAge = 600
	}
	return &Handler{
		cfg: cfg,
	}
}

// RegisterRoutes registers the webhook routes on the Gin engine.
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.POST("/webhook", h.handleWebhook)
	r.POST("/knowledge/upload", h.handleKnowledgeUpload)
	r.GET("/health", h.handleHealth)
}

// handleWebhook processes incoming WPPConnect messages.
// REGRA DE OURO: Always returns HTTP 200 to avoid sender retry loops.
func (h *Handler) handleWebhook(c *gin.Context) {
	// 1. Token validation (query param ?token= or Authorization: Bearer ...)
	token := c.Query("token")
	if token == "" {
		auth := c.GetHeader("Authorization")
		if len(auth) > 7 && auth[:7] == "Bearer " {
			token = auth[7:]
		}
	}

	if !h.verifyToken(token) {
		log.Println("🔒 Token inválido — acesso negado")
		c.JSON(http.StatusOK, gin.H{"status": "token_invalid", "error": "Access Denied"})
		return
	}

	// 2. Parse the WPPConnect payload
	var payload WPPMessage
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Printf("❌ JSON inválido: %v", err)
		c.JSON(http.StatusOK, gin.H{"status": "invalid_json", "error": err.Error()})
		return
	}

	// 3. Broadcast filter
	if payload.IsBroadcast() {
		c.JSON(http.StatusOK, gin.H{"status": "ignored_broadcast"})
		return
	}

	// 4. Self-message filter
	if !payload.ShouldProcess() {
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "reason": "fromMe or not onmessage"})
		return
	}

	// 5. TTL check
	age := payload.AgeSeconds()
	if age >= 0 && age > h.cfg.MaxMessageAge {
		log.Printf("⏳ TTL DROP: Mensagem de %.1fs atrás ignorada", age)
		c.JSON(http.StatusOK, gin.H{"status": "ignored_old", "age": age})
		return
	}

	// 6. Log receipt
	log.Printf("📨 [%s] De: %s | Tipo: %s | Body: %.100s",
		payload.Event, payload.From, payload.Type, payload.Body)

	// 7. Skip non-text messages if not audio
	if payload.Body == "" && !payload.IsAudio() { // CHANGE: Continue if it's audio
		log.Println("⏭️  Mensagem sem texto (mídia não-audio) — ignorando por agora")
		c.JSON(http.StatusOK, gin.H{"status": "received", "note": "media not supported yet"})
		return
	}

	// Delegate business logic orchestration to FSM
	go func(msg WPPMessage) {
		// Asynchronously process the message. We don't block the webhook response on this.
		// A background goroutine ensures WPPConnect receives the 200 OK immediately, avoiding retries/timeouts.
		result := state.ProcessMessage(msg.From, msg.Body, msg.MessageID(), msg.IsAudio(), h.cfg.SupabaseClient, h.cfg.GroqClient, h.cfg.WhatsAppClient, h.cfg.GeminiClient, h.cfg.TtsClient)
		if !result.Success {
			log.Printf("⚠️ [FSM] Background processing completed with issues: %s", result.Reason)
		}
	}(payload)

	// 8. Always Respond 200 OK
	// To prevent WPPConnect from looping on retries
	c.JSON(http.StatusOK, gin.H{
		"status": "processed",
		"from":   payload.From,
	})
}

// handleHealth is a simple liveness probe.
func (h *Handler) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
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

// processKnowledgePDF reads, extracts, chunks, embeds and inserts document data.
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

	content, err := extractTextFromPDF(path)
	if err != nil {
		errStr := fmt.Sprintf("Erro na extração de texto: %v", err)
		log.Printf("❌ [ASYNC-RAG] %s", errStr)
		if jobID != "" {
			h.cfg.SupabaseClient.FinishJob(jobID, "failed", errStr)
		}
		return
	}

	// Simple Chunking Strategy: ~1000 characters with overlap
	chunks := simpleChunking(content, 1200, 200)
	totalChunks := len(chunks)
	log.Printf("🧩 [ASYNC-RAG] Texto extraído. Gerando %d chunks...", totalChunks)

	if jobID != "" {
		h.cfg.SupabaseClient.UpdateJobProgress(jobID, 0, totalChunks)
	}

	processedCount := 0
	for i, chunk := range chunks {
		if strings.TrimSpace(chunk) == "" {
			continue
		}

		embedding, err := h.cfg.GeminiClient.GenerateEmbedding(chunk)
		if err != nil {
			log.Printf("⚠️ [ASYNC-RAG] Erro ao gerar embedding para chunk %d: %v", i, err)
			continue
		}

		err = h.cfg.SupabaseClient.InsertFarmDocument(pmoID, originalName, chunk, embedding)
		if err != nil {
			log.Printf("⚠️ [ASYNC-RAG] Erro ao inserir chunk %d no Supabase: %v", i, err)
			continue
		}

		processedCount++

		// Update progress every 5 chunks
		if jobID != "" && (processedCount%5 == 0 || processedCount == totalChunks) {
			h.cfg.SupabaseClient.UpdateJobProgress(jobID, processedCount, totalChunks)
		}

		// Rate limit protection for Gemini (Free tier is generous but let's be safe)
		time.Sleep(500 * time.Millisecond)
	}

	if jobID != "" {
		h.cfg.SupabaseClient.FinishJob(jobID, "completed", "")
	}

	log.Printf("✅ [ASYNC-RAG] Documento %s processado com sucesso!", originalName)
}

// extractTextFromPDF uses ledongthuc/pdf to get all text from document.
func extractTextFromPDF(path string) (string, error) {
	f, r, err := pdf.Open(path)
	if f != nil {
		defer f.Close()
	}
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	b, err := r.GetPlainText()
	if err != nil {
		return "", err
	}
	buf.ReadFrom(b)

	return buf.String(), nil
}

// simpleChunking creates chunks of size 'limit' with an 'overlap'.
func simpleChunking(text string, limit int, overlap int) []string {
	if len(text) <= limit {
		return []string{text}
	}

	var chunks []string
	start := 0
	for start < len(text) {
		end := start + limit
		if end > len(text) {
			end = len(text)
		}

		chunks = append(chunks, text[start:end])
		if end == len(text) {
			break
		}
		start = end - overlap
	}
	return chunks
}

// verifyToken does constant-time token comparison.
func (h *Handler) verifyToken(received string) bool {
	if received == "" || h.cfg.Token == "" {
		return false
	}
	return hmac.Equal([]byte(received), []byte(h.cfg.Token))
}
