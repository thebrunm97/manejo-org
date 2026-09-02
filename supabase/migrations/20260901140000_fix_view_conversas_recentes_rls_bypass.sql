-- ============================================================
-- MIGRATION: Corrige bypass de RLS em view_conversas_recentes (DT-62)
-- Description: A view foi criada sem `security_invoker = true`, então roda
--   com as permissões do dono (postgres), que ignora as RLS policies da
--   tabela messages (e da tabela profiles, usada no JOIN) — mesmo a tabela
--   messages tendo RLS habilitado com policy "só admin lê" (is_admin()).
--   Somado ao GRANT SELECT concedido a `anon`, qualquer chamador anônimo via
--   PostgREST conseguia ler telefone, última mensagem e papel de TODOS os
--   produtores, sem autenticação alguma.
-- ============================================================

-- 1. security_invoker faz a view executar com as permissões (e RLS) de quem
--    chama, não do dono — a partir daqui, um usuário não-admin autenticado
--    lê zero linhas (bloqueado por "Admins select all messages" em
--    messages), exatamente como já acontece hoje numa consulta direta à
--    tabela messages.
ALTER VIEW public.view_conversas_recentes SET (security_invoker = true);

-- 2. Remove o acesso anônimo por completo — o Monitor ao Vivo (única
--    consumidora desta view, pmo-frontend/src/pages/admin/LiveChatMonitor.tsx)
--    só é usado por admin já autenticado; não há motivo legítimo para uma
--    chamada sem sessão alcançar esta view, mesmo que o security_invoker
--    acima já a esvazie para chamadores sem sessão de admin.
REVOKE ALL ON public.view_conversas_recentes FROM anon;
