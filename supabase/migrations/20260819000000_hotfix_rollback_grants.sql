-- ============================================================
-- MIGRATION: 20260819000000_hotfix_rollback_grants.sql
-- DESCRIÇÃO: Expulsa o TRUNCATE globalmente, restaura bloqueios
-- de IDOR e blinda privilégios padrão para o futuro.
-- ============================================================

-- 1. Remoção Global do TRUNCATE
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

-- 2. Bloqueio padrão para novas tabelas (Secure by Default)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;

-- 3. Restauração do Bloqueio de IDOR para tabelas RPC-Only
REVOKE INSERT, UPDATE, DELETE ON public.organizacao_membros FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lotes_rastreabilidade FROM anon, authenticated;
