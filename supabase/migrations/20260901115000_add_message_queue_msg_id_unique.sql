-- ============================================================
-- MIGRATION: Índice único em message_queue.msg_id (DT-22 — recuperação)
-- Description: Este arquivo não existia no repositório até agora, embora o
--   índice já estivesse ao vivo em produção desde 2026-09-01 (aplicado
--   diretamente, sem passar por um arquivo de migration versionado — achado
--   ao investigar o DT-22, schema drift entre local e produção). O índice
--   evita duplicidade de `msg_id` em `message_queue`, que o histórico do
--   DT-68 já documentava como causa de colisão em testes com tarefas
--   paralelas reutilizando o mesmo `msg_id` fixo. Este arquivo só
--   FORMALIZA em git o que já está em produção — não muda nada ao vivo.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_mq_msg_id ON public.message_queue USING btree (msg_id);
