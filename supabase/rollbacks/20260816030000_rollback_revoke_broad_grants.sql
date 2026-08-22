-- ============================================================
-- MIGRATION: 20260816030000_rollback_revoke_broad_grants.sql
-- DESCRIÇÃO: Botão de Pânico. Restaura os privilégios de escrita diretos
-- para anon e authenticated no schema public.
-- ============================================================

-- 1. Restaurar permissões nas tabelas existentes
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- 2. Restaurar privilégios padrão para tabelas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO anon, authenticated;
