-- migrations/006_hitl_pending.sql
-- Human-in-the-Loop (HITL) approval queue for high-risk tool calls.
-- When the AI attempts a mutation (e.g. registrar_operacao_campo), this table
-- stores the paused context until the producer responds SIM or NÃO via WhatsApp.
--
-- Flow:
--   1. Orchestrator detects high-risk tool call
--   2. Inserts record into hitl_pending (status = 'waiting')
--   3. Sends WhatsApp confirmation prompt to producer
--   4. Webhook intercepts SIM/NÃO from the same phone
--   5a. SIM → executes the tool, marks hitl as 'approved', marks queue job done
--   5b. NÃO → marks hitl as 'rejected', sends cancellation message
--   5c. Timeout (10 min) → marked 'expired' by cleanup function
--
-- Design decisions:
--   - No job suspension: the ai_worker job completes normally with a "pending" notice.
--   - hitl_pending is a separate table (not coupled to message_queue schema).
--   - All state needed to re-execute is stored in tool_args JSONB.

CREATE TABLE IF NOT EXISTS hitl_pending (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Who originated the request
    from_phone   TEXT NOT NULL,
    pmo_id       BIGINT,
    user_id      TEXT,

    -- Which tool needs approval
    tool_name    TEXT NOT NULL,          -- e.g. 'registrar_operacao_campo'
    tool_args    JSONB NOT NULL,         -- Full args map to re-execute on approval
    
    -- Human-readable description sent to the producer
    action_label TEXT NOT NULL,          -- e.g. 'Registro de Aplicação de Composto Orgânico'

    -- Lifecycle
    status       TEXT NOT NULL DEFAULT 'waiting' CHECK (
        status IN ('waiting', 'approved', 'rejected', 'expired')
    ),

    -- Source job for traceability
    job_id       UUID REFERENCES message_queue(id) ON DELETE SET NULL
);

COMMENT ON TABLE hitl_pending IS
    'Stores HITL approval contexts for high-risk tool calls. Cleaned up after 10 min timeout.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Hot path: webhook lookup by phone (most common read)
CREATE INDEX IF NOT EXISTS idx_hitl_phone_waiting
    ON hitl_pending (from_phone, created_at DESC)
    WHERE status = 'waiting';

-- Dashboard: pending approvals list
CREATE INDEX IF NOT EXISTS idx_hitl_status
    ON hitl_pending (status, created_at DESC);

-- Expiry check
CREATE INDEX IF NOT EXISTS idx_hitl_expires
    ON hitl_pending (expires_at)
    WHERE status = 'waiting';

-- ---------------------------------------------------------------------------
-- View: Pending approvals for dashboard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW hitl_pending_view AS
SELECT
    id,
    created_at,
    expires_at,
    from_phone,
    tool_name,
    action_label,
    status,
    EXTRACT(EPOCH FROM (expires_at - NOW()))::INT AS seconds_until_expiry
FROM hitl_pending
WHERE status = 'waiting'
  AND expires_at > NOW()
ORDER BY created_at DESC;

COMMENT ON VIEW hitl_pending_view IS
    'Live HITL approvals awaiting producer response. Used by the security dashboard.';

-- ---------------------------------------------------------------------------
-- View: HITL audit trail (Dashboard KPI: approval rate)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW hitl_audit_summary AS
SELECT
    DATE_TRUNC('day', created_at)               AS day,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
    COUNT(*) FILTER (WHERE status = 'expired')  AS expired,
    COUNT(*)                                     AS total
FROM hitl_pending
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

COMMENT ON VIEW hitl_audit_summary IS
    'Daily HITL decision breakdown. Powers the approval rate KPI on the guardrail dashboard.';

-- ---------------------------------------------------------------------------
-- Cleanup function: expire timed-out approvals (run every 5 minutes via pg_cron)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expire_hitl_pending()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE hitl_pending
    SET status     = 'expired',
        updated_at = NOW()
    WHERE status     = 'waiting'
      AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    IF expired_count > 0 THEN
        RAISE LOG '[hitl_pending] Marked % requests as expired', expired_count;
    END IF;

    RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION expire_hitl_pending() IS
    'Marks waiting HITL requests as expired when their 10-min window passes. Run via pg_cron.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE hitl_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_hitl"
    ON hitl_pending
    FOR SELECT
    TO authenticated
    USING (true);

-- ---------------------------------------------------------------------------
-- pg_cron Scheduling
-- Requires the pg_cron extension to be enabled in Supabase (Database -> Extensions)
-- ---------------------------------------------------------------------------

-- Unschedule just in case it was already scheduled, suppressing errors if it doesn't exist
DO $$
BEGIN
  PERFORM cron.unschedule('expire_hitl_pending_job');
EXCEPTION WHEN OTHERS THEN
  -- Ignore error if job doesn't exist
END;
$$;

-- Schedule to run every 5 minutes
SELECT cron.schedule(
    'expire_hitl_pending_job',
    '*/5 * * * *',
    $$ SELECT expire_hitl_pending(); $$
);

