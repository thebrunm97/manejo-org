-- Feature Multicanal — Fase A.6
-- Políticas RLS completas para conversations e messages.
-- Garante que produtores só acessem seu histórico (independente de canal) 
-- e que admins possam intervir via HITL.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 0. Adicionar profiles.tenant_id (pré-requisito das policies abaixo) ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Esta migration usa p.tenant_id nas policies de admin (seção 1) mas nenhuma
-- migration anterior cria essa coluna em profiles — nem aqui, nem em produção
-- (confirmado ao vivo: profiles não tem tenant_id nem organizacao_id). Segue o
-- mesmo padrão nullable já usado em conversations.tenant_id (seção A.1): ADR-010
-- (multitenancy) ainda não fechado, então não dá pra popular/exigir de verdade
-- ainda; será tornado NOT NULL quando o backfill de tenant estiver validado.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.profiles
            ADD COLUMN tenant_id BIGINT REFERENCES public.organizacoes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1. RLS para Conversations                                        ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Limpar as políticas antigas, se houver, para aplicar as novas de forma uniforme
DROP POLICY IF EXISTS "Usuarios leem suas proprias conversas" ON public.conversations;
DROP POLICY IF EXISTS "Usuarios criam suas proprias conversas" ON public.conversations;
DROP POLICY IF EXISTS "Admins acessam todas conversas" ON public.conversations;
DROP POLICY IF EXISTS "conversations_owner" ON public.conversations;
DROP POLICY IF EXISTS "conversations_admin" ON public.conversations;

-- Produtor: lê e altera as próprias conversas
CREATE POLICY "conversations_owner" 
    ON public.conversations
    FOR ALL 
    USING (user_id = auth.uid());

-- Admin: acessa conversas do tenant ao qual pertence
CREATE POLICY "conversations_admin" 
    ON public.conversations
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'cooperativa')
              AND p.tenant_id = conversations.tenant_id
        )
        OR public.is_admin()
    );

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 2. RLS para Messages                                             ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas criadas pelo script inicial da feature se existirem,
-- ou as que possam colidir. Mantém as originais de SELECT/INSERT do app antigo.
DROP POLICY IF EXISTS "Usuarios leem mensagens de suas conversas" ON public.messages;
DROP POLICY IF EXISTS "messages_owner_select" ON public.messages;
DROP POLICY IF EXISTS "messages_owner_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_admin" ON public.messages;

-- Produtor: lê mensagens das próprias conversas
CREATE POLICY "messages_owner_select" 
    ON public.messages
    FOR SELECT 
    USING (
        conversation_id IN (
            SELECT id FROM public.conversations WHERE user_id = auth.uid()
        )
    );

-- Produtor: insere mensagens nas próprias conversas (PWA/Web Chat)
CREATE POLICY "messages_owner_insert" 
    ON public.messages
    FOR INSERT 
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.conversations WHERE user_id = auth.uid()
        )
    );

-- Admin/HITL: lê e escreve em conversas do seu tenant
CREATE POLICY "messages_admin" 
    ON public.messages
    FOR ALL 
    USING (
        conversation_id IN (
            SELECT id FROM public.conversations c
            WHERE EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role IN ('admin', 'cooperativa')
                  AND p.tenant_id = c.tenant_id
            )
        )
        OR public.is_admin()
    );

COMMIT;
