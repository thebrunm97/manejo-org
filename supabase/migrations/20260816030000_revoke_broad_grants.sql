-- ============================================================
-- MIGRATION: 20260816030000_revoke_broad_grants.sql.pending
-- ATENÇÃO: ARQUIVO BLOQUEADO ATÉ A CONCLUSÃO DO DT-18.
-- NÃO APLICAR! A revogação do INSERT/UPDATE quebraria o frontend atual
-- que grava diretamente nas tabelas (ex: propriedades, caderno_campo).
-- ============================================================

-- 1. Revogar escrita e operações perigosas (TRUNCATE) de todas as tabelas atuais
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2. Garantir que o SELECT está presente (essencial para PostgREST, sendo governado por RLS)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- 3. Prevenir que novas tabelas nasçam com permissão de escrita para essas roles
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- 4. Garantir que novas tabelas nasçam com SELECT para essas roles
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO anon, authenticated;
