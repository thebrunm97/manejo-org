-- migrations/005_guardrail_events.sql
-- Observability layer for the AI Defensive Guardrails framework.
-- Stores structured audit records for every guardrail trigger (input, tool, output).
--
-- Consumed by: QueueDashboardTab.tsx via Supabase REST API.
-- Written by:  internal/guardrails/logger_supabase.go (async, fire-and-forget).
--
-- Design decisions:
--   - Append-only table (no updates): every event is immutable for audit integrity.
--   - JSONB violations column: flexible schema for evolving violation types.
--   - 90-day TTL via cleanup function: balances observability vs storage cost.
--   - Partial index on blocked=true: dashboard queries blocked events most often.

-- ---------------------------------------------------------------------------
-- Main audit table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS guardrail_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Which pipeline layer produced this event
    layer       TEXT NOT NULL CHECK (layer IN ('input', 'tool', 'output')),

    -- Stable filter identifier (e.g. 'pii_scrubber', 'injection_detector', 'gemini_judge')
    filter_name TEXT NOT NULL,

    -- The user's WhatsApp number (may be omitted for system-level events)
    phone       TEXT,

    -- Reference to the message_queue job that triggered this event
    job_id      UUID REFERENCES message_queue(id) ON DELETE SET NULL,

    -- Whether this event caused the request to be blocked
    blocked     BOOLEAN NOT NULL DEFAULT FALSE,

    -- Aggregate risk score 0.0–1.0
    risk_score  DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Human-readable block reason (populated only when blocked=true)
    reason      TEXT,

    -- Structured array of individual policy violations
    -- Each element: { rule, severity, match (truncated), confidence }
    violations  JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Arbitrary key-value metadata for extensibility
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE guardrail_events IS
    'Append-only audit log for AI guardrail triggers. Written asynchronously by the Go backend.';

COMMENT ON COLUMN guardrail_events.job_id IS
    'References message_queue.id — nullable to allow orphaned events if job was already cleaned up.';

-- ---------------------------------------------------------------------------
-- Indexes optimized for Dashboard read patterns
-- ---------------------------------------------------------------------------

-- Time-series queries (most common: "show last N events")
CREATE INDEX IF NOT EXISTS idx_ge_created_at
    ON guardrail_events (created_at DESC);

-- Filtering by layer (Input / Tool / Output tabs in dashboard)
CREATE INDEX IF NOT EXISTS idx_ge_layer_created
    ON guardrail_events (layer, created_at DESC);

-- Hot path: blocked events for security monitoring
CREATE INDEX IF NOT EXISTS idx_ge_blocked_events
    ON guardrail_events (created_at DESC)
    WHERE blocked = TRUE;

-- Per-phone audit trail
CREATE INDEX IF NOT EXISTS idx_ge_phone
    ON guardrail_events (phone, created_at DESC)
    WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- View: Hourly KPIs for Dashboard cards
-- ---------------------------------------------------------------------------
-- Used by the React QueueDashboardTab to display the 3 security KPI cards.
-- Refreshed implicitly (non-materialized view — cheap for moderate event volumes).

CREATE OR REPLACE VIEW guardrail_kpi_hourly AS
SELECT
    layer,
    filter_name,
    DATE_TRUNC('hour', created_at)                              AS hour_bucket,
    COUNT(*)                                                    AS total_events,
    COUNT(*) FILTER (WHERE blocked = TRUE)                      AS blocked_count,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE blocked = TRUE)
        / NULLIF(COUNT(*), 0),
        2
    )                                                           AS block_rate_pct,
    ROUND(AVG(risk_score)::NUMERIC, 3)                         AS avg_risk_score
FROM guardrail_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY layer, filter_name, DATE_TRUNC('hour', created_at)
ORDER BY hour_bucket DESC, blocked_count DESC;

COMMENT ON VIEW guardrail_kpi_hourly IS
    'Hourly aggregation of guardrail events for dashboard KPI cards. 7-day rolling window.';

-- ---------------------------------------------------------------------------
-- View: Recent blocked events (Feed for dashboard alert panel)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW guardrail_recent_blocks AS
SELECT
    ge.id,
    ge.created_at,
    ge.layer,
    ge.filter_name,
    ge.phone,
    ge.job_id,
    ge.risk_score,
    ge.reason,
    ge.violations
FROM guardrail_events ge
WHERE ge.blocked = TRUE
ORDER BY ge.created_at DESC
LIMIT 100;

COMMENT ON VIEW guardrail_recent_blocks IS
    'Last 100 blocked guardrail events. Scrollable security feed for the dashboard.';

-- ---------------------------------------------------------------------------
-- Cleanup function: 90-day TTL for guardrail events
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cleanup_guardrail_events()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM guardrail_events
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE LOG '[guardrail_events] Cleanup: % events removed (>90 days)', deleted_count;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_guardrail_events() IS
    'Removes guardrail_events older than 90 days. Should run weekly via pg_cron or Supabase Edge Functions.';

-- ---------------------------------------------------------------------------
-- RLS: Enable row-level security (allow service role full access)
-- ---------------------------------------------------------------------------

ALTER TABLE guardrail_events ENABLE ROW LEVEL SECURITY;

-- Service role (used by the Go backend) bypasses RLS entirely.
-- No additional policy needed — service_role is a superuser in PostgREST.

-- Read-only policy for authenticated dashboard users (admin role)
CREATE POLICY "admin_read_guardrail_events"
    ON guardrail_events
    FOR SELECT
    TO authenticated
    USING (true);
