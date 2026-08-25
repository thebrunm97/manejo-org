-- ADR-011: Abstração de Canal de Chat — Task 1
-- Cria a tabela conversations (identidade de sessão agnóstica de canal) e liga
-- messages a ela via conversation_id, mantendo phone intacto para compatibilidade
-- (ver ADR-011 Task 2 — transição de chave dupla).

CREATE TABLE IF NOT EXISTS public.conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pmo_id      BIGINT REFERENCES public.pmos(id) ON DELETE SET NULL,
    channel     TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'web')),
    phone       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_phone_channel_key
    ON public.conversations (phone, channel) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON public.conversations (user_id);

DROP TRIGGER IF EXISTS set_updated_at_conversations ON public.conversations;
CREATE TRIGGER set_updated_at_conversations
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios leem suas proprias conversas"
ON public.conversations FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Usuarios criam suas proprias conversas"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins acessam todas conversas"
ON public.conversations FOR ALL TO authenticated
USING (public.is_admin());

-- ── messages: liga a conversations sem quebrar o schema existente ─────────────
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages (conversation_id);

CREATE POLICY "Usuarios leem mensagens de suas conversas"
ON public.messages FOR SELECT TO authenticated
USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
);

-- ── Backfill: uma conversation por telefone já vinculado a um profile ─────────
--
-- messages.phone e profiles.telefone não compartilham formato (JID cru com
-- "@s.whatsapp.net", DDI, 9º dígito variável, etc.) — o mesmo problema que já
-- levou à criação de public.normalize_phone() para a view_conversas_recentes.
-- Comparar os dois campos direto faria esse backfill não casar praticamente
-- nada. conversations.phone guarda o telefone já normalizado, que também é a
-- forma estável que o backfill de messages usa para casar de volta.
INSERT INTO public.conversations (user_id, pmo_id, channel, phone)
SELECT DISTINCT ON (public.normalize_phone(p.telefone))
    p.id, p.pmo_ativo_id, 'whatsapp', public.normalize_phone(p.telefone)
FROM public.profiles p
WHERE p.telefone IS NOT NULL
  AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE public.normalize_phone(m.phone) = public.normalize_phone(p.telefone)
      )
ON CONFLICT (phone, channel) WHERE phone IS NOT NULL DO NOTHING;

UPDATE public.messages m
SET conversation_id = c.id
FROM public.conversations c
WHERE public.normalize_phone(m.phone) = c.phone
  AND c.channel = 'whatsapp'
  AND m.conversation_id IS NULL;
