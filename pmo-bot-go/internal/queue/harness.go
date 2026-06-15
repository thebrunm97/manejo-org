package queue

// harness.go — Orquestrador Central do Harness de Produção (6 Camadas).
//
// O Harness gerencia o ciclo de vida completo de todos os workers:
//   - Inicializa pools de Media Workers (Camada 3) e AI Workers (Camada 4)
//   - Suporta graceful shutdown via context cancellation
//   - Executa limpeza automática de jobs antigos (TTL)
//   - Feature flag HARNESS_ENABLED para rollback imediato em produção
//
// Concorrência padrão:
//   - 3 Media Workers (I/O bound: download + transcrição)
//   - 2 AI Workers (CPU/API bound: LLM + tools)
//
// Uso:
//
//	harness := queue.NewHarness(cfg)
//	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
//	defer cancel()
//	harness.Start(ctx) // Blocks until ctx is done (graceful shutdown)

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// HarnessConcurrency define o número de workers por camada.
type HarnessConcurrency struct {
	MediaWorkers int           // Default: 3
	AIWorkers    int           // Default: 2
	CleanupEvery time.Duration // Default: 6h
}

// HarnessConfig agrupa toda a configuração do Harness.
type HarnessConfig struct {
	Concurrency HarnessConcurrency
	Media       MediaWorkerConfig
	AI          AIWorkerConfig
}

// Harness coordena o pool de workers e o ciclo de vida do sistema.
type Harness struct {
	cfg          HarnessConfig
	mediaWorkers []*MediaWorker
	aiWorkers    []*AIWorker
}

// NewHarness cria um Harness com concorrência padrão se não especificada.
func NewHarness(cfg HarnessConfig) *Harness {
	if cfg.Concurrency.MediaWorkers <= 0 {
		cfg.Concurrency.MediaWorkers = 3
	}
	if cfg.Concurrency.AIWorkers <= 0 {
		cfg.Concurrency.AIWorkers = 2
	}
	if cfg.Concurrency.CleanupEvery <= 0 {
		cfg.Concurrency.CleanupEvery = 6 * time.Hour
	}

	h := &Harness{cfg: cfg}

	// Pré-aloca os workers (sem iniciar goroutines ainda)
	h.mediaWorkers = make([]*MediaWorker, cfg.Concurrency.MediaWorkers)
	for i := range h.mediaWorkers {
		h.mediaWorkers[i] = NewMediaWorker(cfg.Media)
	}

	h.aiWorkers = make([]*AIWorker, cfg.Concurrency.AIWorkers)
	for i := range h.aiWorkers {
		h.aiWorkers[i] = NewAIWorker(cfg.AI)
	}

	return h
}

// Start inicializa todos os workers e bloqueia até que o contexto seja cancelado.
// O shutdown é gracioso: aguarda todos os workers finalizarem o job atual antes de sair.
//
// Chamada típica:
//
//	go harness.Start(ctx)
func (h *Harness) Start(ctx context.Context) {
	log.Printf("🚀 [Harness] Iniciando com %d Media Workers + %d AI Workers",
		len(h.mediaWorkers), len(h.aiWorkers))

	var wg sync.WaitGroup

	// --- Media Workers (Camada 3) ---
	for i, worker := range h.mediaWorkers {
		wg.Add(1)
		go func(id int, w *MediaWorker) {
			defer wg.Done()
			w.Run(ctx, fmt.Sprintf("mw-%d", id))
		}(i, worker)
	}

	// --- AI Workers (Camada 4) ---
	for i, worker := range h.aiWorkers {
		wg.Add(1)
		go func(id int, w *AIWorker) {
			defer wg.Done()
			w.Run(ctx, fmt.Sprintf("aw-%d", id))
		}(i, worker)
	}

	// --- Cleanup Worker (TTL de 7 dias para jobs done) ---
	wg.Add(1)
	go func() {
		defer wg.Done()
		h.runCleanupLoop(ctx)
	}()

	// Aguarda shutdown gracioso de todos os workers
	wg.Wait()
	log.Println("✅ [Harness] Todos os workers finalizados graciosamente")
}

// runCleanupLoop executa a limpeza de jobs done periodicamente.
func (h *Harness) runCleanupLoop(ctx context.Context) {
	log.Printf("🧹 [Harness] Cleanup loop iniciado (intervalo: %s)", h.cfg.Concurrency.CleanupEvery)
	ticker := time.NewTicker(h.cfg.Concurrency.CleanupEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("🧹 [Harness] Cleanup loop encerrado")
			return
		case <-ticker.C:
			if h.cfg.Media.Queue != nil {
				if err := h.cfg.Media.Queue.RunCleanup(ctx); err != nil {
					log.Printf("⚠️  [Harness] Erro no cleanup automático: %v", err)
				}
			}
		}
	}
}
