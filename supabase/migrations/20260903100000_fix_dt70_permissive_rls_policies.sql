-- DT-70: remove policies RLS permissivas (auth.role() = 'authenticated' / qual: true,
-- sem checar dono nenhum) que expunham canteiros, analises_solo, culturas_anuais e
-- pmo_propagacao a leitura/escrita cross-tenant para qualquer usuário autenticado.
--
-- Causa: Postgres combina múltiplas policies PERMISSIVE com OR. Nas 3 primeiras
-- tabelas, essa era a ÚNICA policy (a correta do desenho original, de
-- 20260402000000_create_core_app_tables.sql, nunca chegou a existir em produção).
-- Em pmo_propagacao a policy correta ("Users can manage their own pmo_propagacao")
-- já existia, mas a permissiva ao lado a anulava por completo mesmo assim.
--
-- Nenhuma dessas policies permissivas tem migration correspondente neste repositório
-- -- foram criadas fora de banda direto em produção, o mesmo padrão de drift já
-- documentado no DT-22. Confirmado ao vivo (produção) antes de escrever esta migration:
-- canteiros/analises_solo/culturas_anuais tinham exatamente 1 policy cada (a permissiva);
-- pmo_propagacao tinha 2 (a permissiva + a correta).
--
-- As policies de substituição replicam exatamente o que já está ativo e correto no
-- Postgres local (mesmo nome e mesma definição), fechando também a divergência.

DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.canteiros;
CREATE POLICY "Acesso via talhão do usuário" ON public.canteiros
  FOR ALL
  TO authenticated
  USING (talhao_id IN (SELECT id FROM public.talhoes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Permitir logados" ON public.analises_solo;
CREATE POLICY "Acesso via talhão do usuário" ON public.analises_solo
  FOR ALL
  TO authenticated
  USING (talhao_id IN (SELECT id FROM public.talhoes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.culturas_anuais;
CREATE POLICY "Acesso via PMO do usuário" ON public.culturas_anuais
  FOR ALL
  TO authenticated
  USING (pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid()));

-- pmo_propagacao já tem a policy correta ("Users can manage their own pmo_propagacao");
-- só a permissiva precisa sair.
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.pmo_propagacao;
