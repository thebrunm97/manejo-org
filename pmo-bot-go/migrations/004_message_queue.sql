-- migrations/004_message_queue.sql
-- Harness de Produção: Fila durável de mensagens para o bot WhatsApp.
-- Garante que nenhuma mensagem seja silenciosamente descartada em picos de CPU.
--
-- Padrão: SELECT FOR UPDATE SKIP LOCKED (PostgreSQL native queue pattern)

-- ---------------------------------------------------------------------------
-- Tabela principal da fila
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS message_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    msg_id          TEXT NOT NULL,                        -- WhatsApp message ID (dedup)
    from_phone      TEXT NOT NULL,
    raw_payload     JSONB NOT NULL,                       -- IncomingMessage completo serializado
    body_text       TEXT,                                 -- Preenchido após processamento de mídia (Camada 3)
    respond_audio   BOOLEAN NOT NULL DEFAULT FALSE,       -- Indica se a resposta deve ser em áudio
    status          TEXT NOT NULL DEFAULT 'pending',
    -- Status válidos:
    --   pending       → aguardando Media Worker
    --   processing    → Media Worker travou o job (SKIP LOCKED)
    --   ai_pending    → texto extraído, aguardando AI Worker
    --   ai_processing → AI Worker travou o job
    --   done          → processado com sucesso
    --   failed        → excedeu max_attempts (dead letter)
    attempt_count   INT NOT NULL DEFAULT 0,
    max_attempts    INT NOT NULL DEFAULT 3,
    error_msg       TEXT,                                 -- Último erro registrado
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at      TIMESTAMPTZ,                          -- Quando o worker assumiu o job
    processed_at    TIMESTAMPTZ,                          -- Quando foi marcado como done/failed
    next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- Backoff: controla quando retomar
);

-- ---------------------------------------------------------------------------
-- Índices para performance do worker polling (hot path)
-- ---------------------------------------------------------------------------

-- Índice principal para polling de media workers (pending → processing)
CREATE INDEX IF NOT EXISTS idx_mq_media_poll
    ON message_queue (next_retry_at ASC, created_at ASC)
    WHERE status IN ('pending', 'failed')
      AND attempt_count < max_attempts;

-- Índice para polling de AI workers (ai_pending → ai_processing)
CREATE INDEX IF NOT EXISTS idx_mq_ai_poll
    ON message_queue (created_at ASC)
    WHERE status = 'ai_pending';

-- Índice de deduplicação (evita double-insert do mesmo msg_id do WhatsApp)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mq_msg_id
    ON message_queue (msg_id);

-- Índice por telefone (para debug e consultas operacionais)
CREATE INDEX IF NOT EXISTS idx_mq_phone
    ON message_queue (from_phone, created_at DESC);

-- ---------------------------------------------------------------------------
-- View: Dead Letter Queue (jobs que falharam 3x)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW message_queue_dead_letter AS
SELECT
    id,
    msg_id,
    from_phone,
    status,
    attempt_count,
    max_attempts,
    error_msg,
    created_at,
    processed_at,
    -- Calcula tempo total de processamento
    EXTRACT(EPOCH FROM (processed_at - created_at))::INT AS processing_seconds,
    -- Preview do payload para diagnóstico
    (raw_payload ->> 'Body')::TEXT AS message_preview
FROM message_queue
WHERE status = 'failed'
ORDER BY created_at DESC;

COMMENT ON VIEW message_queue_dead_letter IS
    'Jobs que excederam max_attempts. Use esta view para diagnóstico de falhas persistentes.';

-- ---------------------------------------------------------------------------
-- View: Fila em tempo real (para monitoramento operacional)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW message_queue_monitor AS
SELECT
    status,
    COUNT(*) AS total,
    AVG(attempt_count)::NUMERIC(4,1) AS avg_attempts,
    MIN(created_at) AS oldest_job,
    MAX(created_at) AS newest_job
FROM message_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status;

COMMENT ON VIEW message_queue_monitor IS
    'Snapshot operacional da fila das últimas 24h. Use para monitorar a saúde do Harness.';

-- ---------------------------------------------------------------------------
-- Função: Limpeza automática de jobs concluídos (TTL = 7 dias)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_message_queue()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM message_queue
    WHERE status = 'done'
      AND processed_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE LOG '[message_queue] Limpeza automática: % jobs removidos (done + 7 dias)', deleted_count;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_message_queue() IS
    'Remove jobs com status done com mais de 7 dias. Deve ser chamada periodicamente pelo Harness.';

-- ---------------------------------------------------------------------------
-- Função: Reserva de jobs (Polling com SKIP LOCKED)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_next_message_job(
    p_from_status TEXT,
    p_target_status TEXT,
    p_worker_id TEXT
)
RETURNS SETOF message_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE message_queue
  SET status = p_target_status,
      claimed_at = NOW()
  WHERE id = (
    SELECT id FROM message_queue
    WHERE status = p_from_status
      AND next_retry_at <= NOW()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
END;
$$;

COMMENT ON FUNCTION public.claim_next_message_job IS 
    'Reserva atomicamente o próximo job da fila usando SKIP LOCKED para suportar múltiplos workers.';
