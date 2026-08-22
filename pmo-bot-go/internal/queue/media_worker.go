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

	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// MediaWorkerConfig contém as dependências do Media Worker.
// AudioArchiver arquiva a gravação bruta no Cofre de Auditoria Efêmero.
//
// Recebe o TELEFONE, e não o profile_id, de propósito: resolver um no outro
// exigiria dar ao worker de mídia um cliente de banco e conhecimento sobre
// perfis, coisas que ele não tem e não precisa ter. A implementação faz a
// resolução e chama domain.SaveAudioToEphemeralVault.
//
// Um valor nil é contrato válido e significa "cofre desativado" — o áudio segue
// sendo transcrito e descartado normalmente.
type AudioArchiver interface {
	ArchiveAudio(ctx context.Context, phone string, audio []byte, intent string) error
}

type MediaWorkerConfig struct {
	Queue        *Manager
	WhatsApp     ports.MessageSender
	Groq         *groq.Client
	LLM          llm.LLMProvider
	PollInterval time.Duration // Default: 500ms

	// AudioVault guarda a gravação por 90 dias para não-repúdio (DT-42).
	// Opcional: nil desativa o arquivamento sem afetar o resto do fluxo.
	AudioVault AudioArchiver
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

var ErrUnsupportedMediaType = fmt.Errorf("unsupported media type")

// processMedia extrai texto da mensagem. Retorna (bodyText, respondWithAudio, error).
// Para mensagens de texto puro, retorna o body diretamente sem I/O extra.
func (w *MediaWorker) processMedia(ctx context.Context, job *Job) (string, bool, error) {
	msg := job.RawPayload

	// --- Mensagem de texto puro (caminho feliz, sem I/O de mídia) ---
	if !msg.IsAudio && !msg.IsImage {
		if strings.TrimSpace(msg.Body) == "" {
			return "", false, ErrUnsupportedMediaType
		}
		return msg.Body, ports.ResolveResponseMode(msg), nil
	}

	// --- Processamento de Áudio ---
	if msg.IsAudio {
		return w.processAudio(ctx, msg)
	}

	// --- Processamento de Imagem ---
	if msg.IsImage {
		return w.processImage(ctx, msg)
	}

	return "", false, ErrUnsupportedMediaType
}

// processAudio baixa o áudio e transcreve via Groq Whisper.
func (w *MediaWorker) processAudio(ctx context.Context, msg ports.IncomingMessage) (string, bool, error) {
	audioCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	audioData, audioMimeType, err := w.cfg.WhatsApp.DownloadAudio(msg.ID, msg.RawPayload)
	if err != nil {
		log.Printf("❌ [MediaWorker] Erro ao baixar áudio %s: %v", msg.ID, err)
		return "", false, fmt.Errorf("audio download failed: %w", err)
	}

	log.Printf("🎙️ [MediaWorker] Áudio baixado, enviando para Whisper (ID: %s) mime: %s", msg.ID, audioMimeType)
	// TODO(fase-5-ou-switchover): usar audioMimeType para derivar FileName dinamicamente,
	// igual ao groq_audio_adapter.go, quando este caminho for substituído por domain.ProcessAudioMessage.
	// Enquanto isso, audioMimeType é capturado (garante compilação e telemetria) mas NÃO altera o comportamento.
	transcription, err := w.cfg.Groq.Transcribe(audioCtx, groq.AudioTranscriptionRequest{
		FileData: audioData,
		FileName: "audio.ogg",
		Language: "pt",
	})
	if err != nil {
		return "", true, fmt.Errorf("audio_transcription_failed: %w", err)
	}

	cleanText := strings.TrimSpace(transcription.Text)
	if cleanText == "" {
		return "", true, fmt.Errorf("audio_transcription_empty")
	}

	// Cofre de Auditoria Efêmero (DT-42).
	//
	// Arquiva AQUI, logo após a transcrição, para que os bytes brutos vivam o
	// mínimo possível em memória: é o único ponto do fluxo onde eles existem, e
	// quanto antes saírem daqui, menor a superfície da biometria vocal.
	//
	// O arquivamento é best-effort DE PROPÓSITO. Se o cofre falhar, o registro
	// do produtor ainda precisa ser criado — perder o caderno de campo por
	// causa da cópia de auditoria seria inverter as prioridades. Mas a falha é
	// registrada em nível alto, porque significa que aquele registro específico
	// ficou SEM prova de não-repúdio, e isso não pode passar silencioso.
	//
	// final_intent vai vazio: a intenção só é decidida adiante, pelo roteador.
	// A coluna é anulável justamente para permitir esse preenchimento posterior.
	if w.cfg.AudioVault != nil {
		if err := w.cfg.AudioVault.ArchiveAudio(audioCtx, msg.From, audioData, ""); err != nil {
			log.Printf("🚨 [MediaWorker] Áudio NÃO arquivado no cofre (msg=%s): %v — este registro ficará sem prova de não-repúdio", msg.ID, err)
		}
	}

	// Descarte explícito da gravação bruta.
	//
	// Redundante para o coletor de lixo, que liberaria audioData ao fim da
	// função de qualquer forma. Está aqui como declaração de intenção: nenhum
	// caminho abaixo deste ponto deve voltar a tocar no áudio original, e
	// qualquer código futuro que tente fazê-lo encontra nil em vez de bytes.
	audioData = nil
	_ = audioData

	return cleanText, ports.ResolveResponseMode(msg), nil
}

// processImage baixa a imagem e gera descrição agronômica via Gemini.
func (w *MediaWorker) processImage(ctx context.Context, msg ports.IncomingMessage) (string, bool, error) {
	imageCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	imageBytes, mimeType, err := w.cfg.WhatsApp.DownloadImage(msg.ID, msg.RawPayload)
	if err != nil {
		return "", false, fmt.Errorf("image_download_failed: %w", err)
	}

	description, _, err := w.cfg.LLM.DescribeImage(imageCtx, imageBytes, mimeType)
	if err != nil {
		// Fallback: usa a legenda da imagem se disponível
		if msg.Body != "" {
			return msg.Body, false, nil
		}
		return "", false, fmt.Errorf("image_description_failed: %w", err)
	}

	// Se há legenda além da descrição, combina os dois
	if msg.Body != "" {
		return description + "\n\nLegenda do usuário: " + msg.Body, ports.ResolveResponseMode(msg), nil
	}
	return description, ports.ResolveResponseMode(msg), nil
}
