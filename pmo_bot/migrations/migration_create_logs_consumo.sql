-- Migration: Create logs_consumo table and atomic increment RPC
-- Date: 2024-01-23

-- 1. Create logs_consumo table
CREATE TABLE IF NOT EXISTS logs_consumo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id VARCHAR(50),
    tokens_prompt INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    modelo_ia VARCHAR(100),
    acao VARCHAR(50),
    custo_estimado DECIMAL(10, 6) DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50), -- 'success', 'error', 'blocked'
    meta JSONB DEFAULT '{}'::jsonb
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_logs_consumo_user_id ON logs_consumo(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_consumo_created_at ON logs_consumo(created_at);

-- 2. Create RPC for Atomic Increment (Thread-safe)
-- This prevents race conditions when multiple requests come in simultaneously
CREATE OR REPLACE FUNCTION increment_usage_stats(
    p_user_id UUID, 
    p_tokens INTEGER, 
    p_credits_cost INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET 
        total_tokens_used = COALESCE(total_tokens_used, 0) + p_tokens,
        daily_request_count = CASE 
            -- Reset count if it's a new day (simple check based on last_usage_date vs today)
            WHEN last_usage_date IS NULL OR last_usage_date != CURRENT_DATE THEN p_credits_cost
            ELSE COALESCE(daily_request_count, 0) + p_credits_cost
        END,
        last_usage_date = CURRENT_DATE
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;
