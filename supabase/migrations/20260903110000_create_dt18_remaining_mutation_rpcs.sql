-- Migration: Create DT-18 Remaining Mutation RPCs
-- Escopo: Substituir escritas diretas do frontend por RPCs SECURITY DEFINER
-- Tabelas afetadas: pmo_propagacao, logs_treinamento, limites_seguranca

-- ============================================================================
-- 1. PMO_PROPAGACAO: CRUD por item (Secao9.tsx)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_propagacao_item(p_pmo_id bigint, p_payload jsonb)
RETURNS public.pmo_propagacao
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_propriedade_id bigint;
  v_row public.pmo_propagacao;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_user_id;

  SELECT propriedade_id INTO v_propriedade_id
  FROM public.pmos
  WHERE id = p_pmo_id AND (user_id = v_user_id OR COALESCE(v_is_admin, false));

  IF v_propriedade_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: PMO não pertence ao usuário.';
  END IF;

  INSERT INTO public.pmo_propagacao (
    pmo_id,
    tipo,
    especies,
    origem,
    quantidade,
    sistema_organico,
    data_compra,
    propriedade_id
  ) VALUES (
    p_pmo_id,
    p_payload->>'tipo',
    p_payload->>'especies',
    p_payload->>'origem',
    p_payload->>'quantidade',
    (p_payload->>'sistema_organico')::boolean,
    (p_payload->>'data_compra')::date,
    v_propriedade_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_propagacao_item(p_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_user_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.pmo_propagacao pp
    JOIN public.pmos ON pmos.id = pp.pmo_id
    WHERE pp.id = p_id AND (pmos.user_id = v_user_id OR COALESCE(v_is_admin, false))
  ) THEN
    RAISE EXCEPTION 'Acesso negado ou item não encontrado.';
  END IF;

  UPDATE public.pmo_propagacao SET
    tipo = COALESCE(p_payload->>'tipo', tipo),
    especies = COALESCE(p_payload->>'especies', especies),
    origem = COALESCE(p_payload->>'origem', origem),
    quantidade = COALESCE(p_payload->>'quantidade', quantidade),
    sistema_organico = COALESCE((p_payload->>'sistema_organico')::boolean, sistema_organico),
    data_compra = COALESCE((p_payload->>'data_compra')::date, data_compra)
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_propagacao_item(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_user_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.pmo_propagacao pp
    JOIN public.pmos ON pmos.id = pp.pmo_id
    WHERE pp.id = p_id AND (pmos.user_id = v_user_id OR COALESCE(v_is_admin, false))
  ) THEN
    RAISE EXCEPTION 'Acesso negado ou item não encontrado.';
  END IF;

  DELETE FROM public.pmo_propagacao WHERE id = p_id;
END;
$$;

-- ============================================================================
-- 2. LOGS_TREINAMENTO: Update genérico por allowlist de colunas (pmoService.ts)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_log_treinamento(p_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_user_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.logs_treinamento
    WHERE id = p_id AND (user_id = v_user_id OR COALESCE(v_is_admin, false))
  ) THEN
    RAISE EXCEPTION 'Acesso negado ou log não encontrado.';
  END IF;

  UPDATE public.logs_treinamento SET
    processado = COALESCE((p_payload->>'processado')::boolean, processado),
    validado = COALESCE((p_payload->>'validado')::boolean, validado),
    foi_editado = COALESCE((p_payload->>'foi_editado')::boolean, foi_editado),
    status_validacao = COALESCE(p_payload->>'status_validacao', status_validacao),
    json_corrigido = COALESCE(p_payload->'json_corrigido', json_corrigido),
    modelo_ia = COALESCE(p_payload->>'modelo_ia', modelo_ia)
  WHERE id = p_id;
END;
$$;

-- ============================================================================
-- 3. LIMITES_SEGURANCA: Upsert por (propriedade_id, pmo_id) (PropertyProfilePage.tsx)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_limites_seguranca(p_propriedade_id bigint, p_pmo_id bigint, p_payload jsonb)
RETURNS public.limites_seguranca
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_row public.limites_seguranca;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT (role = 'admin') INTO v_is_admin FROM public.profiles WHERE id = v_user_id;

  IF NOT (COALESCE(v_is_admin, false) OR (
    EXISTS (SELECT 1 FROM public.propriedades WHERE id = p_propriedade_id AND user_id = v_user_id)
    AND EXISTS (SELECT 1 FROM public.pmos WHERE id = p_pmo_id AND user_id = v_user_id)
  )) THEN
    RAISE EXCEPTION 'Acesso negado: propriedade ou PMO não pertence ao usuário.';
  END IF;

  INSERT INTO public.limites_seguranca (propriedade_id, pmo_id, limite_transacao, limite_manejo)
  VALUES (
    p_propriedade_id,
    p_pmo_id,
    (p_payload->>'limite_transacao')::numeric,
    (p_payload->>'limite_manejo')::numeric
  )
  ON CONFLICT (propriedade_id, pmo_id) DO UPDATE SET
    limite_transacao = EXCLUDED.limite_transacao,
    limite_manejo = EXCLUDED.limite_manejo,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Permissões
REVOKE EXECUTE ON FUNCTION public.create_propagacao_item FROM public;
REVOKE EXECUTE ON FUNCTION public.update_propagacao_item FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_propagacao_item FROM public;
REVOKE EXECUTE ON FUNCTION public.update_log_treinamento FROM public;
REVOKE EXECUTE ON FUNCTION public.upsert_limites_seguranca FROM public;

GRANT EXECUTE ON FUNCTION public.create_propagacao_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_propagacao_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_propagacao_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_log_treinamento TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_limites_seguranca TO authenticated;
