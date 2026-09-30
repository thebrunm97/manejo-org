-- Migration: DT-95 — fecha EXECUTE aberto a PUBLIC nas RPCs de Knowledge Ops
-- Contexto: claim_next_ingestion_job (20260721180100_knowledge_ops_rpcs.sql:10),
-- publish_knowledge_version (idem:49) e upsert_arena_models
-- (20260723120000_update_rag_arena_models_sync.sql:14) são SECURITY DEFINER sem
-- SET search_path e sem REVOKE — qualquer anônimo podia: inventar um worker_id e
-- roubar jobs da fila de ingestão (claim), promover qualquer versão para 'live'
-- (publish) ou reescrever o catálogo de modelos do RAG (upsert).
-- Único chamador real é o bot — worker/painel admin via service role key,
-- confirmado com grep: claim_next_ingestion_job em
-- pmo-bot-go/internal/supabase/worker_client.go:26; upsert_arena_models e
-- publish_knowledge_version em pmo-bot-go/internal/supabase/knowledge.go:275,399
-- (todos via c.config.Key, a service role key — client.go). Sem chamador no
-- frontend. Mesmo padrão do DT-65 (20260824140000_revoke_dt65_gen1_rpc_grants.sql).
-- Extra: como as três são SECURITY DEFINER e não declaravam search_path, fixamos
-- SET search_path = public via ALTER FUNCTION (proteção contra search_path hijacking).

ALTER FUNCTION public.claim_next_ingestion_job(text) SET search_path = public;
REVOKE ALL ON FUNCTION public.claim_next_ingestion_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_ingestion_job(text) TO service_role;

ALTER FUNCTION public.publish_knowledge_version(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION public.publish_knowledge_version(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_knowledge_version(uuid) TO service_role;

ALTER FUNCTION public.upsert_arena_models(jsonb) SET search_path = public;
REVOKE ALL ON FUNCTION public.upsert_arena_models(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_arena_models(jsonb) TO service_role;