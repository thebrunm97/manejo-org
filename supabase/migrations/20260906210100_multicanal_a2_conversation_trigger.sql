-- Feature Multicanal — Fase A.2
-- Trigger para manter conversations.updated_at sincronizado com novas mensagens.
--
-- NOTA: só dispara para mensagens com conversation_id preenchido (pós-backfill).
-- Mensagens antigas inseridas antes da migração (conversation_id IS NULL) não
-- ativam o trigger, o que é comportamento esperado e aceitável.

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropa caso exista de execução anterior (idempotência)
DROP TRIGGER IF EXISTS trg_messages_update_conversation ON public.messages;

CREATE TRIGGER trg_messages_update_conversation
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL)
EXECUTE FUNCTION public.update_conversation_timestamp();
