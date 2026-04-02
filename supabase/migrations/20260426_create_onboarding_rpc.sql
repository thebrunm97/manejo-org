-- Migration: Create Onboarding RPC
-- Date: 2026-04-26

CREATE OR REPLACE FUNCTION setup_initial_profile(
  p_user_id UUID,
  p_nome TEXT,
  p_propriedade_nome TEXT,
  p_area_ha NUMERIC,
  p_talhao_nome TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_propriedade_id BIGINT;
  v_talhao_id BIGINT;
BEGIN
  -- 1. Update profiles with name
  UPDATE public.profiles
  SET nome = p_nome
  WHERE id = p_user_id;

  -- 2. Insert into propriedades
  INSERT INTO public.propriedades (nome, area_total_ha, user_id)
  VALUES (p_propriedade_nome, p_area_ha, p_user_id)
  RETURNING id INTO v_propriedade_id;

  -- 3. Set newly created property as active in profile
  UPDATE public.profiles
  SET propriedade_ativa_id = v_propriedade_id
  WHERE id = p_user_id;

  -- 4. Insert initial talhao
  INSERT INTO public.talhoes (nome, propriedade_id, area_ha, user_id)
  VALUES (p_talhao_nome, v_propriedade_id, p_area_ha, p_user_id)
  RETURNING id INTO v_talhao_id;

  RETURN jsonb_build_object(
    'success', true,
    'propriedade_id', v_propriedade_id,
    'talhao_id', v_talhao_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
