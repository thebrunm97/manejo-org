-- DT-107: policies `USING (true)` do harness liam guardrail_events/
-- hitl_pending cross-tenant, ⚡ condicional a "se as migrations do harness
-- foram aplicadas em produção".
--
-- Confirmado ao vivo (não é mais condicional): as duas tabelas existem em
-- produção com EXATAMENTE a policy perigosa descrita no débito —
-- "admin_read_guardrail_events" e "admin_read_hitl", ambas `FOR SELECT
-- USING (true)` para `authenticated`, apesar do nome sugerir admin-only.
-- Qualquer produtor autenticado podia ler o telefone e o motivo de bloqueio
-- de guardrail de QUALQUER outro produtor (`guardrail_events.phone`,
-- `.reason`, `.violations`) e os argumentos de ações HITL pendentes de
-- qualquer um (`hitl_pending.from_phone`, `.tool_args`, `.pmo_id`).
--
-- Staging já tem a policy correta ("Admins veem eventos de
-- guardrail"/"Admins gerenciam HITL", `FOR ALL` com `EXISTS (... role =
-- 'admin')") — nunca teve esse drift. Replicando a definição de staging em
-- produção, sem inventar um escopo novo: o painel admin
-- (`GuardrailsDashboardTab.tsx`) só lê via views (`hitl_pending_view` etc,
-- ver DT-110 à parte), então nenhum caller conhecido precisa de mais que
-- isso; o bot em si grava com service_role, que ignora RLS.

DROP POLICY IF EXISTS "admin_read_guardrail_events" ON public.guardrail_events;
DROP POLICY IF EXISTS "Admins veem eventos de guardrail" ON public.guardrail_events;
CREATE POLICY "Admins veem eventos de guardrail" ON public.guardrail_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admin_read_hitl" ON public.hitl_pending;
DROP POLICY IF EXISTS "Admins gerenciam HITL" ON public.hitl_pending;
CREATE POLICY "Admins gerenciam HITL" ON public.hitl_pending
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
