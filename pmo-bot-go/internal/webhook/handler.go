package webhook

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"os"
	"path/filepath"
	"strconv"

	"github.com/Flagsmith/flagsmith-go-client/v3"
	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
	"golang.org/x/time/rate"
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
	LLMClient       llm.LLMProvider
	TtsClient       ports.Synthesizer
	MCPServer       *mcp.Server
	HistoryManager  *history.Manager
	FlagsmithClient *flagsmith.Client

	// HITLController handles SIM/NÃO producer responses for high-risk tool approvals.
	// If nil, HITL interception is disabled.
	HITLController guardrails.HITLHandler

	// HarnessQueue é a fila PostgreSQL durável (Harness de Produção).
	// Se nil, o handler opera em modo legado (goroutine direta).
	HarnessQueue interface {
		Enqueue(ctx context.Context, msg ports.IncomingMessage) error
	}

	EnableFastRouter       bool
	EnableFastRouterShadow bool
	FastRouterTimeoutMS    int

	WorkerCount int
	QueueSize   int

	// ConnectionEvents recebe eventos de CONNECTION (Disconnected,
	// ConnectFailure, LoggedOut, Connected, QRCode) — o self-heal do DT-53,
	// quando ligado. Se nil, esses eventos continuam sendo só ignorados, como
	// sempre foram.
	ConnectionEvents ports.ConnectionEventNotifier

	// InboundLimiter limita mensagens por telefone na entrada. Diferente do
	// 429 de fila cheia mais abaixo, que é uma proteção global do processo,
	// este limite é por produtor: sem ele, um único telefone em loop consome a
	// capacidade de todos os tenants.
	//
	// Se nil, NewHandler substitui por ports.NoopRateLimiter.
	InboundLimiter ports.RateLimiter

	// WarningLimiter é usado como debouncer para evitar spam de mensagens
	// de aviso via WhatsApp quando o usuário excede a cota ou a fila enche.
	// Se nil, avisos silenciosamente falham o limite (ou seja, não envia nada).
	WarningLimiter ports.RateLimiter
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

// Handler is the webhook HTTP handler.
type Handler struct {
	cfg        Config
	limiter    *rate.Limiter
	legacyPool *MemoryWorkerPool
}

// NewHandler creates a new webhook handler with the given config and Groq client.
func NewHandler(cfg Config) *Handler {
	if cfg.MaxMessageAge == 0 {
		cfg.MaxMessageAge = 600
	}
	if cfg.InboundLimiter == nil {
		cfg.InboundLimiter = ports.NoopRateLimiter{}
	}
	if cfg.WarningLimiter == nil {
		cfg.WarningLimiter = ports.NoopRateLimiter{}
	}
	h := &Handler{
		cfg:     cfg,
		limiter: rate.NewLimiter(rate.Every(4*time.Second), 1), // 1 req a cada 4s = 15 RPM
	}

	// Initialize the legacy memory worker pool
	h.legacyPool = NewMemoryWorkerPool(cfg.WorkerCount, cfg.QueueSize, h)
	h.legacyPool.Start()

	// Ticker único para limpeza do dedup in-memory (previne memory leaks)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			now := time.Now()
			processedMu.Range(func(key, val interface{}) bool {
				if ts, ok := val.(time.Time); ok && now.Sub(ts) > 5*time.Minute {
					processedMu.Delete(key)
				}
				return true
			})
		}
	}()

	return h
}

// ---------------------------------------------------------------------------
// Session-Level Mutex & Message Deduplication (Security Fix)
// ---------------------------------------------------------------------------

var (
	processedMu sync.Map // map[msgID]time.Time — dedup by message ID
)

// RegisterRoutes registers the webhook routes on the Gin engine.
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.POST("/webhook", h.handleWebhook)
	r.POST("/webhook/evolution", h.handleWebhook)    // Primary route for Evolution API
	r.POST("/api/:session/webhook", h.handleWebhook) // Fallback for session-prefixed webhooks
	r.POST("/knowledge/upload", h.handleKnowledgeUpload)
	r.GET("/health", h.handleHealth)
}

// SetWhatsAppClient updates the WhatsApp client (used for lazy reconnection).
func (h *Handler) SetWhatsAppClient(c ports.MessageSender) {
	h.cfg.WhatsAppClient = c
}

// SetConnectionEventNotifier liga o self-heal (DT-53) depois do handler já
// construído — mesmo padrão do SetWhatsAppClient, necessário porque em
// cmd/server/main.go o healer só existe depois que o webhook.Handler já foi
// criado e registrado nas rotas.
func (h *Handler) SetConnectionEventNotifier(n ports.ConnectionEventNotifier) {
	h.cfg.ConnectionEvents = n
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
		telemetry.WebhookRequestsTotal.WithLabelValues("unauthorized", "evolution").Inc()
		slog.Warn("Token inválido — acesso negado", slog.String("token", token))
		c.JSON(http.StatusOK, gin.H{"status": "token_invalid", "error": "Access Denied"})
		return
	}

	// 2. Parse the Evolution payload via Adapter
	rawBody, _ := c.GetRawData()

	// DT-53: eventos de CONNECTION (Disconnected, LoggedOut, QRCode...) não são
	// mensagens — ParseWebhook abaixo vai descartá-los de propósito. Espiamos o
	// tipo ANTES disso pra alimentar o self-heal, sem interferir no caminho de
	// mensagens: a checagem devolve "" pra qualquer coisa que não interesse, e
	// o restante do handler segue idêntico.
	if h.cfg.ConnectionEvents != nil {
		if evento := evolution.ExtractEventType(rawBody); evento != "" {
			h.cfg.ConnectionEvents.NotificarEvento(evento)
		}
	}

	payload, err := evolution.ParseWebhook(rawBody)
	if err != nil {
		telemetry.WebhookRequestsTotal.WithLabelValues("parse_error", "evolution").Inc()
		slog.Error("Falha no Parse do Webhook", "error", err)
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
		h.sendDebouncedWarning(c.Request.Context(), payload.From)
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
		if _, loaded := processedMu.LoadOrStore(msgID, time.Now()); loaded {
			log.Printf("🔁 [DEDUP] Mensagem %s já em processamento (in-memory) — ignorando duplicata", msgID)
			c.JSON(http.StatusOK, gin.H{"status": "duplicate"})
			return
		}

		// Database-backed deduplication & raw payload insertion (O Cartório / Imutável)
		rawPayloadID, err := h.cfg.SupabaseClient.InsertRawPayload(c.Request.Context(), msgID, rawBody, "whatsapp_evolution")
		if err != nil {
			if errors.Is(err, supabase.ErrDuplicateMessage) {
				log.Printf("🔁 [DEDUP] Mensagem %s já processada (raw_payloads unique constraint) — ignorando duplicata silenciosamente", msgID)
				c.JSON(http.StatusOK, gin.H{"status": "duplicate"})
				return
			}
			log.Printf("⚠️ [DEDUP] Falha ao persistir payload bruto: %v. Prosseguindo como tolerância a falhas.", err)
		} else {
			payload.RawPayloadID = rawPayloadID
			log.Printf("📥 [WEBHOOK] Payload bruto registrado com ID: %s", rawPayloadID)
		}

	}

	// 9. Rate limiting por produtor
	//
	// Vem DEPOIS do dedup de propósito. Uma retentativa de webhook da Evolution
	// é a mesma mensagem chegando de novo: se contasse cota, o produtor pagaria
	// por um retry que é nosso, não dele. Depois do passo 8, o que chega aqui é
	// mensagem nova.
	//
	// A chave é payload.From (a identidade do canal, LID ou telefone) e não o
	// telefone resolvido: resolver exigiria ida ao banco, e o ponto deste
	// limite é justamente cortar antes de gastar recurso.
	if decision, err := h.cfg.InboundLimiter.Allow(c.Request.Context(), payload.From); err != nil {
		// Degrada ABERTO — contrato de ports.RateLimiter. Redis fora do ar não
		// pode parar o recebimento de mensagens; a métrica com outcome="error"
		// é o que torna essa janela sem proteção visível.
		telemetry.RateLimitDecisionsTotal.WithLabelValues("phone", "error").Inc()
		slog.Warn("Rate limiter indisponível — deixando passar",
			slog.String("from", payload.From),
			slog.String("error", err.Error()))
	} else if !decision.Allowed {
		telemetry.RateLimitDecisionsTotal.WithLabelValues("phone", "throttled").Inc()
		telemetry.WebhookRequestsTotal.WithLabelValues("rate_limited", "evolution").Inc()
		log.Printf("🚦 [RATELIMIT] %s excedeu a cota — liberando em %s", payload.From, decision.RetryAfter.Round(time.Second))
		c.Header("Retry-After", strconv.Itoa(int(decision.RetryAfter.Seconds())+1))
		c.JSON(http.StatusTooManyRequests, gin.H{
			"status":      "rate_limited",
			"retry_after": decision.RetryAfter.Seconds(),
		})
		h.sendDebouncedWarning(c.Request.Context(), payload.From)
		return
	} else {
		telemetry.RateLimitDecisionsTotal.WithLabelValues("phone", "allowed").Inc()
	}

	// ─── HITL: SIM/NÃO & Two-Phase Commit intercept (before harness dispatch) ──
	// Check if this is a producer response to a pending HITL approval or mutation draft.
	if h.cfg.HITLController != nil && !payload.IsAudio && !payload.IsImage {
		verdict := ClassifyHITLResponse(payload.Body)
		if verdict != HITLVerdictAmbiguous {
			if h.handleHITLResponse(payload.From, verdict) {
				c.JSON(http.StatusOK, gin.H{"status": "hitl_processed"})
				return
			}
		}
	}
	// ─────────────────────────────────────────────────────────────────────────

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
			// Fallback automático para worker pool legada se o Enqueue falhar
			if errPool := h.legacyPool.Enqueue(*payload); errPool != nil {
				if errors.Is(errPool, ErrQueueFull) {
					log.Printf("⚠️ [WEBHOOK] Fila do Worker Pool cheia! Retornando 429 para a mensagem %s", payload.ID)
					h.sendDebouncedWarning(c.Request.Context(), payload.From)
					c.JSON(http.StatusTooManyRequests, gin.H{"status": "queue_full"})
					return
				}
			}
		} else {
			log.Printf("📬 [WEBHOOK] Mensagem %s enfileirada no Harness (from=%s)", payload.ID, payload.From)
		}
	} else {
		// Modo legado: worker pool em memória
		if errPool := h.legacyPool.Enqueue(*payload); errPool != nil {
			if errors.Is(errPool, ErrQueueFull) {
				log.Printf("⚠️ [WEBHOOK] Fila do Worker Pool cheia! Retornando 429 para a mensagem %s", payload.ID)
				h.sendDebouncedWarning(c.Request.Context(), payload.From)
				c.JSON(http.StatusTooManyRequests, gin.H{"status": "queue_full"})
				return
			}
		} else {
			log.Printf("📬 [WEBHOOK] Mensagem %s enfileirada no MemoryWorkerPool", payload.ID)
		}
	}

	// 9. Always Respond 200 OK
	telemetry.WebhookRequestsTotal.WithLabelValues("success", "evolution").Inc()
	slog.Info("Webhook 200 OK",
		slog.String("msg_id", payload.ID),
		slog.String("from", payload.From),
	)
	c.JSON(http.StatusOK, gin.H{
		"status": "processed",
		"from":   payload.From,
	})
}

// Shutdown initiates a graceful shutdown of the handler components.
func (h *Handler) Shutdown(ctx context.Context) error {
	log.Println("⚠️ [Handler] Iniciando shutdown do Handler...")
	if h.legacyPool != nil {
		return h.legacyPool.Shutdown(ctx)
	}
	return nil
}

// handleHealth is a simple liveness probe.
func (h *Handler) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// handleHITLResponse processes a normalized APPROVE/REJECT reply from a producer.
// It checks first for pending Two-Phase Commit mutation drafts (Fase 2.2),
// then falls back to legacy single-tool HITL records.
// If an affirmative/rejection response was explicit but no draft exists or is expired,
// it informs the user and returns true to short-circuit.
func (h *Handler) handleHITLResponse(phone string, verdict HITLVerdict) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	phone = utils.SanitizePhone(phone)

	// 1. Resolve active profile to obtain PMO ID
	var pmoID int64
	var userID string
	if h.cfg.SupabaseClient != nil {
		profile, err := h.cfg.SupabaseClient.GetProfileByPhone(phone)
		if err == nil && profile != nil {
			pmoID = int64(profile.PmoAtivoID)
			userID = profile.ID
		}
	}

	// Sem cadastro, não existe rascunho ou aprovação HITL possível — um
	// "SIM"/"NÃO" nesse caso é resposta a uma pergunta de outro fluxo (ex.:
	// onboarding perguntando "você já tem cadastro?"), não uma confirmação
	// de rascunho. Sem este corte, esse handler sequestrava a resposta e
	// respondia com "não encontrei rascunho pendente", impedindo o
	// onboarding de avançar (visto em produção com número sem cadastro).
	if userID == "" {
		return false
	}

	// 2. Check for pending Two-Phase Commit mutation draft (Fase 2.2)
	if pmoID > 0 {
		draft, err := h.cfg.HITLController.FindPendingDraft(ctx, phone, pmoID)
		if err != nil {
			log.Printf("⚠️ [HITL] Erro ao buscar rascunho pendente para %s (PMO %d): %v", phone, pmoID, err)
		} else if draft != nil {
			log.Printf("🔔 [HITL] Rascunho encontrado: draft_id=%s phone=%s verdict=%s", draft.ID, phone, verdict)

			if verdict == HITLVerdictReject {
				if err := h.cfg.HITLController.RejectDraft(ctx, draft.ID); err != nil {
					log.Printf("⚠️ [HITL] Erro ao rejeitar rascunho: %v", err)
				}
				if h.cfg.WhatsAppClient != nil {
					_ = h.cfg.WhatsAppClient.SendMessage(phone,
						"✅ Rascunho de operações cancelado. Nenhuma alteração foi salva no sistema.")
				}
				return true
			}

			if verdict == HITLVerdictApprove {
				commitRes, err := h.cfg.HITLController.CommitDraft(ctx, draft.ID, userID, pmoID)
				if err != nil {
					log.Printf("❌ [HITL] Erro técnico no commit do rascunho %s: %v", draft.ID, err)
					if h.cfg.WhatsAppClient != nil {
						_ = h.cfg.WhatsAppClient.SendMessage(phone,
							"⚠️ Ocorreu um erro técnico ao registrar as operações. Por favor, tente novamente.")
					}
					return true
				}

				if commitRes.Status == "failed" {
					log.Printf("⚠️ [HITL] Commit falhou para rascunho %s: %s", draft.ID, commitRes.ErrorDetail)
					if h.cfg.WhatsAppClient != nil {
						errMsg := fmt.Sprintf("⚠️ Não foi possível salvar o lote de operações: %s\n\nPor favor, envie novamente com os dados ajustados.", commitRes.ErrorDetail)
						_ = h.cfg.WhatsAppClient.SendMessage(phone, errMsg)
					}
					return true
				}

				if commitRes.Status == "expired" {
					log.Printf("⚠️ [HITL] Rascunho %s expirou antes da confirmação", draft.ID)
					if h.cfg.WhatsAppClient != nil {
						_ = h.cfg.WhatsAppClient.SendMessage(phone,
							"⚠️ O tempo limite para confirmação deste rascunho (45 minutos) expirou. Por favor, envie novamente as informações da operação.")
					}
					return true
				}

				// Sucesso
				log.Printf("✅ [HITL] Rascunho %s aprovado e comitado com sucesso", draft.ID)
				if h.cfg.WhatsAppClient != nil {
					_ = h.cfg.WhatsAppClient.SendMessage(phone,
						"✅ *Operações confirmadas e registradas com sucesso!*\n\n🌱 Seu caderno de campo e registros foram atualizados.")
				}
				return true
			}
		}
	}

	// 3. Fallback: check legacy single-tool HITL records (hitl_pending)
	rec, err := h.cfg.HITLController.FindPendingByPhone(ctx, phone)
	if err != nil {
		log.Printf("⚠️ [HITL] Erro ao buscar aprovação legada para %s: %v", phone, err)
		return false
	}

	if rec != nil {
		log.Printf("🔔 [HITL] Registro legado encontrado: token=%s tool=%s phone=%s verdict=%s", rec.ID, rec.ToolName, phone, verdict)
		if verdict == HITLVerdictReject {
			if err := h.cfg.HITLController.Reject(ctx, rec.ID); err != nil {
				log.Printf("⚠️ [HITL] Erro ao rejeitar: %v", err)
			}
			if h.cfg.WhatsAppClient != nil {
				_ = h.cfg.WhatsAppClient.SendMessage(phone,
					"✅ Operação cancelada conforme solicitado. Nenhuma alteração foi registrada no sistema.")
			}
			return true
		}

		if verdict == HITLVerdictApprove {
			toolName, toolArgs, err := h.cfg.HITLController.Approve(ctx, rec.ID)
			if err != nil {
				log.Printf("❌ [HITL] Erro ao aprovar registro legado: %v", err)
				if h.cfg.WhatsAppClient != nil {
					_ = h.cfg.WhatsAppClient.SendMessage(phone,
						"⚠️ Ocorreu um erro ao processar sua confirmação. Por favor, tente registrar novamente.")
				}
				return true
			}

			toolCtx, toolCancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer toolCancel()

			recPmoID := int64(0)
			if rec.PmoID != nil {
				recPmoID = *rec.PmoID
			}
			profile := &supabase.Profile{
				ID:         rec.UserID,
				PmoAtivoID: recPmoID,
			}

			guard := mcp.NewLoopGuard(3)
			result, toolErr := h.cfg.MCPServer.CallToolWithGuard(toolCtx, guard, toolName, toolArgs, profile)
			_ = result

			if toolErr != nil {
				log.Printf("❌ [HITL] Execução da ferramenta legada %s falhou: %v", toolName, toolErr)
				if h.cfg.WhatsAppClient != nil {
					_ = h.cfg.WhatsAppClient.SendMessage(phone,
						fmt.Sprintf("❌ Ocorreu um erro ao executar o registro aprovado: %v\nPor favor, tente novamente.", toolErr))
				}
				return true
			}

			msg := "✅ *Operação confirmada e registrada com sucesso!*\n\n🌱 Seu caderno de campo foi atualizado."
			if resMap, ok := result.(map[string]interface{}); ok {
				if successMsg, ok := resMap["message"].(string); ok && successMsg != "" {
					msg = "✅ " + successMsg
				}
			}
			if h.cfg.WhatsAppClient != nil {
				_ = h.cfg.WhatsAppClient.SendMessage(phone, msg)
			}
			return true
		}
	}

	return false
}

// processLegacy executa o fluxo de processamento legado (goroutine direta, sem persistência).
// Usado quando HARNESS_ENABLED=false ou como fallback automático se o Enqueue falhar.
// O comportamento é idêntico ao que existia antes do Harness.
func (h *Handler) processLegacy(msg ports.IncomingMessage) {
	log.Printf("[ASYNC] Iniciando Agentic Loop em background...")
	go h.cfg.WhatsAppClient.SetPresence(msg.From, "composing")
	defer h.cfg.WhatsAppClient.SetPresence(msg.From, "available")

	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 [CRITICAL] Panic no processamento legado: %v", r)
			h.cfg.WhatsAppClient.SendMessage(msg.From, "⚠️ Ocorreu um erro crítico inesperado. Minha equipe foi avisada.")
			if msg.RawPayloadID != "" {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				_ = h.cfg.SupabaseClient.UpdateRawPayloadStatus(ctx, msg.RawPayloadID, "FAILED", fmt.Sprintf("panic: %v", r))
			}
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	if msg.RawPayloadID != "" {
		ctx = context.WithValue(ctx, "raw_payload_id", msg.RawPayloadID)
	}

	routerCfg := state.RouterConfig{
		EnableFastRouter:       h.cfg.EnableFastRouter,
		EnableFastRouterShadow: h.cfg.EnableFastRouterShadow,
		FastRouterTimeoutMS:    h.cfg.FastRouterTimeoutMS,
	}

	result := state.ProcessMessage(ctx, msg, h.cfg.SupabaseClient, h.cfg.GroqClient, h.cfg.WhatsAppClient, h.cfg.LLMClient, h.cfg.TtsClient, h.cfg.MCPServer, h.cfg.HistoryManager, h.cfg.FlagsmithClient, routerCfg)
	if msg.RawPayloadID != "" {
		if !result.Success {
			log.Printf("⚠️ [LEGACY] Processing completed with issues: %s", result.Reason)
			_ = h.cfg.SupabaseClient.UpdateRawPayloadStatus(ctx, msg.RawPayloadID, "FAILED", result.Reason)
		} else {
			_ = h.cfg.SupabaseClient.UpdateRawPayloadStatus(ctx, msg.RawPayloadID, "PROCESSED", "")
		}
	} else if !result.Success {
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
	var failedCount int64

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

					// Wrap in a function to easily defer the progress update
					func() {
						defer func() {
							newCount := atomic.AddInt64(&processedCount, 1)
							// Update progress periodically or on completion
							if jobID != "" && (newCount%5 == 0 || int(newCount) == totalChunks) {
								h.cfg.SupabaseClient.UpdateJobProgress(jobID, int(newCount), totalChunks)
							}
						}()

						// Rate Limiting
						if err := h.limiter.Wait(ctx); err != nil {
							log.Printf("⚠️ [Worker-%d] Rate limiter error: %v", workerID, err)
							cancel() // Fail-fast
							return
						}

						// Generate Embedding
						embedding, err := h.cfg.SupabaseClient.GetEmbedding(chunk, "BASE_CONHECIMENTO")
						if err != nil {
							log.Printf("⚠️ [Worker-%d] Erro ao gerar embedding para chunk %d: %v", workerID, j.index, err)
							if strings.Contains(err.Error(), "429") {
								log.Printf("🚫 [Worker-%d] Rate limit hit (429). Retrying after brief pause...", workerID)
								time.Sleep(2 * time.Second)
								embedding, err = h.cfg.SupabaseClient.GetEmbedding(chunk, "BASE_CONHECIMENTO")
								if err != nil {
									log.Printf("❌ [Worker-%d] Retry failed for chunk %d: %v", workerID, j.index, err)
									atomic.AddInt64(&failedCount, 1)
									return
								}
							} else {
								atomic.AddInt64(&failedCount, 1)
								return
							}
						}

						// Create chunk hash (same logic as ingestor)
						hasher := sha256.New()
						hasher.Write([]byte(chunk))
						chunkHash := hex.EncodeToString(hasher.Sum(nil))

						var pmoPtr *int64
						if pmoID > 0 {
							pmoPtr = &pmoID
						}

						doc := supabase.FarmDocument{
							PmoID:         pmoPtr,
							DocumentName:  originalName,
							Content:       chunk,
							Embedding1024: embedding,
							ChunkHash:     chunkHash,
							ChunkIndex:    j.index,
						}

						// Insert directly into DB via upsert (dedup by chunk_hash)
						if err := h.cfg.SupabaseClient.UpsertFarmDocumentChunks([]supabase.FarmDocument{doc}); err != nil {
							log.Printf("⚠️ [Worker-%d] Erro ao inserir chunk %d no Supabase: %v", workerID, j.index, err)
							atomic.AddInt64(&failedCount, 1)
						} else {
							log.Printf("✅ [Worker-%d] Chunk %d inserido com sucesso", workerID, j.index)
						}
					}()
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
		failed := atomic.LoadInt64(&failedCount)
		succeeded := int64(totalChunks) - failed

		status := "completed"
		errMsg := ""
		if failed > 0 {
			log.Printf("⚠️ [ASYNC-RAG] Processamento concluído com lacunas: %d/%d chunks falharam", failed, totalChunks)
			errMsg = fmt.Sprintf("%d/%d chunks falharam ao gerar embedding ou salvar", failed, totalChunks)
			if succeeded <= 0 {
				status = "failed"
			}
		}
		h.cfg.SupabaseClient.FinishJob(jobID, status, errMsg)
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

// sendDebouncedWarning envia uma mensagem de erro proativa via WhatsApp quando o 
// produtor sofre um rate limit ou a fila enche. O debounce usa o WarningLimiter 
// para garantir que o usuário receba no máximo 1 aviso a cada X minutos.
func (h *Handler) sendDebouncedWarning(ctx context.Context, from string) {
	if h.cfg.WhatsAppClient == nil {
		return
	}
	decision, err := h.cfg.WarningLimiter.Allow(ctx, from)
	if err != nil {
		log.Printf("⚠️ [WarningLimiter] Falha ao checar debounce (error: %v), omitindo aviso para %s", err, from)
		return
	}
	if decision.Allowed {
		msg := "⚠️ Detectamos um alto volume de requisições ou uma pequena instabilidade momentânea. Por favor, aguarde alguns instantes e reenvie sua última mensagem. Agradecemos a compreensão."
		if err := h.cfg.WhatsAppClient.SendMessage(from, msg); err != nil {
			log.Printf("⚠️ [WarningLimiter] Falha ao enviar aviso para %s: %v", from, err)
		} else {
			log.Printf("📣 [WarningLimiter] Aviso de instabilidade/cota enviado para %s", from)
		}
	}
}
