-- DT-135/136: o que de fato rodou em produção (via MCP, 2026-09-09) — só as
-- policies, sem recriar tabelas. O arquivo anterior
-- (20260909201747_dt135_136_reconcilia_...) recria as tabelas e existe só
-- para bancos novos (CI/local); em produção ele é marcado como aplicado sem
-- rodar. Recuperado de supabase_migrations.schema_migrations em 2026-09-30;
-- acrescentados DROP POLICY IF EXISTS para ser idempotente depois do
-- reconcilia num banco novo.

DROP POLICY IF EXISTS "Acesso total equipamentos" ON public.pmo_equipamentos;
CREATE POLICY "Acesso total equipamentos" ON public.pmo_equipamentos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (pmo_id IS NULL OR pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Profissionais autorizados leem pmo_equipamentos" ON public.pmo_equipamentos;
CREATE POLICY "Profissionais autorizados leem pmo_equipamentos" ON public.pmo_equipamentos
  FOR SELECT TO authenticated
  USING (
    pmo_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.pmo_acessos_profissionais a
      WHERE a.pmo_id = pmo_equipamentos.pmo_id AND a.profissional_id = auth.uid() AND a.revogado_em IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can manage their own pmo_insumos" ON public.pmo_insumos;
DROP POLICY IF EXISTS "Acesso via PMO do usuário" ON public.pmo_insumos;
CREATE POLICY "Users can manage their own pmo_insumos" ON public.pmo_insumos
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_insumos.pmo_id))
  WITH CHECK (auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_insumos.pmo_id));

DROP POLICY IF EXISTS "Profissionais autorizados leem pmo_insumos" ON public.pmo_insumos;
CREATE POLICY "Profissionais autorizados leem pmo_insumos" ON public.pmo_insumos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pmo_acessos_profissionais a
      WHERE a.pmo_id = pmo_insumos.pmo_id AND a.profissional_id = auth.uid() AND a.revogado_em IS NULL
    )
  );
