package ports

import (
	"context"
	"time"
)

type MemoryFragment struct {
	ID              string
	Fragment        string
	Category        string
	ImportanceScore float64
	Similarity      float64   // 0 quando vem do Redis sem busca semântica
	Source          string    // "redis_recent" | "redis_scored" | "supabase"
	CreatedAt       time.Time // necessário para relativeTime() no prompt
	ContentHash     string    // SHA-256 do texto normalizado para dedup
}

type MemoryCacheWriter interface {
	WriteFragmentAsync(ctx context.Context, pmoID int64, userID string, text string, source string)
}

type MemoryCacheReader interface {
	GetActiveContext(ctx context.Context, pmoID int64, queryText string) ([]MemoryFragment, error)
}

type MemoryCacheService interface {
	MemoryCacheWriter
	MemoryCacheReader
}

// NoopMemoryCacheService — degradação aberta quando Redis/Supabase indisponíveis
type NoopMemoryCacheService struct{}

func (NoopMemoryCacheService) WriteFragmentAsync(_ context.Context, _ int64, _, _, _ string) {}

func (NoopMemoryCacheService) GetActiveContext(_ context.Context, _ int64, _ string) ([]MemoryFragment, error) {
	return nil, nil
}
