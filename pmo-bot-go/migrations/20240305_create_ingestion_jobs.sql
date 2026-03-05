-- Migration: Create ingestion_jobs table
-- Description: Tracks the status of PDF ingestion and vectorization.

CREATE TYPE ingestion_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id BIGINT NOT NULL,
    file_name TEXT NOT NULL,
    status ingestion_status DEFAULT 'pending',
    total_chunks INTEGER DEFAULT 0,
    processed_chunks INTEGER DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_pmo_id ON public.ingestion_jobs(pmo_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ingestion_jobs_updated_at
    BEFORE UPDATE ON public.ingestion_jobs
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
