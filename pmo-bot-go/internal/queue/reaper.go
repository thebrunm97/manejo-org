package queue

// reaper.go — devolve à fila os jobs que ficaram presos em processamento.
//
// O VAZAMENTO
//
// `claim_next_message_job` marca o job como `processing`/`ai_processing` e
// grava `claimed_at`. A partir daí, só o próprio worker tira o job desse
// estado, chamando MarkDone ou MarkFailed. Se o worker morre no meio — deploy,
// crash, container reiniciado, máquina desligada —, ninguém devolve o job.
//
// Ele não é reprocessado nem falha: fica preso para sempre. E como `Claim` só
// busca status `pending`/`ai_pending`, nenhum worker futuro o enxerga. Para o
// produtor, a mensagem simplesmente nunca recebeu resposta.
//
// Medido em produção em 2026-08-23: 8 jobs presos, o mais antigo desde
// 2026-06-07 — dois meses e meio. Com um produtor em teste isso passa
// despercebido; num deploy com vinte produtores, cada reinício do container
// deixa um rastro de mensagens sem resposta.
//
// POR QUE EM GO, E NÃO pg_cron
//
// Mesma decisão do Triturador do Cofre Efêmero (DT-42): a regra de negócio
// fica tipada e versionada no repositório, em vez de num agendador do banco que
// ninguém revisa em code review.
//
// POR QUE NÃO É SÓ "VOLTAR PARA PENDING"
//
// Um job preso pode estar preso porque o processamento dele derruba o worker.
// Devolver incondicionalmente criaria um laço: reivindica, derruba, devolve,
// repete. Por isso o reaper conta tentativas e manda para dead letter quando o
// limite estoura, usando `IsDeadLetter` — a MESMA função do MarkFailed, e não
// a coluna `max_attempts`. Se os dois caminhos discordassem sobre quando um job
// morreu, um devolveria à fila o que o outro já considera morto.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// DefaultStuckAfter é o tempo sem conclusão a partir do qual um job em
// processamento é considerado órfão.
//
// 15 minutos é folgado de propósito. O caminho mais lento medido é o TTS do
// Piper, com teto de 120s de contexto e 150s de cliente HTTP (DT-31), e o
// pipeline inteiro cabe em poucos minutos. Um limite apertado correria o risco
// de reivindicar um job que ainda está sendo processado, produzindo resposta
// duplicada para o produtor — que é pior do que demorar mais para recuperar.
const DefaultStuckAfter = 15 * time.Minute

// statusDeVolta mapeia o estado de processamento de volta ao estado de espera
// correspondente. A assimetria importa: um job de IA preso precisa voltar para
// `ai_pending`, não para `pending`, senão seria reprocessado desde a
// transcrição — refazendo trabalho já feito e gastando cota da Groq de novo.
var statusDeVolta = map[string]string{
	"processing":    "pending",
	"ai_processing": "ai_pending",
}

// StuckJobReaper varre periodicamente a fila em busca de jobs órfãos.
type StuckJobReaper struct {
	manager    *Manager
	interval   time.Duration
	stuckAfter time.Duration
}

// NewStuckJobReaper cria o reaper. `interval` controla a frequência da varredura
// e `stuckAfter` o quanto um job pode ficar em processamento antes de ser
// considerado órfão. Ambos são parâmetros para permitir intervalo curto em
// teste, sem esperar minutos para observar o efeito.
func NewStuckJobReaper(m *Manager, interval, stuckAfter time.Duration) *StuckJobReaper {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	if stuckAfter <= 0 {
		stuckAfter = DefaultStuckAfter
	}
	return &StuckJobReaper{manager: m, interval: interval, stuckAfter: stuckAfter}
}

// Run bloqueia até ctx ser cancelado. Deve ser chamado em goroutine própria.
//
// Faz uma passada imediatamente ao iniciar, e não só após o primeiro tick. Isso
// é o que recupera os jobs deixados presos pelo deploy anterior: o momento em
// que o processo sobe é exatamente o momento em que existem órfãos do processo
// que acabou de morrer.
func (r *StuckJobReaper) Run(ctx context.Context) {
	log.Printf("🧟 [Reaper] Iniciado (varredura=%s, considera preso após=%s)", r.interval, r.stuckAfter)

	r.tick(ctx)

	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("🧟 [Reaper] Encerrado")
			return
		case <-ticker.C:
			r.tick(ctx)
		}
	}
}

func (r *StuckJobReaper) tick(ctx context.Context) {
	recuperados, mortos, err := r.ReapOnce(ctx, time.Now().UTC())
	switch {
	case err != nil:
		log.Printf("🚨 [Reaper] Falha na varredura: %v", err)
	case recuperados == 0 && mortos == 0:
		// Silêncio proposital: o caso normal é não haver nada, e logar a cada
		// 5 minutos afogaria o log em ruído.
	default:
		log.Printf("🧟 [Reaper] %d job(s) devolvido(s) à fila, %d enviado(s) para dead letter", recuperados, mortos)
	}
}

// stuckJob espelha os campos necessários para decidir o destino de um órfão.
type stuckJob struct {
	ID           string `json:"id"`
	Status       string `json:"status"`
	AttemptCount int    `json:"attempt_count"`
	MaxAttempts  int    `json:"max_attempts"`
}

// ReapOnce executa uma varredura e devolve quantos jobs foram recuperados e
// quantos foram para dead letter. Exportada para permitir teste e execução
// manual sem esperar o ticker.
func (r *StuckJobReaper) ReapOnce(ctx context.Context, agora time.Time) (recuperados, mortos int, err error) {
	corte := agora.Add(-r.stuckAfter).Format(time.RFC3339)

	presos, err := r.buscarPresos(ctx, corte)
	if err != nil {
		return 0, 0, err
	}

	for _, job := range presos {
		destino, conhecido := statusDeVolta[job.Status]
		if !conhecido {
			// Status de processamento que o reaper não conhece. Não adivinhar
			// para onde devolver: mexer no estado errado da fila é pior que
			// deixar o job parado e visível.
			log.Printf("⚠️ [Reaper] Status inesperado %q no job %s, ignorado", job.Status, job.ID)
			continue
		}

		proximaTentativa := job.AttemptCount + 1
		update := map[string]interface{}{
			"attempt_count": proximaTentativa,
		}

		// Mesma regra do MarkFailed, via IsDeadLetter, e nao a coluna
		// max_attempts. Os dois caminhos precisam concordar sobre quando um job
		// morreu; se divergissem, o reaper devolveria a fila um job que o
		// MarkFailed ja considera morto, ou o mataria antes da hora.
		if IsDeadLetter(proximaTentativa) {
			// Dead letter. Um job que já consumiu as tentativas e voltou a
			// ficar preso provavelmente derruba o worker que o processa;
			// devolvê-lo de novo criaria um laço de crash.
			update["status"] = "failed"
			update["error_msg"] = "reaper_dead_letter: preso em processamento apos esgotar tentativas"
			update["processed_at"] = agora.Format(time.RFC3339)
			mortos++
			log.Printf("💀 [Reaper] Dead letter: id=%s tentativas=%d/%d", job.ID, proximaTentativa, MaxRetryAttempts)
		} else {
			update["status"] = destino
			update["error_msg"] = "reaper_recuperado: worker nao concluiu o job"
			update["next_retry_at"] = agora.Format(time.RFC3339)
			update["processed_at"] = nil
			recuperados++
			log.Printf("🧟 [Reaper] Devolvido à fila: id=%s %s → %s tentativa=%d/%d",
				job.ID, job.Status, destino, proximaTentativa, MaxRetryAttempts)
		}

		if errUp := r.manager.updateJob(ctx, job.ID, update); errUp != nil {
			// Falha em um job não interrompe a varredura: os demais órfãos
			// continuam sendo recuperados.
			log.Printf("⚠️ [Reaper] Falha ao devolver job %s: %v", job.ID, errUp)
		}
	}

	return recuperados, mortos, nil
}

// buscarPresos consulta os jobs em processamento cujo claimed_at é anterior ao
// corte. Jobs sem claimed_at são incluídos: estar em processamento sem registro
// de quando foi reivindicado é, por si só, estado inconsistente.
func (r *StuckJobReaper) buscarPresos(ctx context.Context, corte string) ([]stuckJob, error) {
	reqURL := fmt.Sprintf(
		"%s/rest/v1/message_queue?status=in.(processing,ai_processing)"+
			"&or=(claimed_at.lt.%s,claimed_at.is.null)"+
			"&select=id,status,attempt_count,max_attempts",
		r.manager.cfg.url, corte)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("reaper.buscarPresos: request error: %w", err)
	}
	r.manager.setHeaders(req)

	resp, err := r.manager.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("reaper.buscarPresos: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reaper.buscarPresos: read error: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("reaper.buscarPresos: supabase error (%d): %s", resp.StatusCode, string(body))
	}

	var jobs []stuckJob
	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&jobs); err != nil {
		return nil, fmt.Errorf("reaper.buscarPresos: decode error: %w", err)
	}
	return jobs, nil
}
