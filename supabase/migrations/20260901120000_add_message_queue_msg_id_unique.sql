-- DT-67: produção já tinha esse índice único aplicado fora do controle de versão
-- (mesmo padrão de drift do DT-21/DT-46) — este arquivo só o versiona, com o nome
-- já em uso lá (idx_mq_msg_id), e o cria em qualquer ambiente onde ainda falte.
-- O bug real de dedup era o Manager.Enqueue não enviar on_conflict=msg_id (ver manager.go).
CREATE UNIQUE INDEX IF NOT EXISTS idx_mq_msg_id ON public.message_queue (msg_id);
