-- Add new audit columns and refine state machine for LLM-as-a-Judge

ALTER TABLE public.rag_run_judgments
  ADD COLUMN IF NOT EXISTS evaluation_source text not null default 'async',
  ADD COLUMN IF NOT EXISTS is_latest boolean not null default true,
  ADD COLUMN IF NOT EXISTS judge_schema_version text not null default 'v1',
  ADD COLUMN IF NOT EXISTS criteria_json jsonb;

-- Explicitly constrain the status field for the state machine
ALTER TABLE public.rag_run_judgments
  DROP CONSTRAINT IF EXISTS check_rag_run_judgments_status;

ALTER TABLE public.rag_run_judgments
  ADD CONSTRAINT check_rag_run_judgments_status
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Add constraint for evaluation_source
ALTER TABLE public.rag_run_judgments
  DROP CONSTRAINT IF EXISTS check_rag_run_judgments_eval_source;

ALTER TABLE public.rag_run_judgments
  ADD CONSTRAINT check_rag_run_judgments_eval_source
  CHECK (evaluation_source IN ('async', 'batch', 'manual'));

-- Update existing records if any
UPDATE public.rag_run_judgments
SET criteria_json = raw_judgment
WHERE criteria_json IS NULL;

-- Function to ensure only one is_latest per run_id
CREATE OR REPLACE FUNCTION public.maintain_single_latest_judgment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE public.rag_run_judgments
    SET is_latest = false
    WHERE run_id = NEW.run_id
      AND id != NEW.id
      AND is_latest = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maintain_single_latest_judgment ON public.rag_run_judgments;
CREATE TRIGGER trg_maintain_single_latest_judgment
BEFORE INSERT OR UPDATE OF is_latest ON public.rag_run_judgments
FOR EACH ROW
EXECUTE FUNCTION public.maintain_single_latest_judgment();
