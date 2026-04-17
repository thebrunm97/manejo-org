package queue

// ai_worker.go — Camada 4 do Harness de Produção.
//
// O AI Worker consome jobs com status "ai_pending" (texto já processado pela Camada 3).
// É responsável pelo loop de raciocínio completo:
//   1. Autenticação e resolução de perfil
//   2. Verificação de quota
//   3. Classificação de intent (Router LLM)
//   4. Execução do Orchestrator (Tool Loop)
//   5. Entrega da resposta ao usuário (Camada 5)
//   6. Audit (Camada 6) — marca job como done/failed
//
// REGRA CRÍTICA: Este worker só recebe job.BodyText (texto puro).
// Nunca processa mídia diretamente.

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

// AIWorkerConfig contém as dependências do AI Worker.
type AIWorkerConfig struct {
	Queue        *Manager
	Supabase     *supabase.Client
	WhatsApp     ports.MessageSender
	Gemini       *gemini.Client
	TTS          *tts.Orchestrator
	MCP          *mcp.Server
	History      *history.Manager
	PollInterval time.Duration // Default: 200ms (polling mais rápido pois é downstream do media worker)
}

// AIWorker processa a camada de raciocínio e entrega de resposta.
type AIWorker struct {
	cfg AIWorkerConfig
}

// NewAIWorker cria um novo worker de IA.
func NewAIWorker(cfg AIWorkerConfig) *AIWorker {
	if cfg.PollInterval == 0 {
		cfg.PollInterval = 200 * time.Millisecond
	}
	return &AIWorker{cfg: cfg}
}

// Run é o loop principal do AI Worker. Roda até que o contexto seja cancelado.
func (w *AIWorker) Run(ctx context.Context, workerID string) {
	log.Printf("▶️  [AIWorker-%s] Iniciado", workerID)
	defer log.Printf("⏹️  [AIWorker-%s] Encerrado graciosamente", workerID)

	idleCount := 0
	for {
		select {
		case <-ctx.Done():
			return
		default:
			jobFound, err := w.tick(ctx, workerID)
			if err != nil {
				log.Printf("⚠️  [AIWorker-%s] Erro de tick: %v", workerID, err)
			}

			var waitTime time.Duration
			if jobFound {
				idleCount = 0
				waitTime = w.cfg.PollInterval
			} else {
				idleCount++
				// Backoff: 1s, 2s, 3s, 4s, até 5s
				waitSec := idleCount
				if waitSec > 5 {
					waitSec = 5
				}
				waitTime = time.Duration(waitSec) * time.Second
			}

			select {
			case <-ctx.Done():
				return
			case <-time.After(waitTime):
			}
		}
	}
}

// tick reivindica e processa um único job "ai_pending".
func (w *AIWorker) tick(ctx context.Context, workerID string) (bool, error) {
	job, err := w.cfg.Queue.ClaimAIPending(ctx, workerID)
	if err != nil {
		return false, fmt.Errorf("claim error: %w", err)
	}
	if job == nil {
		return false, nil
	}

	log.Printf("🤖 [AIWorker-%s] Processando job %s (text: %.80s...)", workerID, job.ID, job.BodyText)

	start := time.Now()
	w.processAIJob(ctx, job, start)
	return true, nil
}

// processAIJob executa o fluxo completo de IA para um job.
// Reutiliza o state.ProcessMessage existente, passando o bodyText já extraído.
func (w *AIWorker) processAIJob(ctx context.Context, job *Job, start time.Time) {
	// Reconstrói o IncomingMessage com o texto já processado
	// O BodyText substitui o Body original (que pode ser vazio para áudios)
	msg := job.RawPayload
	msg.Body = job.BodyText
	msg.IsAudio = false  // Já foi processado — IA enxerga apenas texto
	msg.IsImage = false  // Já foi processado — IA enxerga apenas texto

	// Contexto com timeout generoso para o loop de IA (máx 90s)
	aiCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	// Delega para o ProcessMessage existente (reuso total do fluxo atual)
	// O FSM existente já trata: autenticação, quota, router, orchestrator, TTS
	result := state.ProcessMessage(
		aiCtx,
		msg,
		w.cfg.Supabase,
		nil, // groqClient: não necessário — áudio já foi transcrito pela Camada 3
		w.cfg.WhatsApp,
		w.cfg.Gemini,
		w.cfg.TTS,
		w.cfg.MCP,
		w.cfg.History,
		nil, // flagsmithClient: não necessário no worker (usado apenas pela sessão HTTP)
	)

	latencyMs := time.Since(start).Milliseconds()

	if result.Success {
		if err := w.cfg.Queue.MarkDone(aiCtx, job.ID, JobMeta{
			Reason:    result.Reason,
			LatencyMs: latencyMs,
		}); err != nil {
			log.Printf("⚠️  [AIWorker] Falha ao marcar job %s como done: %v", job.ID, err)
		}
		log.Printf("✅ [AIWorker] Job %s concluído em %dms (razão: %s)", job.ID, latencyMs, result.Reason)
	} else {
		reason := result.Reason
		if err := w.cfg.Queue.MarkFailed(aiCtx, job.ID, reason, job.AttemptCount); err != nil {
			log.Printf("⚠️  [AIWorker] Falha ao marcar job %s como failed: %v", job.ID, err)
		}
		log.Printf("❌ [AIWorker] Job %s falhou em %dms (razão: %s)", job.ID, latencyMs, reason)
	}
}
