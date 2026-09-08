-- Feature Multicanal — Fase A.4
-- Índice de deduplicação parcial (channel, channel_msg_id).
-- Substitui o dedup global por msgID — previne colisão de IDs entre canais.
-- Só se aplica a mensagens pós-migração (channel_msg_id IS NOT NULL).

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_dedup_channel
    ON public.messages (channel, channel_msg_id)
    WHERE channel_msg_id IS NOT NULL;
