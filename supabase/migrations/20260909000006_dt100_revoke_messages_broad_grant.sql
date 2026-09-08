-- Migration: DT-100 — remove grant alargado de public.messages para anon/authenticated
-- Contexto: 20260610120000_evolve_messages_table.sql:116 concedeu
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated, anon, service_role
-- e nunca foi revogado. RLS protege o acesso hoje (20260906210600_multicanal_a6_rls_policies.sql:
-- messages_owner_select/messages_owner_insert/messages_admin), mas o grant é camada
-- de baixo nível: qualquer regressão futura de policy expõe todas as mensagens do banco.
--
-- Confirmação de chamadores antes de revogar (grep em pmo-frontend/src):
--   * Frontend só LÊ messages via SELECT poliçado + realtime:
--       - services/botStatusService.ts:91             (SELECT)
--       - pages/admin/LiveChatMonitor.tsx:103         (SELECT) e :192 (realtime,
--         assinatura de evento INSERT — leitura apenas). Envio de resposta admin vai
--         via backend (/api/v1/admin/chat/send → bot com service_role), não INSERT direto.
--     NENHUM INSERT/UPDATE/DELETE direto em messages nos services/pages (grep confirmado) —
--     satisfaz a condição de segurança; nada quebraria com o REVOKE abaixo.
--   * Bot (pmo-bot-go) grava via service_role, que mantém ALL intacto.
--
-- Resultado após a migration:
--   anon:          sem privilégio de tabela algum
--   authenticated: mantém SELECT (leitura via policy + realtime); perde INSERT/UPDATE/DELETE
--   service_role:  inalterado (ALL — bot)

REVOKE ALL ON public.messages FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.messages FROM authenticated;