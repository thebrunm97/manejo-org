package queue

// media_worker.go — Camada 3 do Harness de Produção.
//
// O Media Worker é responsável EXCLUSIVAMENTE por:
//   1. Reivindicar jobs "pending" da fila PostgreSQL (SKIP LOCKED)
//   2. Download de mídia (áudio/imagem) do WhatsApp via Evolution API
//   3. Transcrição de áudio via Groq Whisper
//   4. Descrição de imagem via Gemini
//   5. Escrever o texto limpo de volta no job (body_text) → avançar para "ai_pending"
//
// REGRA CRÍTICA: A IA nunca recebe mídia raw. Apenas texto já processado aqui.
// Isso isola completamente a latência de I/O de mídia do loop de raciocínio da IA.

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// MediaWorkerConfig contém as dependências do Media Worker.
type MediaWorkerConfig struct {
	Queue        *Manager
	WhatsApp     ports.MessageSender
	Groq         *groq.Client
	Gemini       *gemini.Client
	PollInterval time.Duration // Default: 500ms
}

// MediaWorker processa a camada de mídia (download + transcrição).
// Cada instância roda em sua própria goroutine via Harness.Run().
type MediaWorker struct {
	cfg MediaWorkerConfig
}

// NewMediaWorker cria um novo worker de mídia.
func NewMediaWorker(cfg MediaWorkerConfig) *MediaWorker {
	if cfg.PollInterval == 0 {
		cfg.PollInterval = 500 * time.Millisecond
	}
	return &MediaWorker{cfg: cfg}
}

// Run é o loop principal do worker. Roda até que o contexto seja cancelado (graceful shutdown).
func (w *MediaWorker) Run(ctx context.Context, workerID string) {
	log.Printf("▶️  [MediaWorker-%s] Iniciado", workerID)
	defer log.Printf("⏹️  [MediaWorker-%s] Encerrado graciosamente", workerID)

	idleCount := 0
	for {
		select {
		case <-ctx.Done():
			return
		default:
			jobFound, err := w.tick(ctx, workerID)
			if err != nil {
				// Erros de claim são transitórios (ex: rede). Não deve parar o worker.
				log.Printf("⚠️  [MediaWorker-%s] Erro de tick: %v", workerID, err)
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

			// Aguarda antes do próximo poll para não sobrecarregar o banco.
			select {
			case <-ctx.Done():
				return
			case <-time.After(waitTime):
			}
		}
	}
}

// tick tenta reivindicar e processar um único job. É thread-safe por design
// (SKIP LOCKED garante que workers concorrentes não pegam o mesmo job).
func (w *MediaWorker) tick(ctx context.Context, workerID string) (bool, error) {
	job, err := w.cfg.Queue.Claim(ctx, workerID)
	if err != nil {
		return false, fmt.Errorf("claim error: %w", err)
	}
	if job == nil {
		return false, nil // Fila vazia — aguarda próximo poll
	}

	log.Printf("🎬 [MediaWorker-%s] Processando job %s (msg=%s, from=%s, attempt=%d/%d)",
		workerID, job.ID, job.MsgID, job.FromPhone, job.AttemptCount+1, job.MaxAttempts)

	start := time.Now()
	bodyText, respondAudio, processErr := w.processMedia(ctx, job)

	if processErr != nil {
		log.Printf("❌ [MediaWorker-%s] Falha no job %s: %v", workerID, job.ID, processErr)
		_ = w.cfg.Queue.MarkFailed(ctx, job.ID, processErr.Error(), job.AttemptCount)
		return true, nil // Processou (mesmo que com falha), conta como jobFound para o backoff? 
		// Na verdade, se falhou, talvez queiramos processar o próximo logo. Sim, true.
	}

	if err := w.cfg.Queue.MarkAIPending(ctx, job.ID, bodyText, respondAudio); err != nil {
		log.Printf("❌ [MediaWorker-%s] Falha ao avançar job %s para ai_pending: %v", workerID, job.ID, err)
		_ = w.cfg.Queue.MarkFailed(ctx, job.ID, "mark_ai_pending_failed: "+err.Error(), job.AttemptCount)
		return true, nil
	}

	log.Printf("✅ [MediaWorker-%s] Job %s → ai_pending em %dms (texto: %d chars)",
		workerID, job.ID, time.Since(start).Milliseconds(), len(bodyText))
	return true, nil
}

// processMedia extrai texto da mensagem. Retorna (bodyText, respondWithAudio, error).
// Para mensagens de texto puro, retorna o body diretamente sem I/O extra.
func (w *MediaWorker) processMedia(ctx context.Context, job *Job) (string, bool, error) {
	msg := job.RawPayload

	// --- Mensagem de texto puro (caminho feliz, sem I/O de mídia) ---
	if !msg.IsAudio && !msg.IsImage {
		if strings.TrimSpace(msg.Body) == "" {
			return "", false, fmt.Errorf("text message with empty body")
		}
		return msg.Body, false, nil
	}

	// --- Processamento de Áudio ---
	if msg.IsAudio {
		return w.processAudio(ctx, msg)
	}

	// --- Processamento de Imagem ---
	if msg.IsImage {
		return w.processImage(ctx, msg)
	}

	return "", false, fmt.Errorf("unsupported message type")
}

// processAudio baixa o áudio e transcreve via Groq Whisper.
func (w *MediaWorker) processAudio(ctx context.Context, msg ports.IncomingMessage) (string, bool, error) {
	audioCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	audioBytes, err := w.cfg.WhatsApp.DownloadAudio(msg.ID, msg.RawPayload)
	if err != nil {
		return "", true, fmt.Errorf("audio_download_failed: %w", err)
	}
	if len(audioBytes) == 0 {
		return "", true, fmt.Errorf("audio_download_empty")
	}

	transcription, err := w.cfg.Groq.Transcribe(audioCtx, groq.AudioTranscriptionRequest{
		FileData: audioBytes,
		FileName: "audio.ogg",
	})
	if err != nil {
		return "", true, fmt.Errorf("audio_transcription_failed: %w", err)
	}

	cleanText := strings.TrimSpace(transcription.Text)
	if cleanText == "" {
		return "", true, fmt.Errorf("audio_transcription_empty")
	}

	return cleanText, true, nil
}

// processImage baixa a imagem e gera descrição agronômica via Gemini.
func (w *MediaWorker) processImage(ctx context.Context, msg ports.IncomingMessage) (string, bool, error) {
	imageCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	imageBytes, mimeType, err := w.cfg.WhatsApp.DownloadImage(msg.ID, msg.RawPayload)
	if err != nil {
		return "", false, fmt.Errorf("image_download_failed: %w", err)
	}

	description, _, err := w.cfg.Gemini.DescribeAgronomicImage(imageCtx, imageBytes, mimeType)
	if err != nil {
		// Fallback: usa a legenda da imagem se disponível
		if msg.Body != "" {
			return msg.Body, false, nil
		}
		return "", false, fmt.Errorf("image_description_failed: %w", err)
	}

	// Se há legenda além da descrição, combina os dois
	if msg.Body != "" {
		return description + "\n\nLegenda do usuário: " + msg.Body, false, nil
	}
	return description, false, nil
}
