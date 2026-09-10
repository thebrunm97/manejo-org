-- DT-140: corrige recursão infinita de RLS entre pmos e
-- pmo_acessos_profissionais, introduzida pelo DT-133
-- (20260909070000_dt133_acesso_leitura_profissionais.sql).
--
-- Cadeia do bug: a policy de SELECT em pmos ("Profissionais autorizados leem
-- o PMO") faz EXISTS (SELECT ... FROM pmo_acessos_profissionais ...); as
-- policies de pmo_acessos_profissionais, por sua vez, checam posse do PMO
-- com `auth.uid() IN (SELECT pmos.user_id FROM pmos WHERE pmos.id = ...)` —
-- uma subquery sobre pmos, que reaplica a RLS de pmos, que consulta de novo
-- pmo_acessos_profissionais, e assim por diante. Postgres detecta e aborta
-- com "42P17 infinite recursion detected in policy for relation pmos".
-- Efeito em produção: TODA leitura de profiles (que faz join embutido com
-- pmos via `pmo_ativo:pmos(*)`, ver AuthProfileContext.tsx) falhava com 500,
-- quebrando login/carregamento de sessão para todos os usuários.
--
-- Fix: usar uma função SECURITY DEFINER (mesmo padrão de is_admin()) para
-- checar posse do PMO nas policies de pmo_acessos_profissionais. A função
-- roda com privilégios do dono (bypassa RLS), então a checagem não reaplica
-- a policy de pmos e a cadeia de recursão é quebrada.

CREATE OR REPLACE FUNCTION public.is_pmo_owner(p_pmo_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dono UUID;
BEGIN
    SELECT user_id INTO v_dono FROM public.pmos WHERE id = p_pmo_id;
    RETURN v_dono IS NOT NULL AND v_dono = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_pmo_owner FROM public;
GRANT EXECUTE ON FUNCTION public.is_pmo_owner TO authenticated;

DROP POLICY IF EXISTS "Dono do PMO e profissional veem a concessão" ON public.pmo_acessos_profissionais;
CREATE POLICY "Dono do PMO e profissional veem a concessão"
  ON public.pmo_acessos_profissionais FOR SELECT TO authenticated
  USING (
    public.is_pmo_owner(pmo_id)
    OR profissional_id = auth.uid()
  );

DROP POLICY IF EXISTS "Só o dono do PMO concede acesso" ON public.pmo_acessos_profissionais;
CREATE POLICY "Só o dono do PMO concede acesso"
  ON public.pmo_acessos_profissionais FOR INSERT TO authenticated
  WITH CHECK (
    concedido_por = auth.uid()
    AND public.is_pmo_owner(pmo_id)
  );

DROP POLICY IF EXISTS "Só o dono do PMO revoga acesso" ON public.pmo_acessos_profissionais;
CREATE POLICY "Só o dono do PMO revoga acesso"
  ON public.pmo_acessos_profissionais FOR UPDATE TO authenticated
  USING (public.is_pmo_owner(pmo_id))
  WITH CHECK (public.is_pmo_owner(pmo_id));
