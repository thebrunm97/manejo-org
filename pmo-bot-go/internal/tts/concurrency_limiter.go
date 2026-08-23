package tts

import (
	"context"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ConcurrencyLimiter é um wrapper (Decorator) que restringe o número de
// requisições concorrentes processadas por um provedor subjacente.
type ConcurrencyLimiter struct {
	next ports.Synthesizer
	sem  chan struct{}
}

// NewConcurrencyLimiter cria um novo limitador.
// maxConcurrent determina quantas sínteses simultâneas são permitidas.
func NewConcurrencyLimiter(next ports.Synthesizer, maxConcurrent int) *ConcurrencyLimiter {
	return &ConcurrencyLimiter{
		next: next,
		sem:  make(chan struct{}, maxConcurrent),
	}
}

// Synthesize solicita a permissão (semáforo) para executar.
// Se o contexto expirar enquanto aguarda na fila, retorna ports.ErrSynthesizerSaturated.
func (l *ConcurrencyLimiter) Synthesize(ctx context.Context, req ports.SynthesisRequest) (ports.AudioArtifact, error) {
	select {
	case l.sem <- struct{}{}: // Tenta adquirir a vaga
		defer func() { <-l.sem }() // Libera a vaga ao finalizar
		
		// Vaga adquirida: chama o provedor real
		return l.next.Synthesize(ctx, req)
		
	case <-ctx.Done(): // Timeout ou cancelamento disparado pelo chamador
		// Se o chamador cansou de esperar na fila, consideramos saturação
		return ports.AudioArtifact{}, ports.ErrSynthesizerSaturated
	}
}
