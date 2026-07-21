-- Migration: Evolve messages table for real-time live chat monitor
-- File: supabase/migrations/20260610_evolve_messages_table.sql

BEGIN;

-- 1. Adicionar colunas necessárias na tabela public.messages e definir default do ID
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
ALTER TABLE public.messages ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Migrar dados legados de 'source' para 'content' se aplicável
UPDATE public.messages
SET content = source
WHERE content IS NULL AND source IS NOT NULL;

-- 3. Habilitar a tabela public.messages no realtime do Supabase (adicionar ao publication supabase_realtime)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- 4. Habilitar RLS e criar políticas de acesso para administradores
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins select all messages" ON public.messages;
CREATE POLICY "Admins select all messages" ON public.messages
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins insert messages" ON public.messages;
CREATE POLICY "Admins insert messages" ON public.messages
    FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins update messages" ON public.messages;
CREATE POLICY "Admins update messages" ON public.messages
    FOR UPDATE USING (is_admin());

-- 5. Criar função auxiliar para normalização de telefone (remover DDI 55, 9º dígito e caracteres)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone_str text)
RETURNS text AS $$
DECLARE
    clean text;
BEGIN
    IF phone_str IS NULL THEN
        RETURN NULL;
    END IF;
    clean := split_part(phone_str, '@', 1);
    clean := regexp_replace(clean, '\D', '', 'g');
    IF clean LIKE '55%' THEN
        IF length(clean) = 13 THEN
            RETURN substring(clean from 3 for 2) || right(clean, 8);
        ELSIF length(clean) = 12 THEN
            RETURN substring(clean from 3 for 2) || right(clean, 8);
        END IF;
    END IF;
    IF length(clean) = 11 THEN
        RETURN left(clean, 2) || right(clean, 8);
    END IF;
    IF length(clean) >= 8 THEN
        RETURN right(clean, 8);
    END IF;
    RETURN clean;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Criar View eficiente para listar as últimas conversas agrupadas por telefone
CREATE OR REPLACE VIEW public.view_conversas_recentes AS
WITH ranked_messages AS (
    SELECT 
        id,
        phone,
        content,
        role,
        timestamp,
        status,
        ROW_NUMBER() OVER (PARTITION BY phone ORDER BY timestamp DESC) as rn
    FROM public.messages
    WHERE phone IS NOT NULL
)
SELECT 
    r.id,
    r.phone,
    r.content as last_message,
    r.role as last_message_role,
    r.timestamp as last_message_timestamp,
    r.status as last_message_status,
    p.nome as profile_name
FROM ranked_messages r
LEFT JOIN public.profiles p ON public.normalize_phone(p.telefone) = public.normalize_phone(r.phone)
WHERE r.rn = 1;

-- Conceder permissões para que usuários autenticados/anon/service_role leiam a view (conforme políticas do Supabase)
GRANT SELECT ON public.view_conversas_recentes TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated, anon, service_role;

COMMIT;
