package api

import (
	"crypto/rand"
	"encoding/base64"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// AuthHandler gerencia rotas de autenticação
type AuthHandler struct {
	sbClient *supabase.Client
	limiter  ports.RateLimiter
}

// NewAuthHandler cria um novo handler de autenticação
func NewAuthHandler(sbClient *supabase.Client, limiter ports.RateLimiter) *AuthHandler {
	return &AuthHandler{
		sbClient: sbClient,
		limiter:  limiter,
	}
}

// ExchangeTokenRequest define o payload esperado
type ExchangeTokenRequest struct {
	Code string `json:"code" binding:"required"`
}

// Exchange realiza a troca do código opaco por uma sessão
func (h *AuthHandler) Exchange(c *gin.Context) {
	// Rate Limiting (por IP)
	ip := c.ClientIP()
	decision, errLimiter := h.limiter.Allow(c.Request.Context(), ip)
	if errLimiter == nil && !decision.Allowed {
		log.Printf("⚠️ [Auth] Rate limit excedido para IP %s", ip)
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "muitas tentativas, tente novamente em alguns minutos"})
		return
	}

	var req ExchangeTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "código inválido ou ausente"})
		return
	}

	code := strings.TrimSpace(req.Code)
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "código vazio"})
		return
	}

	// 1. Tentar consumir o token no banco (atômico)
	userID, err := h.sbClient.ExchangeOpaqueToken(code)
	if err != nil {
		log.Printf("⚠️ [Auth] ExchangeOpaqueToken falhou: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "código inválido, expirado ou já utilizado"})
		return
	}

	// 2. Gerar senha forte criptográfica (32 bytes -> 43 chars base64)
	passBytes := make([]byte, 32)
	if _, randErr := rand.Read(passBytes); randErr != nil {
		log.Printf("🔥 [Auth] Falha na geração de entropia: %v", randErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro interno de servidor"})
		return
	}
	newPassword := base64.RawURLEncoding.EncodeToString(passBytes)

	// 3. Atualizar senha e realizar login imediatamente
	// IMPORTANTE: a senha newPassword nunca é registrada (logada) em nenhum lugar.
	session, errLogin := h.sbClient.UpdateUserPasswordAndLogin(userID, newPassword)
	if errLogin != nil {
		// Embora raro, pode falhar por indisponibilidade momentânea da GoTrue
		// Como o token já foi consumido na etapa 1, ele está perdido.
		// O usuário terá que gerar outro clicando no WhatsApp novamente,
		// o que cumpre o critério de segurança idempotente (novo token necessário).
		log.Printf("⚠️ [Auth] UpdateUserPasswordAndLogin falhou para %s: %v", userID, errLogin)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erro durante login"})
		return
	}

	log.Printf("✅ [Auth] Código trocado com sucesso, sessão emitida para usuário %s", userID)
	c.JSON(http.StatusOK, session)
}

