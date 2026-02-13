-- Migration to fix logs_treinamento schema (FINAL)
-- Adds all missing columns identified during debugging (created_at, processado, modelo_ia)

-- 1. Ensure created_at exists (TIMESTAMP with Timezone)
ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure processado exists (Boolean flag for UI)
ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS processado BOOLEAN DEFAULT FALSE;

-- 3. Ensure modelo_ia exists (Identified as missing in logs)
ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS modelo_ia TEXT DEFAULT 'llama-3-70b';

-- 4. Ensure validado exists (Used by Python backend)
ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS validado BOOLEAN DEFAULT FALSE;

-- 5. Ensure pmo_id exists (Foreign Key context)
ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS pmo_id BIGINT;

-- Comments for documentation
COMMENT ON COLUMN logs_treinamento.created_at IS 'Data de criação do log (necessário para ordenação)';
COMMENT ON COLUMN logs_treinamento.processado IS 'Flag de UI: Indica se o usuário já tratou esta sugestão no painel';
COMMENT ON COLUMN logs_treinamento.modelo_ia IS 'Nome do modelo que gerou a extração (ex: llama-3.3-70b)';
COMMENT ON COLUMN logs_treinamento.validado IS 'Flag de ML: Indica se o dado foi validado para re-treino futuro';

-- Force schema cache reload (Supabase/PostgREST specific)
NOTIFY pgrst, 'reload schema';
