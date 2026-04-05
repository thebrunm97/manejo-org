-- ==============================================================================
-- Migration: Performance Tuning (Database Indexing)
-- Objective: Optimize "Fat Database" JSONB lookup and B-Tree composite queries
-- to avoid sequential scans and pooler connection exhaustion.
-- ==============================================================================

-- 1. JSONB Indexes (GIN) for `caderno_campo`.
-- The audit recommended "metadata", but the actual schema JSONB columns are 
-- `detalhes_tecnicos` and `atividades`.
CREATE INDEX IF NOT EXISTS idx_caderno_campo_detalhes_tecnicos 
ON public.caderno_campo USING GIN (detalhes_tecnicos);

CREATE INDEX IF NOT EXISTS idx_caderno_campo_atividades 
ON public.caderno_campo USING GIN (atividades);

-- 2. Composite B-Tree Indexes for Time Series
-- Extremely high volume insert tables queried by date and user_id.

CREATE INDEX IF NOT EXISTS idx_logs_consumo_user_date 
ON public.logs_consumo (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_treinamento_user_date 
ON public.logs_treinamento (user_id, created_at DESC);

-- `execution_metadata` doesn't have user_id / created_at; it relies on executionId and key.
-- Creating an index on these primary lookup fields:
CREATE INDEX IF NOT EXISTS idx_execution_metadata_lookup 
ON public.execution_metadata ("executionId", "key");
