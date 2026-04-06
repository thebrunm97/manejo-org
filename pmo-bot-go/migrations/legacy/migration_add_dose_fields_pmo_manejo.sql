-- Migration to add split dosage fields to pmo_manejo table
-- This allows storing precise numeric values and units separately for inputs (fertilizers/pesticides)

ALTER TABLE pmo_manejo 
ADD COLUMN IF NOT EXISTS dose_valor NUMERIC,
ADD COLUMN IF NOT EXISTS dose_unidade TEXT;

-- Optional: Comment describing the columns
COMMENT ON COLUMN pmo_manejo.dose_valor IS 'Valor numérico da dosagem (ex: 5, 2.5)';
COMMENT ON COLUMN pmo_manejo.dose_unidade IS 'Unidade da dosagem (ex: ml/litro, kg/ha)';
