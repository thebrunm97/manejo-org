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

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// AIWorkerConfig contém as dependências do AI Worker.
type AIWorkerConfig struct {
	Queue        *Manager
	Supabase     *supabase.Client
	WhatsApp     ports.MessageSender
	LLM          llm.LLMProvider
	TTS          ports.Synthesizer
	MCP          *mcp.Server
	History      *history.Manager
	PollInterval time.Duration // Default: 200ms (polling mais rápido pois é downstream do media worker)
	RouterConfig state.RouterConfig

	// GuardrailPipeline executes input validation before every LLM call.
	// If nil, guardrails are disabled (legacy/test mode).
	// Create via guardrails.NewDefaultPipeline() for production defaults.
	GuardrailPipeline *guardrails.Pipeline
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
	defer utils.TraceLatency("Queue: processAIJob", start)
	// Reconstrói o IncomingMessage com o texto já processado
	// O BodyText substitui o Body original (que pode ser vazio para áudios)
	msg := job.RawPayload
	msg.Body = job.BodyText
	msg.IsAudio = false // Já foi processado — IA enxerga apenas texto
	msg.IsImage = false // Já foi processado — IA enxerga apenas texto
	// DT-29: a preferência declarada pelo produtor ganha do espelhamento da
	// entrada. Lida aqui, e não dentro do ProcessMessage, porque a decisão
	// precisa ser resolvida UMA vez: logo abaixo o modo é marcado como
	// explícito, e a partir daí todo o pipeline respeita o que foi decidido.
	//
	// Falha de leitura não interrompe nada: cai no comportamento anterior
	// (espelhar a entrada), que é exatamente o default de quem nunca escolheu.
	pref := ports.PreferenceAuto
	if w.cfg.Supabase != nil && job.FromPhone != "" {
		if raw, errPref := w.cfg.Supabase.GetResponsePreference(job.FromPhone); errPref != nil {
			log.Printf("⚠️ [AIWorker] Não consegui ler a preferência de resposta (usando espelhamento): %v", errPref)
		} else {
			pref = ports.ParseResponsePreference(raw)
		}
	}

	resolvedResponseMode := job.ShouldRespondWithAudioFor(pref)

	// O log vem ANTES das duas atribuições abaixo, de propósito. Elas marcam
	// o modo como explícito, e a função de log deriva a ORIGEM da decisão dos
	// campos de msg — logar depois faria toda decisão ser atribuída a
	// "explicit", que é o que o pipeline acabou de escrever, e nunca à causa
	// real. Sem isto não dá para medir a adoção da preferência do DT-29.
	LogResponseModeDecisionFor(job.ID, msg, pref, resolvedResponseMode, false)

	msg.RespondWithAudio = resolvedResponseMode
	msg.HasExplicitResponseMode = true

	// ── Guardrail Layer 1: Input Validation Pipeline ──────────────────────────
	// Runs PIIScrubber (redact) → InjectionDetector (block-or-pass).
	// Adds < 2ms overhead on typical messages.  Attacks are blocked here,
	// BEFORE any quota is consumed or the LLM is contacted.
	if w.cfg.GuardrailPipeline != nil {
		startInputGuardrail := time.Now()
		cleanInput, gr := w.cfg.GuardrailPipeline.Execute(ctx, msg.Body, job.FromPhone, job.ID)
		log.Printf("⏱️ [TRACING] Sub-passo: Input Guardrail: %v", time.Since(startInputGuardrail))
		if gr.Blocked {
			log.Printf("🛡️ [AIWorker] Input BLOQUEADO pelo Guardrail [%s] job=%s reason=%s",
				job.FromPhone, job.ID, gr.BlockReason)

			// Notify the user with a clear, non-alarming message
			_ = w.cfg.WhatsApp.SendMessage(msg.From,
				"⚠️ Sua mensagem não pôde ser processada por violar políticas de segurança.\n"+
					"Por favor, reformule sua pergunta e tente novamente.")

			// Mark Done (not Failed) — blocked attacks should NOT be retried
			_ = w.cfg.Queue.MarkDone(ctx, job.ID, JobMeta{Reason: "guardrail_input_blocked"})
			return
		}
		// Use sanitized input (PII redacted) for all downstream processing
		msg.Body = cleanInput
		if len(gr.Violations) > 0 {
			log.Printf("🛡️ [AIWorker] PII redactado no job=%s violations=%d risk=%.2f",
				job.ID, len(gr.Violations), gr.RiskScore)
		}
	}
	// ─────────────────────────────────────────────────────────────────────────

	// Contexto com timeout generoso para o loop de IA (máx 90s)
	aiCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	if msg.RawPayloadID != "" {
		aiCtx = context.WithValue(aiCtx, "raw_payload_id", msg.RawPayloadID)
	}

	go w.cfg.WhatsApp.SetPresence(msg.From, "composing")
	defer w.cfg.WhatsApp.SetPresence(msg.From, "available")

	startProcessMessage := time.Now()
	// Delega para o ProcessMessage existente (reuso total do fluxo atual)
	// O FSM existente já trata: autenticação, quota, router, orchestrator, TTS
	result := state.ProcessMessage(
		aiCtx,
		msg,
		w.cfg.Supabase,
		nil, // groqClient: não necessário — áudio já foi transcrito pela Camada 3
		w.cfg.WhatsApp,
		w.cfg.LLM,
		w.cfg.TTS,
		w.cfg.MCP,
		w.cfg.History,
		nil, // flagsmithClient: não necessário no worker (usado apenas pela sessão HTTP)
		w.cfg.RouterConfig,
	)
	log.Printf("⏱️ [TRACING] Sub-passo: ProcessMessage: %v", time.Since(startProcessMessage))

	latencyMs := time.Since(start).Milliseconds()

	if result.Success || result.Reason == "hitl_pending" {
		if err := w.cfg.Queue.MarkDone(aiCtx, job.ID, JobMeta{
			Reason:    result.Reason,
			LatencyMs: latencyMs,
		}); err != nil {
			log.Printf("⚠️  [AIWorker] Falha ao marcar job %s como done: %v", job.ID, err)
		}
		log.Printf("✅ [AIWorker] Job %s concluído (ou em HITL) em %dms (razão: %s)", job.ID, latencyMs, result.Reason)

		if msg.RawPayloadID != "" {
			if err := w.cfg.Supabase.UpdateRawPayloadStatus(aiCtx, msg.RawPayloadID, "PROCESSED", ""); err != nil {
				log.Printf("⚠️  [AIWorker] Falha ao atualizar status do raw_payload %s para PROCESSED: %v", msg.RawPayloadID, err)
			}
		}
	} else {
		reason := result.Reason
		if err := w.cfg.Queue.MarkFailed(aiCtx, job.ID, reason, job.AttemptCount); err != nil {
			log.Printf("⚠️  [AIWorker] Falha ao marcar job %s como failed: %v", job.ID, err)
		}
		log.Printf("❌ [AIWorker] Job %s falhou em %dms (razão: %s)", job.ID, latencyMs, reason)

		if msg.RawPayloadID != "" {
			if err := w.cfg.Supabase.UpdateRawPayloadStatus(aiCtx, msg.RawPayloadID, "FAILED", reason); err != nil {
				log.Printf("⚠️  [AIWorker] Falha ao atualizar status do raw_payload %s para FAILED: %v", msg.RawPayloadID, err)
			}
		}
	}
}
