package webhook

import (
	"crypto/hmac"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
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

// Config holds dependencies for the webhook handler.
type Config struct {
	Token          string
	MaxMessageAge  float64
	GroqClient     *groq.Client
	SupabaseClient *supabase.Client
	WhatsAppClient *whatsapp.Client
	GeminiClient   *gemini.Client
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

	// 7. Skip non-text messages (audio support = Fase futura)
	if payload.Body == "" {
		log.Println("⏭️  Mensagem sem texto (áudio/mídia) — ignorando por agora")
		c.JSON(http.StatusOK, gin.H{"status": "received", "note": "no text body"})
		return
	}

	// Delegate business logic orchestration to FSM
	go func(msg WPPMessage) {
		// Asynchronously process the message. We don't block the webhook response on this.
		// A background goroutine ensures WPPConnect receives the 200 OK immediately, avoiding retries/timeouts.
		result := state.ProcessMessage(msg.From, msg.Body, h.cfg.SupabaseClient, h.cfg.GroqClient, h.cfg.WhatsAppClient, h.cfg.GeminiClient)
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

// verifyToken does constant-time token comparison.
func (h *Handler) verifyToken(received string) bool {
	if received == "" || h.cfg.Token == "" {
		return false
	}
	return hmac.Equal([]byte(received), []byte(h.cfg.Token))
}
