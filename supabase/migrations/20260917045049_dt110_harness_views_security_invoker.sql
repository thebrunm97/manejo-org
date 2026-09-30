-- DT-110: 4 views (guardrail_kpi_hourly, guardrail_recent_blocks,
-- hitl_audit_summary, hitl_pending_view) rodavam sem security_invoker,
-- ignorando a RLS admin-only das tabelas base (guardrail_events, hitl_pending)
-- corrigida no DT-107. GRANT SELECT concedido a anon (default do Postgres em
-- views criadas sem revoke) — QUALQUER chamador anônimo, sem nenhuma sessão,
-- conseguia ler phone/reason/violations de guardrail_events e
-- from_phone/tool_name/action_label de hitl_pending via PostgREST.
-- Mesmo padrão e mesma correção já aplicada em view_conversas_recentes (DT-62).
--
-- Aplicada em produção via MCP em 2026-09-17; arquivo recuperado de
-- supabase_migrations.schema_migrations em 2026-09-30.

-- As views são criadas por pmo-bot-go/migrations/005_guardrail_events.sql,
-- fora desta pasta — num banco novo (CI/local) podem não existir, daí o guard.

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['guardrail_kpi_hourly', 'guardrail_recent_blocks', 'hitl_audit_summary', 'hitl_pending_view'] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
    END IF;
  END LOOP;
END
$$;
