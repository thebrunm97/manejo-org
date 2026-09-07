-- Migration: Create complete_onboarding RPC to replace direct inserts/updates
-- Created at: 2026-08-30

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_tipo_perfil TEXT,
  p_culturas_interesse TEXT[],
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_modalidade_producao TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_propriedade_id BIGINT;
  v_talhao_id BIGINT;
  v_modalidade public.modalidade_producao_enum;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Mapear string para o enum modalidade_producao_enum
  IF UPPER(p_modalidade_producao) IN ('ORGANICO', 'CONVENCIONAL', 'TRANSICAO') THEN
    v_modalidade := UPPER(p_modalidade_producao)::public.modalidade_producao_enum;
  ELSIF UPPER(p_modalidade_producao) IN ('EM_CONVERSAO', 'CONVERSAO') THEN
    v_modalidade := 'TRANSICAO'::public.modalidade_producao_enum;
  ELSE
    v_modalidade := 'CONVENCIONAL'::public.modalidade_producao_enum;
  END IF;

  -- 1. Atualizar Profile
  UPDATE public.profiles
  SET 
    tipo_perfil = p_tipo_perfil,
    culturas_interesse = p_culturas_interesse
  WHERE id = v_user_id;

  -- 2. Inserir Propriedade
  INSERT INTO public.propriedades (nome, latitude, longitude, user_id, area_total_ha)
  VALUES (E'S\u00EDtio / Fazenda', p_latitude, p_longitude, v_user_id, 0)
  RETURNING id INTO v_propriedade_id;

  -- 3. Atualizar Propriedade Ativa no Profile
  UPDATE public.profiles
  SET propriedade_ativa_id = v_propriedade_id
  WHERE id = v_user_id;

  -- 4. Inserir Talhão Default
  INSERT INTO public.talhoes (nome, propriedade_id, user_id, modalidade_producao, area_ha)
  VALUES ('Sede', v_propriedade_id, v_user_id, v_modalidade, 0)
  RETURNING id INTO v_talhao_id;

  RETURN jsonb_build_object(
    'success', true,
    'propriedade_id', v_propriedade_id,
    'talhao_id', v_talhao_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
