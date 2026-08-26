-- DT-62: view_conversas_recentes fazia bypass de RLS.
--
-- A view roda com as permissões do dono (postgres), que ignora RLS por
-- padrão mesmo no Postgres 15+, a menos que marcada com
-- security_invoker = true. Com GRANT SELECT para anon/authenticated,
-- qualquer chamador anônimo via PostgREST lia telefone e conteúdo de
-- mensagens de todos os produtores, bypassando as policies de RLS de
-- public.messages.
--
-- Fix: ALTER VIEW ... SET (security_invoker = true) — a definição da
-- view não muda, só passa a rodar com as permissões de quem chama,
-- então as policies de RLS de messages voltam a valer.

BEGIN;

ALTER VIEW public.view_conversas_recentes SET (security_invoker = true);

COMMIT;
