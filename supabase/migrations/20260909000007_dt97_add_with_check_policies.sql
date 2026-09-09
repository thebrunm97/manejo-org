-- Migration: DT-97 (lote 1) — WITH CHECK na policy de UPDATE de profiles +
-- validação de posse de pmo_ativo_id
--
-- Contexto: 20260401_create_profiles.sql:61-64 criava
--   "Usuários editam seu próprio perfil" FOR UPDATE TO authenticated
--   USING (id = auth.uid())
-- SEM WITH CHECK. Como RLS não compara o valor antigo da linha, um usuário podia
-- UPDATE profiles SET pmo_ativo_id = <PMO de outro tenant> — a linha continuava
-- dele (USING passa antes e depois), mas o valor gravado apontava para dados de
-- outro tenant. pmo_ativo_id alimenta o ledger financeiro
-- (20260525_create_financial_ledger.sql) e ~18 tabelas do core
-- (20260402000000_create_core_app_tables.sql) que confiam nesse campo.
--
-- Escopo mínimo e seguro deste primeiro lote: NÃO toca nas 18 tabelas do core
-- (mapear policy por policy é escopo maior — DT-97 "estendido").
--
-- Decisões de desenho (confirmadas por grep/leitura antes de escrever):
--   * Posse de PMO é modelada em public.pmos.user_id (20260402000000:37,
--     DEFAULT auth.uid(); policy "Usuários gerenciam seus PMOs" USING user_id = auth.uid()).
--   * Frontend muda pmo_ativo_id pela RPC update_profile (SECURITY DEFINER,
--     20260818140000_create_domain_mutation_rpcs.sql:8-37) ou UPDATE direto — a
--     policy abaixo cobre o UPDATE direto e a trigger cobre TODOS os caminhos de
--     escrita (incluindo a re-exposição via update_profile, que não validava posse).
--   * O BOT grava pmo_ativo_id via PATCH direto em profiles com a service_role key
--     (pmo-bot-go/internal/supabase/client.go: UpdateActivePMO:2101,
--     UpdateActivePropriedade:2111, SetPropriedadeAtiva:2371) — por isso a trigger
--     exclui auth.role() = 'service_role' (backend confiado; tenant já validado no
--     lado do bot — DT-67).

-- ── 1) Policy com WITH CHECK replicando o USING ─────────────────────────────────
DROP POLICY IF EXISTS "Usuários editam seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários editam seu próprio perfil"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ── 2) Trigger impedindo pmo_ativo_id apontar para PMO que não é do usuário ─────
-- Cobre o UPDATE direto (RLS) E a RPC update_profile (SECURITY DEFINER), já que
-- trigger dispara em qualquer escrita. auth.uid()/auth.role() leem o JWT original
-- mesmo dentro de contexto SECURITY DEFINER, então a checagem vale para o usuário
-- real que fez a chamada. Escritas do bot (service_role) seguem liberadas.
CREATE OR REPLACE FUNCTION public.check_profile_pmo_ativo_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.pmo_ativo_id IS DISTINCT FROM OLD.pmo_ativo_id
       AND NEW.pmo_ativo_id IS NOT NULL
       AND COALESCE(auth.role(), '') <> 'service_role'
       AND NOT EXISTS (
           SELECT 1
           FROM public.pmos
           WHERE id = NEW.pmo_ativo_id
             AND user_id = auth.uid()
       ) THEN
        RAISE EXCEPTION 'pmo_ativo_id (%) não pertence ao usuário', NEW.pmo_ativo_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_pmo_ativo_ownership ON public.profiles;
CREATE TRIGGER trg_profile_pmo_ativo_ownership
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_pmo_ativo_ownership();