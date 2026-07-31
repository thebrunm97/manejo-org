-- Add telemetry and cost tracking columns to rag_experiment_runs
ALTER TABLE rag_experiment_runs
ADD COLUMN IF NOT EXISTS tokens_cache_read INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tokens_cache_write INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS exact_cost_usd NUMERIC(10,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS openrouter_generation_id TEXT;
