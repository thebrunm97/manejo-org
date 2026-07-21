package queue

// Package queue implementa o Harness de Produção de 6 camadas para o bot WhatsApp.
// Usa PostgreSQL como fila durável via SELECT FOR UPDATE SKIP LOCKED, garantindo
// que nenhuma mensagem seja silenciosamente descartada em picos de CPU ou deploys.
//
// Fluxo:
//
//	Webhook → Enqueue → [Media Worker] → [AI Worker] → Delivery → Done
//
// Status de job:
//
//	pending       → aguardando Media Worker
//	processing    → Media Worker em execução (SKIP LOCKED)
//	ai_pending    → texto extraído, aguardando AI Worker
//	ai_processing → AI Worker em execução
//	done          → processado com sucesso
//	failed        → excedeu max_attempts (dead letter)

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// Job representa um item na fila de processamento.
type Job struct {
	ID           string
	MsgID        string
	FromPhone    string
	RawPayload   ports.IncomingMessage
	BodyText     string // Vazio até a Camada 3 (Media Worker) preencher
	RespondAudio bool   // True se a mensagem original era áudio
	Status       string
	AttemptCount int
	MaxAttempts  int
}

// JobMeta contém metadados de conclusão para audit trail.
type JobMeta struct {
	Reason         string
	TokensUsed     int
	LatencyMs      int64
	ModelEffective string
}

// jobRow espelha a struct da tabela message_queue para parse de JSON.
type jobRow struct {
	ID           string          `json:"id"`
	MsgID        string          `json:"msg_id"`
	FromPhone    string          `json:"from_phone"`
	RawPayload   json.RawMessage `json:"raw_payload"`
	BodyText     *string         `json:"body_text"`
	RespondAudio bool            `json:"respond_audio"`
	Status       string          `json:"status"`
	AttemptCount int             `json:"attempt_count"`
	MaxAttempts  int             `json:"max_attempts"`
}

// supabaseConfig armazena as credenciais para chamadas diretas via HTTP.
// Usa a mesma conexão do supabase.Client existente via REST API.
type supabaseConfig struct {
	url string
	key string
}

// Manager gerencia o ciclo de vida dos jobs na fila PostgreSQL.
// Usa SELECT FOR UPDATE SKIP LOCKED para garantir que múltiplos workers
// não processem o mesmo job simultaneamente.
type Manager struct {
	cfg        supabaseConfig
	httpClient *http.Client
}

// NewManager cria um novo Manager de fila.
func NewManager(supabaseURL, supabaseKey string) *Manager {
	return &Manager{
		cfg: supabaseConfig{
			url: supabaseURL,
			key: supabaseKey,
		},
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Enqueue insere uma nova mensagem na fila.
// Usa upsert por msg_id para garantir idempotência (dedup automático).
// Retorna nil se a mensagem já estava na fila (duplicata ignorada com segurança).
func (m *Manager) Enqueue(ctx context.Context, msg ports.IncomingMessage) error {
	rawPayload, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("queue.Enqueue: falha ao serializar payload: %w", err)
	}

	record := map[string]interface{}{
		"msg_id":        msg.ID,
		"from_phone":    msg.From,
		"raw_payload":   json.RawMessage(rawPayload),
		"respond_audio": msg.IsAudio,
		"status":        "pending",
	}

	payload, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("queue.Enqueue: falha ao serializar record: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/message_queue", m.cfg.url)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("queue.Enqueue: falha ao criar request: %w", err)
	}
	m.setHeaders(req)
	// onConflict=msg_id: ignora silenciosamente duplicatas (dedup por WhatsApp msgID)
	req.Header.Set("Prefer", "resolution=ignore-duplicates,return=minimal")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("queue.Enqueue: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("queue.Enqueue: supabase error (%d): %s", resp.StatusCode, string(body))
	}

	log.Printf("📬 [Queue] Job enfileirado: msgID=%s from=%s", msg.ID, msg.From)
	return nil
}

// Claim busca e trava atomicamente o próximo job pendente.
// Usa a RPC 'claim_next_message_job' que executa o SELECT FOR UPDATE SKIP LOCKED.
// Retorna nil, nil se não há jobs disponíveis.
func (m *Manager) Claim(ctx context.Context, workerID string) (*Job, error) {
	return m.claimByStatus(ctx, workerID, "pending")
}

// ClaimAIPending busca e trava o próximo job pronto para processamento de IA.
func (m *Manager) ClaimAIPending(ctx context.Context, workerID string) (*Job, error) {
	return m.claimByStatus(ctx, workerID, "ai_pending")
}

// claimByStatus implementa o SKIP LOCKED via RPC para evitar duplo processamento.
func (m *Manager) claimByStatus(ctx context.Context, workerID, fromStatus string) (*Job, error) {
	targetStatus := "processing"
	if fromStatus == "ai_pending" {
		targetStatus = "ai_processing"
	}

	// Usa RPC PostgreSQL para atomicidade do SKIP LOCKED.
	// A RPC faz o UPDATE + RETURNING em uma única transação.
	args := map[string]interface{}{
		"p_from_status":   fromStatus,
		"p_target_status": targetStatus,
		"p_worker_id":     workerID,
	}

	payload, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("queue.Claim: marshal error: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/rpc/claim_next_message_job", m.cfg.url)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("queue.Claim: request error: %w", err)
	}
	m.setHeaders(req)

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("queue.Claim: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("queue.Claim: supabase error (%d): %s", resp.StatusCode, string(body))
	}

	// Resposta vazia significa fila vazia — não é erro
	if len(body) == 0 || string(body) == "null" || string(body) == "[]" {
		return nil, nil
	}

	// A RPC retorna um objeto único (não array)
	var row jobRow
	if body[0] == '[' {
		var rows []jobRow
		if err := json.Unmarshal(body, &rows); err != nil {
			return nil, fmt.Errorf("queue.Claim: parse error: %w", err)
		}
		if len(rows) == 0 {
			return nil, nil
		}
		row = rows[0]
	} else {
		if err := json.Unmarshal(body, &row); err != nil {
			return nil, fmt.Errorf("queue.Claim: parse error: %w", err)
		}
	}

	// Desserializa o raw_payload de volta para IncomingMessage
	var msg ports.IncomingMessage
	if err := json.Unmarshal(row.RawPayload, &msg); err != nil {
		// Não bloqueia — marca o job como falho e continua
		_ = m.MarkFailed(ctx, row.ID, fmt.Sprintf("payload_parse_error: %v", err), 0)
		return nil, nil
	}

	var bodyText string
	if row.BodyText != nil {
		bodyText = *row.BodyText
	}

	return &Job{
		ID:           row.ID,
		MsgID:        row.MsgID,
		FromPhone:    row.FromPhone,
		RawPayload:   msg,
		BodyText:     bodyText,
		RespondAudio: row.RespondAudio,
		Status:       row.Status,
		AttemptCount: row.AttemptCount,
		MaxAttempts:  row.MaxAttempts,
	}, nil
}

// MarkAIPending atualiza o job com o texto processado e avança para ai_pending.
// Chamado pelo Media Worker após transcrição/extração bem-sucedida.
func (m *Manager) MarkAIPending(ctx context.Context, jobID, bodyText string, respondAudio bool) error {
	update := map[string]interface{}{
		"status":        "ai_pending",
		"body_text":     bodyText,
		"respond_audio": respondAudio,
		"claimed_at":    nil,
	}
	return m.updateJob(ctx, jobID, update)
}

// MarkDone finaliza o job com sucesso e registra metadados de audit.
func (m *Manager) MarkDone(ctx context.Context, jobID string, meta JobMeta) error {
	log.Printf("✅ [Queue] Job concluído: id=%s reason=%s tokens=%d latency=%dms",
		jobID, meta.Reason, meta.TokensUsed, meta.LatencyMs)

	update := map[string]interface{}{
		"status":       "done",
		"processed_at": time.Now().UTC().Format(time.RFC3339),
		"error_msg":    nil,
	}
	return m.updateJob(ctx, jobID, update)
}

// MarkFailed registra falha, incrementa attempt_count e agenda o próximo retry.
// Backoff: 1ª falha=30s, 2ª=5min, 3ª+=dead letter (status=failed).
func (m *Manager) MarkFailed(ctx context.Context, jobID, reason string, currentAttempt int) error {
	nextAttempt := currentAttempt + 1

	// Calcula backoff exponencial
	var retryDelay time.Duration
	var newStatus string

	switch nextAttempt {
	case 1:
		retryDelay = 30 * time.Second
		newStatus = "pending"
	case 2:
		retryDelay = 5 * time.Minute
		newStatus = "pending"
	default:
		// Dead letter: sem mais tentativas
		newStatus = "failed"
		retryDelay = 0
		log.Printf("💀 [Queue] Dead letter: id=%s attempts=%d reason=%s", jobID, nextAttempt, reason)
	}

	update := map[string]interface{}{
		"status":        newStatus,
		"attempt_count": nextAttempt,
		"error_msg":     reason,
		"processed_at":  time.Now().UTC().Format(time.RFC3339),
	}

	if retryDelay > 0 {
		update["next_retry_at"] = time.Now().Add(retryDelay).UTC().Format(time.RFC3339)
		update["processed_at"] = nil
		log.Printf("🔄 [Queue] Retry agendado: id=%s attempt=%d/%d next_in=%s reason=%s",
			jobID, nextAttempt, 3, retryDelay, reason)
	}

	return m.updateJob(ctx, jobID, update)
}

// RunCleanup remove jobs done com mais de 7 dias.
// Deve ser chamado periodicamente pelo Harness (ex: a cada 6 horas).
func (m *Manager) RunCleanup(ctx context.Context) error {
	reqURL := fmt.Sprintf("%s/rest/v1/rpc/cleanup_message_queue", m.cfg.url)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader([]byte("{}")))
	if err != nil {
		return fmt.Errorf("queue.RunCleanup: request error: %w", err)
	}
	m.setHeaders(req)

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("queue.RunCleanup: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("🧹 [Queue] Limpeza automática executada: %s", string(body))
	return nil
}

// updateJob é o helper interno para atualizar campos de um job via REST.
func (m *Manager) updateJob(ctx context.Context, jobID string, fields map[string]interface{}) error {
	payload, err := json.Marshal(fields)
	if err != nil {
		return fmt.Errorf("queue.updateJob: marshal error: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/message_queue?id=eq.%s", m.cfg.url, jobID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, reqURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("queue.updateJob: request error: %w", err)
	}
	m.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("queue.updateJob: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("queue.updateJob: supabase error (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// setHeaders aplica os headers padrão do Supabase REST API.
func (m *Manager) setHeaders(req *http.Request) {
	req.Header.Set("apikey", m.cfg.key)
	req.Header.Set("Authorization", "Bearer "+m.cfg.key)
	req.Header.Set("Content-Type", "application/json")
}
