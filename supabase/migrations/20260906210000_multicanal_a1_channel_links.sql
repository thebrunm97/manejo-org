-- Feature Multicanal — Fase A.1
-- Evolui conversations (adiciona tenant_id, expande channel CHECK para 'telegram')
-- e cria a tabela channel_links para vinculação canal ↔ usuário.
--
-- PRE-CONDIÇÃO: conversations já existe (20260825020000), com channel TEXT CHECK
-- ('whatsapp','web'). Esta migration é incremental, não recria nada.

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1. Expandir CHECK de channel em conversations para 'telegram'   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Descobre e dropa o CHECK existente (nome pode variar entre ambientes)
DO $$
DECLARE
    _constraint_name TEXT;
BEGIN
    SELECT con.conname INTO _constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'conversations'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%channel%';

    IF _constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.conversations DROP CONSTRAINT %I', _constraint_name);
    END IF;
END $$;

-- Re-cria com os 3 canais suportados
ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_channel_check
    CHECK (channel IN ('whatsapp', 'web', 'telegram'));

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 2. Adicionar tenant_id (nullable — ADR-010 ainda não fechado)   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- tenant_id aponta para organizacoes.id (a tabela de tenants do projeto).
-- Nullable porque o ADR-010 (multitenancy) ainda não foi implementado; será
-- tornado NOT NULL quando o backfill de tenant estiver validado.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'conversations'
          AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.conversations
            ADD COLUMN tenant_id UUID REFERENCES public.organizacoes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índice para queries por tenant (quando ADR-010 ativar)
CREATE INDEX IF NOT EXISTS conversations_tenant_id_idx
    ON public.conversations (tenant_id)
    WHERE tenant_id IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 3. Adicionar status à conversations (lifecycle)                  ║
-- ╚══════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'conversations'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.conversations
            ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'archived'));
    END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 4. Criar tabela channel_links                                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.channel_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web')),
    channel_user_id TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(channel, channel_user_id)
);

-- Índice de resolução reversa: dado um user_id, listar seus canais vinculados
CREATE INDEX IF NOT EXISTS idx_channel_links_user_channel
    ON public.channel_links (user_id, channel);

-- RLS
ALTER TABLE public.channel_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios leem seus proprios channel_links"
    ON public.channel_links FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins acessam todos channel_links"
    ON public.channel_links FOR ALL TO authenticated
    USING (public.is_admin());

-- Service role precisa de acesso para o bot vincular canais
GRANT ALL ON public.channel_links TO postgres, service_role;
GRANT SELECT ON public.channel_links TO authenticated;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 5. Backfill: popular channel_links com telefones existentes      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Cria um channel_link 'whatsapp' para cada perfil com telefone,
-- usando o telefone normalizado como channel_user_id.
INSERT INTO public.channel_links (user_id, channel, channel_user_id, verified_at)
SELECT
    p.id,
    'whatsapp',
    public.normalize_phone(p.telefone),
    now()  -- produtores já verificados pelo onboarding WA
FROM public.profiles p
WHERE p.telefone IS NOT NULL
  AND public.normalize_phone(p.telefone) IS NOT NULL
ON CONFLICT (channel, channel_user_id) DO NOTHING;

COMMIT;
