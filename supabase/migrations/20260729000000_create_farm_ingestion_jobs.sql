-- Migration: Create farm_ingestion_jobs table
-- Created: 2026-07-29

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.farm_ingestion_jobs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id            BIGINT NOT NULL REFERENCES public.pmos(id) ON DELETE CASCADE,
    file_name         TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_chunks      INTEGER DEFAULT 0,
    processed_chunks  INTEGER DEFAULT 0,
    error_message     TEXT,
    created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_farm_ingestion_jobs_pmo_id ON public.farm_ingestion_jobs(pmo_id);

-- 2. Trigger function (ensure exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger execution
DROP TRIGGER IF EXISTS update_farm_ingestion_jobs_updated_at ON public.farm_ingestion_jobs;
CREATE TRIGGER update_farm_ingestion_jobs_updated_at
    BEFORE UPDATE ON public.farm_ingestion_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS (Row Level Security)
ALTER TABLE public.farm_ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários acessam jobs de seus PMOs" ON public.farm_ingestion_jobs;
CREATE POLICY "Usuários acessam jobs de seus PMOs"
ON public.farm_ingestion_jobs FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.pmos
        WHERE pmos.id = farm_ingestion_jobs.pmo_id
          AND pmos.user_id = auth.uid()
    )
);
