-- ============================================================
-- Migration: RAG Multi-Model Benchmark Arena
-- Created: 2026-07-21
-- ============================================================

-- Tabela: rag_experiments (Armazena o snapshot do Retrieval)
CREATE TABLE IF NOT EXISTS public.rag_experiments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text                TEXT NOT NULL,
  query_normalized          TEXT,
  pmo_id                    BIGINT NOT NULL,
  retrieval_strategy        TEXT NOT NULL,
  retrieval_version         TEXT,
  top_k                     INTEGER NOT NULL,
  retrieved_chunks_snapshot JSONB NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela: rag_experiment_runs (Armazena os resultados de cada LLM)
CREATE TABLE IF NOT EXISTS public.rag_experiment_runs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id          UUID NOT NULL REFERENCES public.rag_experiments(id) ON DELETE CASCADE,
  provider_name          TEXT,
  requested_model_name   TEXT NOT NULL,
  actual_model_name      TEXT,
  prompt_version         TEXT,
  prompt_hash            TEXT,
  temperature            FLOAT,
  top_p                  FLOAT,
  max_tokens             INTEGER,
  execution_mode         TEXT DEFAULT 'parallel',
  status                 TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
  error_type             TEXT,
  response_text          TEXT,
  latency_ms             INTEGER,
  tokens_used_prompt     INTEGER,
  tokens_used_completion INTEGER,
  estimated_cost_usd     NUMERIC(10, 6),
  human_rating           INTEGER CHECK (human_rating BETWEEN 1 AND 5),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.rag_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_experiment_runs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para rag_experiments
CREATE POLICY "re_select_admins"
  ON public.rag_experiments FOR SELECT TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "re_insert_admins"
  ON public.rag_experiments FOR INSERT TO authenticated
  WITH CHECK (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "re_delete_admins"
  ON public.rag_experiments FOR DELETE TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Políticas de RLS para rag_experiment_runs
CREATE POLICY "rer_select_admins"
  ON public.rag_experiment_runs FOR SELECT TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rer_insert_admins"
  ON public.rag_experiment_runs FOR INSERT TO authenticated
  WITH CHECK (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rer_update_admins"
  ON public.rag_experiment_runs FOR UPDATE TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rer_delete_admins"
  ON public.rag_experiment_runs FOR DELETE TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_rag_experiments_pmo_id ON public.rag_experiments(pmo_id);
CREATE INDEX IF NOT EXISTS idx_rag_experiments_created_at ON public.rag_experiments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_experiment_runs_experiment_id ON public.rag_experiment_runs(experiment_id);
CREATE INDEX IF NOT EXISTS idx_rag_experiment_runs_status ON public.rag_experiment_runs(status);
