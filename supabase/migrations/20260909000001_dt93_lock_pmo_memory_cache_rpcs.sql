-- Migration: DT-93 — fecha IDOR nas RPCs de memória de cache do PMO
-- Contexto: save_pmo_memory_cache / match_pmo_memory_cache são SECURITY DEFINER
-- (20260905153000_b_create_pmo_memory_cache_rpc.sql) que aceitam p_pmo_id/p_user_id
-- do chamador sem checar posse e nunca receberam REVOKE EXECUTE — continuavam com
-- EXECUTE aberto para anon/authenticated/PUBLIC. Qualquer anônimo podia ler/escrever
-- o cache de memória de qualquer PMO passando IDs arbitrários.
-- Único chamador real é o bot (service role key), confirmado via grep em
-- pmo-bot-go/internal/supabase/memory_cache.go (SaveMemoryCache/MatchMemoryCache
-- usam c.config.Key, a service role key — ver client.go) e sem chamador no frontend
-- (grep em pmo-frontend/src). Mesmo padrão do DT-65
-- (20260824140000_revoke_dt65_gen1_rpc_grants.sql).

REVOKE ALL ON FUNCTION public.save_pmo_memory_cache(
    bigint, uuid, text, text, text, text, float4, vector(1024), boolean, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_pmo_memory_cache(
    bigint, uuid, text, text, text, text, float4, vector(1024), boolean, timestamptz
) TO service_role;

REVOKE ALL ON FUNCTION public.match_pmo_memory_cache(
    bigint, vector(1024), float4, int
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_pmo_memory_cache(
    bigint, vector(1024), float4, int
) TO service_role;