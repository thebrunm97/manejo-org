package tts

import (
	"context"
	"errors"
	"fmt"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ErrCacheMiss indica que o áudio não foi encontrado no cache.
var ErrCacheMiss = errors.New("cache miss")

// SynthesizerCache define o contrato para buscar áudios pré-gerados.
type SynthesizerCache interface {
	Get(ctx context.Context, key string) (ports.AudioArtifact, error)
}

// Router implementa a lógica de fallback híbrido entre provedores de TTS.
// Prioridade: Cache -> Local (Piper) -> Cloud (Google/Azure).
type Router struct {
	cache SynthesizerCache
	local ports.Synthesizer
	cloud ports.Synthesizer
}

// NewRouter cria um novo roteador de TTS.
func NewRouter(cache SynthesizerCache, local ports.Synthesizer, cloud ports.Synthesizer) *Router {
	return &Router{
		cache: cache,
		local: local,
		cloud: cloud,
	}
}

// Synthesize executa o roteamento respeitando regras de sensibilidade e disponibilidade.
func (r *Router) Synthesize(ctx context.Context, req ports.SynthesisRequest) (ports.AudioArtifact, error) {
	// 1. Tentar Cache
	if r.cache != nil && req.CacheKey != "" {
		if audio, err := r.cache.Get(ctx, req.CacheKey); err == nil {
			audio.Source = "cache"
			return audio, nil
		}
	}

	// 2. Se for SENSÍVEL, SÓ PODE usar o Local
	if req.Sensitive {
		if r.local == nil {
			return ports.AudioArtifact{}, errors.New("sensitive request but local synthesizer is unavailable")
		}
		audio, err := r.local.Synthesize(ctx, req)
		if err == nil {
			audio.Source = "local"
		}
		return audio, err
	}

	var localErr error

	// 3. NÃO SENSÍVEL: Tenta Local primeiro (se configurado)
	if r.local != nil {
		audio, err := r.local.Synthesize(ctx, req)
		if err == nil {
			audio.Source = "local"
			return audio, nil
		}
		localErr = err
		// Se Local falhar (ex: saturado, timeout), o fluxo contínua e tentamos Cloud
	} else {
		localErr = errors.New("local synthesizer is unavailable")
	}

	// 4. Cloud (Fallback para não sensíveis)
	if r.cloud != nil {
		audio, err := r.cloud.Synthesize(ctx, req)
		if err == nil {
			audio.Source = "cloud"
			return audio, nil
		}
		// Preserva o erro do Local (útil para diagnosticar saturação) via %w
		return ports.AudioArtifact{}, fmt.Errorf("cloud fallback failed (%v), local error was: %w", err, localErr)
	}

	return ports.AudioArtifact{}, fmt.Errorf("no cloud fallback available, local error was: %w", localErr)
}
