package embedcache

import (
	"crypto/sha256"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"golang.org/x/sync/singleflight"
)

type cacheEntry struct {
	vector    []float32
	expiresAt time.Time
}

// CachedEmbedder wraps an mcp.Embedder providing an in-memory cache with TTL.
// It uses singleflight to avoid the "Thundering Herd" problem when multiple
// concurrent requests ask for the same embedding on a cache miss.
type CachedEmbedder struct {
	delegate mcp.Embedder
	mu       sync.RWMutex
	cache    map[string]cacheEntry
	ttl      time.Duration
	group    singleflight.Group
}

// NewCachedEmbedder creates a new decorator for Embedder with the given TTL.
// It also starts a background goroutine (Janitor) to clean up expired entries.
func NewCachedEmbedder(delegate mcp.Embedder, ttl time.Duration) *CachedEmbedder {
	ce := &CachedEmbedder{
		delegate: delegate,
		cache:    make(map[string]cacheEntry),
		ttl:      ttl,
	}

	// Start Janitor to prevent memory leaks
	go ce.janitor()

	return ce
}

// key normalizes the query and generates a SHA-256 hash to be used as cache key.
func (c *CachedEmbedder) key(query string) string {
	normalized := strings.ToLower(strings.TrimSpace(query))
	h := sha256.Sum256([]byte(normalized))
	return fmt.Sprintf("%x", h)
}

// GenerateQueryEmbedding implements mcp.Embedder.
// It returns a cached embedding if valid, otherwise calls the delegate.
func (c *CachedEmbedder) GenerateQueryEmbedding(query string) ([]float32, error) {
	k := c.key(query)

	// Fast path: read lock
	c.mu.RLock()
	entry, found := c.cache[k]
	c.mu.RUnlock()

	if found && time.Now().Before(entry.expiresAt) {
		slog.Debug("EmbedCache Hit", slog.String("key", k))
		return entry.vector, nil
	}

	slog.Debug("EmbedCache Miss", slog.String("key", k))

	// Cache miss: use singleflight to collapse multiple concurrent identical queries
	result, err, _ := c.group.Do(k, func() (interface{}, error) {
		vec, delegateErr := c.delegate.GenerateQueryEmbedding(query)
		if delegateErr != nil {
			return nil, delegateErr
		}

		// Store in cache
		c.mu.Lock()
		c.cache[k] = cacheEntry{
			vector:    vec,
			expiresAt: time.Now().Add(c.ttl),
		}
		c.mu.Unlock()

		return vec, nil
	})

	if err != nil {
		return nil, err
	}

	return result.([]float32), nil
}

// GenerateEmbedding implements mcp.Embedder.
// It delegates directly to the underlying embedder without caching,
// since this is typically used for indexation (ingestor) rather than query.
func (c *CachedEmbedder) GenerateEmbedding(text string) ([]float32, error) {
	return c.delegate.GenerateEmbedding(text)
}

// janitor periodically scans the cache and removes expired entries.
func (c *CachedEmbedder) janitor() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		
		c.mu.Lock()
		for k, v := range c.cache {
			if now.After(v.expiresAt) {
				delete(c.cache, k)
			}
		}
		c.mu.Unlock()
	}
}
