-- DT-138: setup_initial_profile sem idempotência — mesmo bug do DT-74/75.
--
-- setup_initial_profile faz INSERT incondicional em propriedades e talhoes,
-- sem WHERE NOT EXISTS, ON CONFLICT ou índice único. Se a RPC for chamada
-- de novo para o mesmo usuário (retry, reentrada de FSM, reenvio de
-- formulário), o produtor acaba com propriedade/talhão duplicados.
--
-- Hoje nenhum caminho de produção chama esta RPC (o bot WhatsApp usa só
-- CreateBasicProfile, e o frontend usa complete_onboarding, já corrigido no
-- DT-74/75). setup_initial_profile é a peça reservada para uma etapa futura
-- de onboarding completo via WhatsApp, ainda adiada. Corrigindo agora, antes
-- de ela ganhar um chamador real, evita que o mesmo bug volte a produção
-- quando essa etapa for reativada.
--
-- Fix: mesmo padrão do DT-74 — se profiles.propriedade_ativa_id já está
-- setado, uma chamada anterior já completou o cadastro; a RPC devolve os
-- dados existentes (already_onboarded: true) em vez de inserir de novo.
-- Diferente de complete_onboarding (que sempre insere valores fixos), os
-- parâmetros aqui (p_propriedade_nome, p_talhao_nome, p_area_ha) vêm do
-- caller e uma segunda chamada pode enviar valores diferentes — o fast-path
-- deliberadamente não tenta reconciliar isso, só retorna o que já existe,
-- mesma simplicidade do precedente do DT-74.

CREATE OR REPLACE FUNCTION setup_initial_profile(
  p_user_id UUID,
  p_nome TEXT,
  p_propriedade_nome TEXT,
  p_area_ha NUMERIC,
  p_talhao_nome TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_propriedade_id BIGINT;
  v_talhao_id BIGINT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Acesso negado: Tentativa de falsificação de identidade (IDOR). O p_user_id não corresponde ao token de autenticação.'
    );
  END IF;

  -- DT-138: idempotência — onboarding já concluído, devolve o que já existe.
  SELECT propriedade_ativa_id INTO v_propriedade_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_propriedade_id IS NOT NULL THEN
    SELECT id INTO v_talhao_id
    FROM public.talhoes
    WHERE propriedade_id = v_propriedade_id AND user_id = p_user_id
    ORDER BY id ASC
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'propriedade_id', v_propriedade_id,
      'talhao_id', v_talhao_id,
      'already_onboarded', true
    );
  END IF;

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
