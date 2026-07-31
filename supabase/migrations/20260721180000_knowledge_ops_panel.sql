-- ============================================================
-- Migration: Knowledge Ops Panel — Fase 1
-- Created: 2026-07-21
-- Agent: database-architect
-- ============================================================
-- Separação clara entre artefato bruto (knowledge_documents),
-- revisões publicáveis (knowledge_versions), fila assíncrona
-- (ingestion_jobs) e observabilidade diagnóstica do RAG.
-- RBAC via custom claims JWT: knowledge_editor, knowledge_reviewer,
-- knowledge_publisher, knowledge_observer.
-- ============================================================

-- Helper: extrai o papel de knowledge do JWT custom claims
CREATE OR REPLACE FUNCTION public.get_knowledge_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'knowledge_role'),
    (auth.jwt() -> 'user_metadata' ->> 'knowledge_role'),
    'none'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 1. knowledge_documents: artefato bruto (PDF ou Markdown)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   TEXT NOT NULL,
  source_type             TEXT NOT NULL CHECK (source_type IN ('PDF', 'MARKDOWN')),
  storage_path            TEXT,                   -- caminho no Supabase Storage
  mime_type               TEXT,
  metadata                JSONB DEFAULT '{}'::jsonb,  -- cultura, praga, manejo, safra, região
  current_live_version_id UUID,                   -- FK preenchida após first publish
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. knowledge_versions: revisões auditáveis e publicáveis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content               TEXT,                  -- conteúdo Markdown extraído/curado
  content_format        TEXT NOT NULL DEFAULT 'MARKDOWN' CHECK (content_format IN ('MARKDOWN', 'RAW_TEXT')),
  version_number        INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'approved', 'live', 'archived')),
  supersedes_version_id UUID REFERENCES public.knowledge_versions(id) ON DELETE SET NULL,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at           TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  -- Uma versão live por documento (enforced via partial unique index)
  CONSTRAINT uk_one_live_per_document UNIQUE NULLS NOT DISTINCT (document_id, status)
    -- Workaround: constraint parcial via index abaixo
);
-- Remove a unique constraint acima (UNIQUE NULLS NOT DISTINCT pode não ser suportada em todas versões)
ALTER TABLE public.knowledge_versions
  DROP CONSTRAINT IF EXISTS uk_one_live_per_document;

-- Index parcial: só um 'live' por documento
CREATE UNIQUE INDEX IF NOT EXISTS uidx_one_live_per_document
  ON public.knowledge_versions (document_id)
  WHERE status = 'live';

-- FK reversa: documento aponta para sua versão live
ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT fk_current_live_version
  FOREIGN KEY (current_live_version_id)
  REFERENCES public.knowledge_versions(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- 3. ingestion_jobs: fila de tarefas para o Go Worker Pool
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  version_id    UUID REFERENCES public.knowledge_versions(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'extracting', 'chunking', 'embedding', 'indexed', 'failed')),
  step          TEXT,                   -- descrição do step atual ("chunking page 12 of 45")
  progress_pct  INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_log     TEXT,
  worker_id     TEXT,                   -- identificador do goroutine/worker que capturou o job
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para polling eficiente do worker (SELECT FOR UPDATE SKIP LOCKED)
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_pending
  ON public.ingestion_jobs (created_at ASC)
  WHERE status = 'pending';

-- ============================================================
-- 4. rag_query_logs: rastreio diagnóstico de cada inferência
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rag_query_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash            TEXT,                   -- SHA-256 da query (anonimiza PII)
  session_id            TEXT,
  route                 TEXT,                   -- AGRONOMY, DATABASE, CHAT, etc.
  retrieval_k           INTEGER,                -- K documentos solicitados
  retrieved_chunk_ids   BIGINT[],               -- IDs de farm_documents
  prompt_version        TEXT,
  knowledge_version_ids UUID[],                 -- versões OKF ativas na inferência
  answer_status         TEXT CHECK (answer_status IN ('answered', 'fallback', 'no_context', 'error')),
  fallback_used         BOOLEAN DEFAULT false,
  latency_ms_total      INTEGER,
  latency_ms_retrieval  INTEGER,
  latency_ms_generation INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_query_logs_created_at
  ON public.rag_query_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_query_logs_answer_status
  ON public.rag_query_logs (answer_status);

-- ============================================================
-- 5. rag_feedback: avaliação humana das respostas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rag_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id        UUID NOT NULL REFERENCES public.rag_query_logs(id) ON DELETE CASCADE,
  is_positive   BOOLEAN,
  feedback_type TEXT CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'correction', 'escalation')),
  comment       TEXT,
  reviewed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_status TEXT DEFAULT 'open' CHECK (review_status IN ('open', 'reviewed', 'dismissed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. Triggers para updated_at
-- ============================================================

-- Reutiliza handle_updated_at() já existente nas migrations anteriores

DROP TRIGGER IF EXISTS set_updated_at_knowledge_documents ON public.knowledge_documents;
CREATE TRIGGER set_updated_at_knowledge_documents
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 7. Row Level Security
-- ============================================================

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_query_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_feedback        ENABLE ROW LEVEL SECURITY;

-- ─── knowledge_documents ───────────────────────────────────────
-- Observers e acima podem LER documentos
CREATE POLICY "kd_select_observers"
  ON public.knowledge_documents FOR SELECT TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Apenas editors (e acima) criam documentos
CREATE POLICY "kd_insert_editors"
  ON public.knowledge_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Apenas publishers atualizam (ex: current_live_version_id)
CREATE POLICY "kd_update_publishers"
  ON public.knowledge_documents FOR UPDATE TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── knowledge_versions ────────────────────────────────────────
CREATE POLICY "kv_select_observers"
  ON public.knowledge_versions FOR SELECT TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "kv_insert_editors"
  ON public.knowledge_versions FOR INSERT TO authenticated
  WITH CHECK (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- A transição de status é controlada via check constraint + policy de UPDATE
-- draft -> approved: reviewer+
-- approved -> live: publisher only
-- live -> archived: publisher only
CREATE POLICY "kv_update_transitions"
  ON public.knowledge_versions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      public.get_knowledge_role() IN ('knowledge_reviewer','knowledge_publisher')
      AND (
        -- reviewer pode mover draft -> approved apenas
        (public.get_knowledge_role() = 'knowledge_reviewer' AND status = 'draft')
        OR
        -- publisher pode mover approved -> live OU live -> archived
        (public.get_knowledge_role() = 'knowledge_publisher')
      )
    )
  );

-- ─── ingestion_jobs ────────────────────────────────────────────
CREATE POLICY "ij_select_editors"
  ON public.ingestion_jobs FOR SELECT TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ij_insert_editors"
  ON public.ingestion_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- O worker Go usa a service role key (bypassa RLS), por isso não precisamos
-- de policy de UPDATE para workers — apenas a policy de INSERT é necessária
-- para o frontend enfileirar jobs.

-- ─── rag_query_logs ────────────────────────────────────────────
CREATE POLICY "rql_select_observers"
  ON public.rag_query_logs FOR SELECT TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- O bot insere via service role (bypass RLS) — sem policy INSERT para authenticated

-- ─── rag_feedback ──────────────────────────────────────────────
CREATE POLICY "rf_select_editors"
  ON public.rag_feedback FOR SELECT TO authenticated
  USING (
    public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "rf_insert_editors"
  ON public.rag_feedback FOR INSERT TO authenticated
  WITH CHECK (
    public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 8. Storage bucket para arquivos brutos
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-docs',
  'knowledge-docs',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'text/markdown', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- RLS no storage: apenas editors+ fazem upload
CREATE POLICY "storage_upload_editors"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-docs'
    AND (
      public.get_knowledge_role() IN ('knowledge_editor','knowledge_reviewer','knowledge_publisher')
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "storage_read_observers"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'knowledge-docs'
    AND (
      public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );
