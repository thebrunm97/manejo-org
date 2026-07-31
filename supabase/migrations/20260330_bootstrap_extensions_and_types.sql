-- Migration: Bootstrap — Extensions & Custom Types
-- Created at: 2026-03-30
-- MUST run before all other migrations.
-- These objects existed only in prod (created via Supabase dashboard) and were
-- never versioned. This migration makes the local stack reproducible.

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector"     WITH SCHEMA extensions;

-- pg_cron is available in Supabase Cloud but may not be in local dev; skip gracefully.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available in this environment, skipping.';
END $$;

-- ── Custom ENUM Types ─────────────────────────────────────────────────────────

-- Modalidade de produção agropecuária
DO $$
BEGIN
    CREATE TYPE public.modalidade_producao_enum AS ENUM (
        'ORGANICO',
        'CONVENCIONAL',
        'TRANSICAO'
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Type modalidade_producao_enum already exists, skipping.';
END $$;

-- Status de jobs de ingestão RAG
DO $$
BEGIN
    CREATE TYPE public.ingestion_job_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'failed'
    );
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Type ingestion_job_status already exists, skipping.';
END $$;
