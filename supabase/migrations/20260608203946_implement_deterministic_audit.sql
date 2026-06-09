-- ============================================================
-- MIGRATION: Rastreabilidade Determinística e Idempotência (Source of Truth)
-- File: supabase/migrations/20260608203946_implement_deterministic_audit.sql
-- Description: Criação da tabela raw_payloads (imutável), trigger de auditoria,
--              links de FKs e índice único de idempotência contábil.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabela raw_payloads (O Cartório / Imutável)
-- ============================================================
-- Armazena os eventos brutos de webhooks (WhatsApp/Evolution) antes de qualquer parse.
CREATE TABLE IF NOT EXISTS public.raw_payloads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id text UNIQUE NOT NULL, -- ID do evento original usado para idempotência do webhook
    payload_data jsonb NOT NULL, -- Payload JSON completo e original recebido
    source text, -- Origem do payload (ex: 'whatsapp_evolution')
    processing_status text NOT NULL DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED')),
    processing_error text, -- Detalhes de erro caso o parse/processamento falhe
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Comentários da tabela e colunas para documentação do schema
COMMENT ON TABLE public.raw_payloads IS 'Tabela de auditoria imutável (Cartório) que armazena os payloads brutos recebidos dos webhooks.';
COMMENT ON COLUMN public.raw_payloads.message_id IS 'ID único da mensagem/evento no provedor de origem, essencial para desduplicação na entrada.';
COMMENT ON COLUMN public.raw_payloads.payload_data IS 'JSON original e completo do evento recebido.';
COMMENT ON COLUMN public.raw_payloads.processing_status IS 'Estado do ciclo de vida do processamento do payload.';

-- ============================================================
-- 2. Garantia de Imutabilidade (Trigger BEFORE UPDATE)
-- ============================================================
-- Garante que dados históricos (payload_data, message_id, etc.) nunca possam ser alterados ou falsificados.
-- Somente o status de processamento e os logs de erro podem ser alterados pelo worker.
CREATE OR REPLACE FUNCTION public.check_raw_payloads_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payload_data IS DISTINCT FROM OLD.payload_data OR 
       NEW.message_id IS DISTINCT FROM OLD.message_id OR
       NEW.id IS DISTINCT FROM OLD.id OR
       NEW.source IS DISTINCT FROM OLD.source OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Erro de Integridade: A tabela raw_payloads é imutável. Apenas processing_status e processing_error podem ser alterados.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Associa o trigger de imutabilidade à tabela
DROP TRIGGER IF EXISTS trg_raw_payloads_immutability ON public.raw_payloads;
CREATE TRIGGER trg_raw_payloads_immutability
    BEFORE UPDATE ON public.raw_payloads
    FOR EACH ROW
    EXECUTE FUNCTION public.check_raw_payloads_immutability();

-- ============================================================
-- 3. Rastreabilidade (Foreign Keys nas tabelas de negócio)
-- ============================================================
-- Vincula cada registro de caderno_campo e transações financeiras ao payload que o originou.
ALTER TABLE public.caderno_campo
    ADD COLUMN IF NOT EXISTS raw_payload_id uuid REFERENCES public.raw_payloads(id) ON DELETE SET NULL;

ALTER TABLE public.transacoes_financeiras
    ADD COLUMN IF NOT EXISTS raw_payload_id uuid REFERENCES public.raw_payloads(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.caderno_campo.raw_payload_id IS 'UUID de referência ao payload bruto original que gerou este lançamento.';
COMMENT ON COLUMN public.transacoes_financeiras.raw_payload_id IS 'UUID de referência ao payload bruto original que gerou esta transação contábil.';

-- ============================================================
-- 4. Idempotência de Negócio (Índice Único Parcial)
-- ============================================================
-- Garante que um mesmo payload/áudio/mensagem nunca crie duas transações financeiras (despesas/receitas) duplicadas no ledger.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_raw_payload_transacoes 
    ON public.transacoes_financeiras(raw_payload_id) 
    WHERE raw_payload_id IS NOT NULL;

-- ============================================================
-- 5. Segurança: Row Level Security (RLS)
-- ============================================================
-- Habilita RLS na raw_payloads e define políticas estritas de acesso.
ALTER TABLE public.raw_payloads ENABLE ROW LEVEL SECURITY;

-- Política de leitura: Permite leitura apenas para perfis com a role 'admin'
DROP POLICY IF EXISTS "Permitir leitura apenas para administradores" ON public.raw_payloads;
CREATE POLICY "Permitir leitura apenas para administradores"
    ON public.raw_payloads FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Nota: Operações de escrita pelo backend/worker executam sob o papel service_role,
-- que ignora automaticamente as verificações de RLS, garantindo a ingestão sem problemas.

COMMIT;
