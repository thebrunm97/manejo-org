package redisstore

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// RateLimiter implementa ports.RateLimiter com janela fixa no Redis.
//
// # Por que janela fixa, e não token bucket
//
// Janela fixa cabe em um INCR + PEXPIRE, ou seja, uma ida ao Redis, sem estado
// além de um inteiro por chave. O custo é o efeito de borda conhecido: quem
// gastar a cota no fim de uma janela e de novo no início da seguinte consegue
// até 2×Limit num intervalo curto. Para o propósito aqui — conter um produtor
// em loop, não impor uma cota comercial exata — isso é irrelevante.
//
// Se algum dia o limite virar contrato de billing, trocar por sliding window
// log ou token bucket é substituir este arquivo, sem tocar em quem chama.
type RateLimiter struct {
	rdb    *redis.Client
	prefix string
	limit  int
	window time.Duration
}

// incrWithTTL é atômico de propósito. Feito com dois comandos soltos, um crash
// entre o INCR e o PEXPIRE deixaria uma chave sem TTL — um contador imortal que
// bloquearia aquele telefone para sempre. O script garante que a primeira
// escrita de uma janela sempre nasce com expiração.
//
// Retorna {contagem_atual, ttl_restante_ms}.
var incrWithTTL = redis.NewScript(`
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {current, redis.call('PTTL', KEYS[1])}
`)

// NewRateLimiter cria um limiter que permite `limit` eventos por `window` para
// cada chave. `prefix` isola o namespace (ex.: "ratelimit:phone").
func NewRateLimiter(c *Client, prefix string, limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		rdb:    c.rdb,
		prefix: prefix,
		limit:  limit,
		window: window,
	}
}

// Allow implementa ports.RateLimiter.
//
// Em erro devolve a decisão zerada junto com o erro: cabe ao chamador degradar
// aberto, como manda o contrato de ports.RateLimiter.
func (r *RateLimiter) Allow(ctx context.Context, key string) (ports.RateLimitDecision, error) {
	redisKey := fmt.Sprintf("%s:%s", r.prefix, key)

	res, err := incrWithTTL.Run(ctx, r.rdb, []string{redisKey}, r.window.Milliseconds()).Int64Slice()
	if err != nil {
		return ports.RateLimitDecision{}, fmt.Errorf("redis: rate limit em %q: %w", redisKey, err)
	}
	if len(res) != 2 {
		return ports.RateLimitDecision{}, fmt.Errorf("redis: resposta inesperada do script (%d valores)", len(res))
	}

	count, ttlMS := res[0], res[1]

	remaining := r.limit - int(count)
	if remaining < 0 {
		remaining = 0
	}

	if count <= int64(r.limit) {
		return ports.RateLimitDecision{Allowed: true, Remaining: remaining}, nil
	}

	// PTTL devolve negativo se a chave sumiu entre o INCR e a leitura (corrida
	// rara com a expiração). Tratamos como "janela inteira" para nunca devolver
	// um Retry-After negativo.
	retryAfter := r.window
	if ttlMS > 0 {
		retryAfter = time.Duration(ttlMS) * time.Millisecond
	}

	return ports.RateLimitDecision{Allowed: false, Remaining: 0, RetryAfter: retryAfter}, nil
}
