-- ============================================================
-- Migration: Knowledge Ops — Supabase RPCs (atomic operations)
-- Created: 2026-07-21
-- ============================================================

-- ─── 1. claim_next_ingestion_job ────────────────────────────────────────────
-- Called by the Go Worker Pool. Uses SELECT FOR UPDATE SKIP LOCKED to
-- ensure only one worker processes a given job at a time.
-- Returns the claimed job row (or empty set if nothing is pending).
CREATE OR REPLACE FUNCTION public.claim_next_ingestion_job(p_worker_id TEXT)
RETURNS SETOF public.ingestion_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job public.ingestion_jobs;
BEGIN
  SELECT *
    INTO v_job
    FROM public.ingestion_jobs
   WHERE status = 'pending'
     AND attempt_count < 3
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN; -- empty set
  END IF;

  -- Claim the job: set status to 'extracting' and record the worker
  UPDATE public.ingestion_jobs
     SET status        = 'extracting',
         worker_id     = p_worker_id,
         attempt_count = attempt_count + 1,
         started_at    = now(),
         step          = 'extracting'
   WHERE id = v_job.id;

  RETURN NEXT v_job;
END;
$$;

-- ─── 2. publish_knowledge_version ───────────────────────────────────────────
-- Atomically:
--   a) Archives the current live version for the same document (if any).
--   b) Moves the target version to 'live'.
--   c) Updates knowledge_documents.current_live_version_id.
CREATE OR REPLACE FUNCTION public.publish_knowledge_version(p_version_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_doc_id UUID;
BEGIN
  -- Retrieve the document this version belongs to
  SELECT document_id INTO v_doc_id
    FROM public.knowledge_versions
   WHERE id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found: %', p_version_id;
  END IF;

  -- Archive any existing live version for this document
  UPDATE public.knowledge_versions
     SET status      = 'archived',
         published_at = now()
   WHERE document_id = v_doc_id
     AND status      = 'live';

  -- Publish the target version
  UPDATE public.knowledge_versions
     SET status       = 'live',
         published_at = now()
   WHERE id = p_version_id;

  -- Point the document to its new live version
  UPDATE public.knowledge_documents
     SET current_live_version_id = p_version_id,
         updated_at = now()
   WHERE id = v_doc_id;
END;
$$;
