-- ADR-011 Task 1 — segue advisor de performance do Supabase: FK sem índice de cobertura.
CREATE INDEX IF NOT EXISTS conversations_pmo_id_idx ON public.conversations (pmo_id);
