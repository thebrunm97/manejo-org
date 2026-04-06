-- Migration to add 'processado' column to logs_treinamento
-- This column tracks if the user has acted on the suggestion (Applied or Ignored) in the UI
-- distinct from 'validado' which is for ML ground-truthing.

ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS processado BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN logs_treinamento.processado IS 'Indica se a sugestão já foi processada (aceita/ignorada) pelo usuário na interface.';
