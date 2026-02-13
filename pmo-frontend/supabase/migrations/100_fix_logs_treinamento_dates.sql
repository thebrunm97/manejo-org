-- Migration: Fix logs_treinamento timestamps
-- Reason: Ensure no "Invalid Date" in Admin Dashboard by enforcing created_at
-- Date: 2026-01-24

-- 1. Ensure column exists and has default
ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Backfill NULL values with current time (so they don't break UI)
UPDATE logs_treinamento 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- 3. Enforce NOT NULL constraint to prevent future bad data
ALTER TABLE logs_treinamento 
ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE logs_treinamento 
ALTER COLUMN created_at SET NOT NULL;

-- 4. Optional: Index for sorting by date
CREATE INDEX IF NOT EXISTS idx_logs_treinamento_date 
ON logs_treinamento(created_at DESC);
