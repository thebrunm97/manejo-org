-- Feature Multicanal — Fase A.3
-- Adiciona colunas channel, channel_msg_id e user_id à tabela messages.
-- Todas nullable para permitir backfill gradual (A.5a/A.5b).
--
-- PRE-CONDIÇÃO: messages já tem conversation_id (20260825020000).

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1. Coluna channel (enum-like via TEXT CHECK)                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'messages'
          AND column_name = 'channel'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN channel TEXT DEFAULT 'whatsapp'
            CHECK (channel IN ('whatsapp', 'telegram', 'web'));
    END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 2. Coluna channel_msg_id (ID nativo do canal para dedup)        ║
-- ╚══════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'messages'
          AND column_name = 'channel_msg_id'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN channel_msg_id TEXT;
    END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 3. Coluna user_id (identidade canônica)                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'messages'
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índice para queries por user_id (histórico unificado do produtor)
CREATE INDEX IF NOT EXISTS idx_messages_user_id
    ON public.messages (user_id)
    WHERE user_id IS NOT NULL;

-- Índice para queries por channel (telemetria, filtro por canal)
CREATE INDEX IF NOT EXISTS idx_messages_channel
    ON public.messages (channel);

COMMIT;
