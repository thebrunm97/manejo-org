package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

type negaTudoLimiter struct{}

func (negaTudoLimiter) Allow(context.Context, string) (ports.RateLimitDecision, error) {
	return ports.RateLimitDecision{Allowed: false}, nil
}

// Regressão do panic de boot: a box nasce com NoopRateLimiter e o main.go
// troca por outro tipo concreto (o limiter do Redis). Com atomic.Value isso
// dava "store of inconsistently typed value into Value" e derrubava o bot.
func TestRateLimitBox_SetLimiterComOutroTipoNaoEntraEmPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	box := NewRateLimitBox()

	box.SetLimiter(negaTudoLimiter{})

	r := gin.New()
	r.GET("/x", box.Middleware("teste"), func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("esperava 429 do limiter trocado, veio %d", w.Code)
	}
}

func TestRateLimitBox_SemSetLimiterDeixaPassar(t *testing.T) {
	gin.SetMode(gin.TestMode)
	box := NewRateLimitBox()

	r := gin.New()
	r.GET("/x", box.Middleware("teste"), func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("esperava 200 com NoopRateLimiter, veio %d", w.Code)
	}
}
