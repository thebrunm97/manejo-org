// Package redisstore concentra o acesso ao Redis: conexão, configuração e os
// adapters que implementam as interfaces de internal/ports.
//
// É o único pacote que importa github.com/redis/go-redis. Qualquer outro lugar
// do sistema fala com Redis através de uma interface de `ports`, para que trocar
// o backend (ou removê-lo) seja uma mudança de wiring em cmd/server/main.go.
package redisstore

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client envolve o cliente go-redis com os defaults da casa.
type Client struct {
	rdb *redis.Client
}

// dialTimeout e opTimeout são curtos de propósito: este Redis fica na mesma
// rede Docker (pmo_prod_net), então qualquer coisa acima disso é falha, não
// lentidão. O caminho quente é o handler do webhook, que precisa devolver 200
// rápido — esperar segundos por um contador seria pior que não ter contador.
const (
	dialTimeout = 2 * time.Second
	opTimeout   = 200 * time.Millisecond
)

// New conecta ao Redis a partir de uma URL no formato redis://host:port/db e
// valida a conexão com um PING antes de devolver.
//
// Retorna erro em vez de client degradado: quem chama (main.go) decide se
// segue sem Redis, e essa decisão deve ser explícita e logada, não silenciosa.
func New(ctx context.Context, url string) (*Client, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("redis: URL inválida: %w", err)
	}

	opts.DialTimeout = dialTimeout
	opts.ReadTimeout = opTimeout
	opts.WriteTimeout = opTimeout

	rdb := redis.NewClient(opts)

	pingCtx, cancel := context.WithTimeout(ctx, dialTimeout)
	defer cancel()

	if err := rdb.Ping(pingCtx).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("redis: ping falhou: %w", err)
	}

	return &Client{rdb: rdb}, nil
}

// Close encerra o pool de conexões.
func (c *Client) Close() error {
	return c.rdb.Close()
}
