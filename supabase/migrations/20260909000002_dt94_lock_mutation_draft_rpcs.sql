-- Migration: DT-94 — fecha EXECUTE aberto a PUBLIC nas RPCs de mutation drafts
-- Contexto: create_or_supersede_mutation_draft / commit_mutation_draft são SECURITY
-- DEFINER (20260816010000_create_mutation_drafts.sql:44,121) que aceitam
-- p_draft_id/p_user_id/p_pmo_id do chamador sem checar posse e nunca receberam
-- REVOKE EXECUTE — continuavam com EXECUTE aberto para anon/authenticated/PUBLIC.
-- commit_mutation_draft ignora RLS e grava em caderno_campo/transacoes_financeiras/
-- cotas_produtores via sub-RPCs: qualquer anônimo que descubra um p_draft_id válido
-- podia commitar mutações financeiras/de campo de qualquer PMO.
-- Único chamador real é o bot (service role key), confirmado via grep: pmo-bot-go/
-- internal/guardrails/hitl.go (CreateOrSupersedeDraft:501, CommitDraft:587) e
-- internal/supabase/client.go (CreateOrSupersedeMutationDraftRPC:2400,
-- CommitMutationDraftRPC:2454) — todos usam a service role key (c.config.Key /
-- h.supabaseKey). Sem chamador no frontend (grep em pmo-frontend/src não encontra
-- essas RPCs). Mesmo padrão do DT-65 (20260824140000_revoke_dt65_gen1_rpc_grants.sql).

REVOKE ALL ON FUNCTION public.create_or_supersede_mutation_draft(
    bigint, uuid, text, jsonb, text, int
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_supersede_mutation_draft(
    bigint, uuid, text, jsonb, text, int
) TO service_role;

REVOKE ALL ON FUNCTION public.commit_mutation_draft(
    uuid, uuid, bigint
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_mutation_draft(
    uuid, uuid, bigint
) TO service_role;