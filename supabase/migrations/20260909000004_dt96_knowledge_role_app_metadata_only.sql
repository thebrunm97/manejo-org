-- Migration: DT-96 — get_knowledge_role() confia apenas em app_metadata
-- Contexto: 20260721180000_knowledge_ops_panel.sql:14-21 definia o helper com um
-- segundo braço em user_metadata. user_metadata é editável pelo próprio usuário via
-- client SDK (supabase.auth.updateUser) — qualquer usuário podia se autodeclarar
-- knowledge_publisher settando user_metadata.knowledge_role e escalar privilégios
-- sobre o subsistema de conhecimento (policies kd_*/kv_*/ij_*/rql_*/rf_* e de
-- storage dos buckets knowledge-docs). session_tokens/app_metadata é gravada apenas
-- pelo server (admin role) e não é editável pelo usuário.
-- Aqui só removemos o braço inseguro do COALESCE e fixamos SET search_path (a versão
-- atual não tinha), já que a função é SECURITY DEFINER. Nenhuma policy muda de
-- comportamento para quem já tinha o claim correto em app_metadata.

CREATE OR REPLACE FUNCTION public.get_knowledge_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'knowledge_role'),
    'none'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;