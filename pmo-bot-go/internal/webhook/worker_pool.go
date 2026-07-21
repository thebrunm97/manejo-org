package webhook

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"sync/atomic"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
)

var ErrQueueFull = errors.New("worker pool queue is full")

// MessageProcessor defines the interface for processing a message in the legacy flow.
type MessageProcessor interface {
	processLegacy(msg ports.IncomingMessage)
}

// MemoryWorkerPool manages a pool of workers for processing webhook messages asynchronously.
type MemoryWorkerPool struct {
	queue      chan ports.IncomingMessage
	processor  MessageProcessor
	workers    int
	wg         sync.WaitGroup
	quit       chan struct{}
	isStopping int32
}

// NewMemoryWorkerPool creates a new MemoryWorkerPool.
func NewMemoryWorkerPool(workers int, queueSize int, p MessageProcessor) *MemoryWorkerPool {
	if workers <= 0 {
		workers = 5 // Default
	}
	if queueSize <= 0 {
		queueSize = 1000 // Default
	}
	return &MemoryWorkerPool{
		queue:     make(chan ports.IncomingMessage, queueSize),
		processor: p,
		workers:   workers,
		quit:      make(chan struct{}),
	}
}

// Start launches the worker goroutines.
func (p *MemoryWorkerPool) Start() {
	for i := 0; i < p.workers; i++ {
		p.wg.Add(1)
		go p.workerLoop(i)
	}
	slog.Info("WorkerPool iniciado", 
		slog.Int("workers", p.workers), 
		slog.Int("max_queue", cap(p.queue)),
	)
}

func (p *MemoryWorkerPool) workerLoop(id int) {
	defer p.wg.Done()
	slog.Info("Worker iniciado", slog.Int("worker_id", id))
	for {
		select {
		case msg := <-p.queue:
			telemetry.WorkerPoolQueueSize.Set(float64(len(p.queue)))
			p.processor.processLegacy(msg)
		case <-p.quit:
			slog.Info("Worker recebendo sinal de parada", slog.Int("worker_id", id))
			// Process remaining messages in the queue before exiting
			for {
				select {
				case msg := <-p.queue:
					telemetry.WorkerPoolQueueSize.Set(float64(len(p.queue)))
					p.processor.processLegacy(msg)
				default:
					slog.Info("Worker finalizado", slog.Int("worker_id", id))
					return
				}
			}
		}
	}
}

// Enqueue adds a message to the worker pool queue. Returns ErrQueueFull if the queue is full.
func (p *MemoryWorkerPool) Enqueue(msg ports.IncomingMessage) error {
	if atomic.LoadInt32(&p.isStopping) == 1 {
		return errors.New("worker pool is shutting down")
	}
	select {
	case p.queue <- msg:
		telemetry.WorkerPoolQueueSize.Set(float64(len(p.queue)))
		return nil
	default:
		return ErrQueueFull
	}
}

// Shutdown initiates a graceful shutdown of the worker pool.
func (p *MemoryWorkerPool) Shutdown(ctx context.Context) error {
	if !atomic.CompareAndSwapInt32(&p.isStopping, 0, 1) {
		return nil // Already stopping
	}
	slog.Warn("Iniciando Graceful Shutdown do Pool em Memória...")
	close(p.quit)

	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		slog.Info("Todos os workers foram finalizados.")
		return nil
	case <-ctx.Done():
		slog.Error("Shutdown interrompido por timeout", "error", ctx.Err())
		return ctx.Err()
	}
}
