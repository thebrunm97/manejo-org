-- Migration: Add Feedback Loop columns to logs_treinamento
-- Author: Codebase Agent
-- Date: 2026-01-23

ALTER TABLE logs_treinamento 
ADD COLUMN IF NOT EXISTS json_corrigido JSONB,
ADD COLUMN IF NOT EXISTS foi_editado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status_validacao TEXT DEFAULT 'pendente';

-- Index for faster analytics on validation status
CREATE INDEX IF NOT EXISTS idx_logs_validacao ON logs_treinamento(status_validacao);

COMMENT ON COLUMN logs_treinamento.json_corrigido IS 'A versão final do dado após edição/aprovação do usuário (Ground Truth)';
COMMENT ON COLUMN logs_treinamento.foi_editado IS 'True se o usuário alterou algo em relação à sugestão original';
COMMENT ON COLUMN logs_treinamento.status_validacao IS 'Status do processo de validação: pendente, validado_humano, corrigido_humano';
