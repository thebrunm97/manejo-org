package middleware

// RateLimit (DT-120): o grupo /api/v1 (gatewayHandler, producerGroup) tinha
// só RequireAuth, sem nenhum teto de cota — ao contrário do webhook do
// WhatsApp e das rotas de satélite (internal/api/map_handler.go), que já
// protegem a cota do Earth Engine com ports.RateLimiter. Um produtor
// autenticado (ou um token vazado) podia bater as RPCs do gateway sem
// limite algum.
//
// Segue o mesmo padrão do MapHandler: nasce com NoopRateLimiter (a rota
// existe antes do Redis estar pronto em main.go) e o limiter real é trocado
// via SetLimiter assim que o boot souber se há Redis configurado.

import (
	"log"
	"net/http"
	"strconv"
	"sync/atomic"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// RateLimitBox guarda um ports.RateLimiter trocável após a criação do
// middleware, para acomodar a ordem de boot em main.go (as rotas são
// registradas antes do Redis estar disponível).
type RateLimitBox struct {
	limiter atomic.Value // ports.RateLimiter
}

// NewRateLimitBox cria uma box já com NoopRateLimiter — nunca fica nil.
func NewRateLimitBox() *RateLimitBox {
	b := &RateLimitBox{}
	b.limiter.Store(ports.RateLimiter(ports.NoopRateLimiter{}))
	return b
}

// SetLimiter troca o limiter. Seguro para ser chamado uma vez durante o
// boot, antes do servidor aceitar tráfego real.
func (b *RateLimitBox) SetLimiter(l ports.RateLimiter) {
	if l != nil {
		b.limiter.Store(l)
	}
}

// Middleware limita por sub do JWT (ContextUserID, já populado por
// RequireAuth — este middleware deve vir depois dele na cadeia). Cai para o
// IP quando, por algum motivo, o contexto não tem o sub. Degrada ABERTO
// conforme o contrato de ports.RateLimiter: falha do backend deixa passar.
func (b *RateLimitBox) Middleware(operacao string) gin.HandlerFunc {
	return func(c *gin.Context) {
		limiter := b.limiter.Load().(ports.RateLimiter)

		userID := c.GetString(ContextUserID)
		if userID == "" {
			userID = c.ClientIP()
		}

		decisao, err := limiter.Allow(c.Request.Context(), operacao+":"+userID)
		if err != nil {
			log.Printf("⚠️ [RateLimit] Falha ao consultar limiter para %s (%v) — deixando passar", operacao, err)
			c.Next()
			return
		}

		if !decisao.Allowed {
			c.Header("Retry-After", strconv.Itoa(int(decisao.RetryAfter.Seconds())+1))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "Muitas requisições em pouco tempo. Aguarde um instante.",
				"retry_after": int(decisao.RetryAfter.Seconds()) + 1,
			})
			return
		}

		c.Next()
	}
}
