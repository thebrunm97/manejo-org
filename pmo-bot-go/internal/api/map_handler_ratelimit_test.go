package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/middleware"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// limiterFalso permite decidir o veredito por teste, inclusive o caso de falha
// de infraestrutura — que é o mais importante aqui, porque o contrato manda
// degradar ABERTO.
type limiterFalso struct {
	decisao ports.RateLimitDecision
	err     error
	chamado int
	chave   string
}

func (l *limiterFalso) Allow(_ context.Context, key string) (ports.RateLimitDecision, error) {
	l.chamado++
	l.chave = key
	return l.decisao, l.err
}

func novoContexto(t *testing.T, h *MapHandler, userID string) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/maps/zonal", strings.NewReader(`{"date":"2026-06","talhoes":[]}`))
	c.Request.Header.Set("Content-Type", "application/json")
	if userID != "" {
		c.Set(middleware.ContextUserID, userID)
	}
	return rec, c
}

func TestZonalStats_NegaQuandoCotaEstourou(t *testing.T) {
	limiter := &limiterFalso{decisao: ports.RateLimitDecision{Allowed: false, RetryAfter: 30 * time.Second}}
	h := NewMapHandler(nil)
	h.SetRateLimiter(limiter)

	rec, c := novoContexto(t, h, "usuario-1")
	h.ZonalStats(c)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("esperava 429, veio %d", rec.Code)
	}
	if got := rec.Header().Get("Retry-After"); got != "31" {
		t.Errorf("Retry-After esperado 31, veio %q", got)
	}
	if limiter.chave != "zonal:usuario-1" {
		t.Errorf("chave esperada zonal:usuario-1, veio %q", limiter.chave)
	}
}

func TestZonalStats_DegradaAbertoQuandoLimiterFalha(t *testing.T) {
	// Redis fora do ar não pode derrubar o mapa: o contrato de
	// ports.RateLimiter manda deixar passar.
	limiter := &limiterFalso{err: errors.New("redis indisponível")}
	h := NewMapHandler(nil)
	h.SetRateLimiter(limiter)

	rec, c := novoContexto(t, h, "usuario-1")
	h.ZonalStats(c)

	if rec.Code == http.StatusTooManyRequests {
		t.Fatalf("não deveria negar por falha de infraestrutura, veio %d", rec.Code)
	}
	if limiter.chamado != 1 {
		t.Errorf("limiter deveria ter sido consultado uma vez, foi %d", limiter.chamado)
	}
}

func TestZonalStats_SemUsuarioUsaIP(t *testing.T) {
	limiter := &limiterFalso{decisao: ports.RateLimitDecision{Allowed: true}}
	h := NewMapHandler(nil)
	h.SetRateLimiter(limiter)

	rec, c := novoContexto(t, h, "")
	h.ZonalStats(c)

	if rec.Code == http.StatusTooManyRequests {
		t.Fatalf("não deveria negar, veio %d", rec.Code)
	}
	if !strings.HasPrefix(limiter.chave, "zonal:") || limiter.chave == "zonal:" {
		t.Errorf("sem user id a chave deveria cair no IP, veio %q", limiter.chave)
	}
}

func TestNewMapHandler_PermiteSemLimiterConfigurado(t *testing.T) {
	// Sem Redis o handler nasce com NoopRateLimiter: nunca nil, nunca negando.
	h := NewMapHandler(nil)

	rec, c := novoContexto(t, h, "usuario-1")
	h.ZonalStats(c)

	if rec.Code == http.StatusTooManyRequests {
		t.Fatalf("handler sem Redis não deveria negar, veio %d", rec.Code)
	}
}
