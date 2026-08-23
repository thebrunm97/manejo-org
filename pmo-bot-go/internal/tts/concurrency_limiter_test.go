package tts_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

// slowMockSynthesizer simula um motor lento que segura o worker por uma duração configurável
type slowMockSynthesizer struct {
	delay time.Duration
}

func (m *slowMockSynthesizer) Synthesize(ctx context.Context, req ports.SynthesisRequest) (ports.AudioArtifact, error) {
	// Finge que está trabalhando pesadamente
	select {
	case <-time.After(m.delay):
		return ports.AudioArtifact{Source: "local_slow"}, nil
	case <-ctx.Done():
		return ports.AudioArtifact{}, ctx.Err()
	}
}

func TestConcurrencyLimiter_Saturated(t *testing.T) {
	// Motor demora 200ms para processar
	motor := &slowMockSynthesizer{delay: 200 * time.Millisecond}
	// Limite: 1 concorrente
	limiter := tts.NewConcurrencyLimiter(motor, 1)

	var wg sync.WaitGroup
	wg.Add(2)

	var err1, err2 error

	// Requisição 1: Ganha a vaga
	go func() {
		defer wg.Done()
		// Timeout generoso
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		_, err1 = limiter.Synthesize(ctx, ports.SynthesisRequest{})
	}()

	// Garante que a 1 assumiu a vaga
	time.Sleep(20 * time.Millisecond)

	// Requisição 2: Fica na fila. Como o timeout dela é menor que o tempo de 
	// processamento do motor (200ms), ela deve expirar na fila.
	go func() {
		defer wg.Done()
		// Timeout de 50ms (não vai dar tempo de pegar a vaga, pois a vaga só libera em 180ms)
		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()
		_, err2 = limiter.Synthesize(ctx, ports.SynthesisRequest{})
	}()

	wg.Wait()

	// Verifica Resultados
	if err1 != nil {
		t.Errorf("A primeira requisição deveria ter sucesso, got: %v", err1)
	}

	if err2 == nil {
		t.Fatal("A segunda requisição deveria ter falhado (saturação)")
	}

	// Regra de Ouro: o erro DEVE ser ports.ErrSynthesizerSaturated (não context.DeadlineExceeded puro)
	if !errors.Is(err2, ports.ErrSynthesizerSaturated) {
		t.Errorf("A segunda requisição deveria falhar com ErrSynthesizerSaturated, got: %v", err2)
	}
}

func TestConcurrencyLimiter_QueueAllowed(t *testing.T) {
	// Motor demora 50ms para processar
	motor := &slowMockSynthesizer{delay: 50 * time.Millisecond}
	// Limite: 1 concorrente
	limiter := tts.NewConcurrencyLimiter(motor, 1)

	var wg sync.WaitGroup
	wg.Add(2)

	var err1, err2 error

	// Requisição 1
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		_, err1 = limiter.Synthesize(ctx, ports.SynthesisRequest{})
	}()

	time.Sleep(10 * time.Millisecond)

	// Requisição 2 fica na fila, mas como o timeout dela é de 1 segundo, 
	// ela aguarda pacientemente os 40ms restantes e depois processa com sucesso.
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()
		_, err2 = limiter.Synthesize(ctx, ports.SynthesisRequest{})
	}()

	wg.Wait()

	if err1 != nil {
		t.Errorf("A primeira requisição falhou: %v", err1)
	}
	if err2 != nil {
		t.Errorf("A segunda requisição deveria ter esperado na fila e funcionado, falhou com: %v", err2)
	}
}
