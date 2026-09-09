-- DT-74 + DT-75: complete_onboarding sem idempotência e modalidade
-- desconhecida caindo silenciosamente em CONVENCIONAL.
--
-- DT-74: nenhuma guarda de existência prévia — reload da tela, reenvio pelo
-- produtor ou retry do sync offline (DT-87) duplicava propriedade+talhão.
-- Fix: se o profile já tem propriedade_ativa_id setado, é porque uma chamada
-- anterior já completou o onboarding — retorna os dados existentes em vez de
-- inserir de novo. propriedade_ativa_id é o marcador de conclusão correto
-- (não lat/lng, que pode variar por jitter de GPS entre tentativas do mesmo
-- fluxo).
--
-- DT-75: o ELSE do mapeamento convertia qualquer valor fora do enum
-- conhecido para CONVENCIONAL sem erro. Confirmado ao ler o único chamador
-- hoje (pmo-frontend/src/pages/OnboardingPage.tsx:189) que o valor enviado
-- já é sempre um dos três válidos — a troca para erro explícito não quebra
-- esse caller, só fecha a porta para um futuro caller (ex.: onboarding via
-- WhatsApp do DT-58) que mande algo como 'nao_sei' e polua o cadastro.

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

  -- DT-74: idempotência — onboarding já concluído, devolve o que já existe.
  SELECT propriedade_ativa_id INTO v_propriedade_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_propriedade_id IS NOT NULL THEN
    SELECT id INTO v_talhao_id
    FROM public.talhoes
    WHERE propriedade_id = v_propriedade_id AND user_id = v_user_id
    ORDER BY id ASC
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'propriedade_id', v_propriedade_id,
      'talhao_id', v_talhao_id,
      'already_onboarded', true
    );
  END IF;

  -- DT-75: modalidade desconhecida agora é erro, não default silencioso.
  IF UPPER(p_modalidade_producao) IN ('ORGANICO', 'CONVENCIONAL', 'TRANSICAO') THEN
    v_modalidade := UPPER(p_modalidade_producao)::public.modalidade_producao_enum;
  ELSIF UPPER(p_modalidade_producao) IN ('EM_CONVERSAO', 'CONVERSAO') THEN
    v_modalidade := 'TRANSICAO'::public.modalidade_producao_enum;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'modalidade_producao inválida: ' || COALESCE(p_modalidade_producao, '(vazio)')
    );
  END IF;

  -- 1. Atualizar Profile
  UPDATE public.profiles
  SET
    tipo_perfil = p_tipo_perfil,
    culturas_interesse = p_culturas_interesse
  WHERE id = v_user_id;

  -- 2. Inserir Propriedade
  INSERT INTO public.propriedades (nome, latitude, longitude, user_id, area_total_ha)
  VALUES (E'Sítio / Fazenda', p_latitude, p_longitude, v_user_id, 0)
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
