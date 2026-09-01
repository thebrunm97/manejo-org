-- DT-68 / PLAN-message-buffer-coalescing.md (pmo-bot-go/docs) — Fase 1.
--
-- Prepara o schema para agrupar mensagens fragmentadas do mesmo produtor num
-- único turno de IA. Só schema: a lógica de dreno (RPC claim_next_message_job)
-- e o cálculo da janela (Manager.MarkAIPending) entram nas Fases 2 e 3, feitas
-- à parte para isolar o risco de concorrência da mudança de schema.
--
-- O portão de "ainda não elegível" já existe e já é respeitado pela RPC de
-- claim: `next_retry_at`, adicionado em 20260402120000_create_operational_tables.sql
-- e filtrado por `claim_next_message_job` (`WHERE ... AND next_retry_at <= NOW()`,
-- ver 20260823110000_sync_prod_orphan_functions.sql). Por isso esta migration
-- NÃO cria uma coluna de agendamento nova — a Fase 3 vai escrever em
-- `next_retry_at` na promoção para `ai_pending`, reaproveitando o mesmo portão
-- que hoje só serve o backoff de retry e o reaper.
--
-- `status` em message_queue é TEXT livre, sem CHECK constraint (confirmado
-- antes de escrever esta migration), então o novo valor 'merged' não exige
-- migração de enum — só passa a existir quando a Fase 2 começar a gravá-lo.
--
-- NOTA PARA A FASE 2: `cleanup_message_queue()` hoje só apaga `status = 'done'`
-- mais velho que 7 dias. Jobs 'merged' ficarão de fora dessa varredura até a
-- Fase 2 decidir se/quando eles recebem `processed_at` (e portanto entram no
-- mesmo TTL) — não resolvido aqui de propósito, por depender de uma decisão
-- que só faz sentido junto do dreno.

ALTER TABLE public.message_queue
    ADD COLUMN IF NOT EXISTS merged_into_job_id UUID REFERENCES public.message_queue(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS parts_count INTEGER NOT NULL DEFAULT 1 CHECK (parts_count >= 1);

-- Cobre a query de dreno da Fase 2: "outros jobs ai_pending do mesmo telefone,
-- já elegíveis". Parcial porque só interessa aos jobs ainda não reivindicados.
CREATE INDEX IF NOT EXISTS message_queue_ai_pending_phone_ready_idx
    ON public.message_queue (from_phone, next_retry_at)
    WHERE status = 'ai_pending';

COMMENT ON COLUMN public.message_queue.merged_into_job_id IS
    'DT-68: preenchida pela Fase 2 quando este job é um fragmento absorvido por outro (o "pai") no mesmo turno de IA. NULL para jobs que nunca foram fundidos ou que são o próprio pai. Mantido para trilha de auditoria — o job filho não é deletado, só deixa de ser processado sozinho.';
COMMENT ON COLUMN public.message_queue.parts_count IS
    'DT-68: quantos fragmentos (incluindo este) foram combinados neste job pelo dreno da Fase 2. 1 = turno de mensagem única, valor de hoje para todo job existente.';
