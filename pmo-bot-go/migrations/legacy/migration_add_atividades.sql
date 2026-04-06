-- Migration: Add multi-culture support to caderno_campo
-- Date: 2026-01-12
-- Description: Adds atividades (JSONB), sistema, and status columns for multi-crop/multi-location support
--
-- IMPORTANT: Run this migration in Supabase SQL Editor
-- Make a backup before running in production!

-- ============================================================================
-- STEP 1: Add 'atividades' column (JSONB, nullable)
-- This stores the array of activities [{produto, quantidade, unidade, local}, ...]
-- ============================================================================
ALTER TABLE caderno_campo 
ADD COLUMN IF NOT EXISTS atividades JSONB DEFAULT NULL;

COMMENT ON COLUMN caderno_campo.atividades IS 'Array of activities: [{produto, quantidade, unidade, local: {talhao, canteiro}}]. Supports multi-crop and multi-location records.';

-- ============================================================================
-- STEP 2: Add 'sistema' column (TEXT, nullable)
-- Values: 'monocultura', 'consorcio', 'saf'
-- ============================================================================
ALTER TABLE caderno_campo 
ADD COLUMN IF NOT EXISTS sistema TEXT DEFAULT 'monocultura';

COMMENT ON COLUMN caderno_campo.sistema IS 'Cropping system: monocultura, consorcio, or saf';

-- Add constraint to validate allowed values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'caderno_campo_sistema_check'
    ) THEN
        ALTER TABLE caderno_campo 
        ADD CONSTRAINT caderno_campo_sistema_check 
        CHECK (sistema IS NULL OR sistema IN ('monocultura', 'consorcio', 'saf'));
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Add 'status' column (TEXT, nullable)
-- Values: 'pendente', 'realizado', 'cancelado'
-- ============================================================================
ALTER TABLE caderno_campo 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'realizado';

COMMENT ON COLUMN caderno_campo.status IS 'Activity status: pendente, realizado, cancelado';

-- Add constraint to validate allowed values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'caderno_campo_status_check'
    ) THEN
        ALTER TABLE caderno_campo 
        ADD CONSTRAINT caderno_campo_status_check 
        CHECK (status IS NULL OR status IN ('pendente', 'realizado', 'cancelado'));
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Create index on atividades for faster queries on produto
-- Uses GIN index for JSONB containment queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_caderno_campo_atividades 
ON caderno_campo USING GIN (atividades);

-- ============================================================================
-- STEP 5: Verify migration
-- ============================================================================
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'caderno_campo' 
    AND column_name IN ('atividades', 'sistema', 'status');
    
    IF col_count = 3 THEN
        RAISE NOTICE 'Migration successful: 3 new columns added to caderno_campo';
    ELSE
        RAISE WARNING 'Migration may be incomplete: only % of 3 columns found', col_count;
    END IF;
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (in case of issues)
-- Uncomment and run if you need to rollback
-- ============================================================================
-- ALTER TABLE caderno_campo DROP COLUMN IF EXISTS atividades;
-- ALTER TABLE caderno_campo DROP COLUMN IF EXISTS sistema;
-- ALTER TABLE caderno_campo DROP COLUMN IF EXISTS status;
