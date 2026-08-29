package redisstore_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/adapter/redisstore"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// setupLimiter conecta no Redis de teste e devolve um limiter com chave única
// por execução, para que rodadas concorrentes não briguem pelo mesmo contador.
//
// Segue a convenção dos testes de integração do repositório (ver
// internal/mcp/tools_producao_test.go): sem a env var da infra, pula.
func setupLimiter(t *testing.T, limit int, window time.Duration) (ports.RateLimiter, string) {
	t.Helper()

	url := os.Getenv("REDIS_TEST_URL")
	if url == "" {
		t.Skip("REDIS_TEST_URL não configurado — pulando teste de integração com Redis")
	}

	client, err := redisstore.New(context.Background(), url)
	if err != nil {
		t.Fatalf("Falha ao conectar no Redis: %v", err)
	}
	t.Cleanup(func() { client.Close() })

	prefix := fmt.Sprintf("test:ratelimit:%d", time.Now().UnixNano())
	return redisstore.NewRateLimiter(client, prefix, limit, window), "5511999999999"
}

func TestRateLimiter_PermiteAteOTetoDaJanela(t *testing.T) {
	limiter, key := setupLimiter(t, 3, time.Minute)
	ctx := context.Background()

	for i := 1; i <= 3; i++ {
		decision, err := limiter.Allow(ctx, key)
		if err != nil {
			t.Fatalf("chamada %d: erro inesperado: %v", i, err)
		}
		if !decision.Allowed {
			t.Fatalf("chamada %d de 3 deveria ser permitida, foi negada", i)
		}
		if want := 3 - i; decision.Remaining != want {
			t.Errorf("chamada %d: Remaining = %d, esperado %d", i, decision.Remaining, want)
		}
	}
}

func TestRateLimiter_NegaAcimaDoTeto(t *testing.T) {
	limiter, key := setupLimiter(t, 2, time.Minute)
	ctx := context.Background()

	for i := 0; i < 2; i++ {
		if _, err := limiter.Allow(ctx, key); err != nil {
			t.Fatalf("consumo da cota: %v", err)
		}
	}

	decision, err := limiter.Allow(ctx, key)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if decision.Allowed {
		t.Fatal("a 3ª chamada com teto 2 deveria ser negada")
	}
	if decision.Remaining != 0 {
		t.Errorf("Remaining = %d, esperado 0 quando negado", decision.Remaining)
	}
	// RetryAfter guia o header Retry-After no handler: zero ou negativo viraria
	// um Retry-After inútil.
	if decision.RetryAfter <= 0 || decision.RetryAfter > time.Minute {
		t.Errorf("RetryAfter = %s, esperado entre 0 e 1min", decision.RetryAfter)
	}
}

func TestRateLimiter_IsolaChavesDiferentes(t *testing.T) {
	limiter, key := setupLimiter(t, 1, time.Minute)
	ctx := context.Background()

	if _, err := limiter.Allow(ctx, key); err != nil {
		t.Fatalf("consumo da cota: %v", err)
	}

	// Um telefone estourando a cota não pode bloquear outro — é o requisito que
	// motivou o limite por produtor em vez do 429 global de fila cheia.
	decision, err := limiter.Allow(ctx, "5511888888888")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !decision.Allowed {
		t.Fatal("chave distinta foi bloqueada pela cota de outra chave")
	}
}

func TestRateLimiter_LiberaAposAJanelaExpirar(t *testing.T) {
	limiter, key := setupLimiter(t, 1, 500*time.Millisecond)
	ctx := context.Background()

	if _, err := limiter.Allow(ctx, key); err != nil {
		t.Fatalf("consumo da cota: %v", err)
	}
	if decision, _ := limiter.Allow(ctx, key); decision.Allowed {
		t.Fatal("2ª chamada dentro da janela deveria ser negada")
	}

	// Prova que o PEXPIRE do script foi aplicado: sem ele o contador seria
	// imortal e a chave ficaria bloqueada para sempre.
	time.Sleep(700 * time.Millisecond)

	decision, err := limiter.Allow(ctx, key)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !decision.Allowed {
		t.Fatal("após a janela expirar a chamada deveria ser permitida")
	}
}

func TestNoopRateLimiter_PermiteSempre(t *testing.T) {
	var limiter ports.RateLimiter = ports.NoopRateLimiter{}

	for i := 0; i < 100; i++ {
		decision, err := limiter.Allow(context.Background(), "qualquer")
		if err != nil {
			t.Fatalf("Noop nunca deve errar, errou na chamada %d: %v", i, err)
		}
		if !decision.Allowed {
			t.Fatalf("Noop negou na chamada %d", i)
		}
	}
}
