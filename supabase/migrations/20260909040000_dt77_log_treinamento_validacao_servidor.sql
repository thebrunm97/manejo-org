-- DT-77: update_log_treinamento aceitava modelo_ia/validado/status_validacao/
-- json_corrigido como parâmetros livres do chamador autenticado — qualquer
-- dono do log podia se autovalidar, escolher o modelo da IA e injetar
-- ground-truth arbitrário.
--
-- Verificado antes de restringir (pmo-frontend/src/services/pmoService.ts):
-- os três chamadores reais hoje (markSuggestionAsProcessed, logFeedback via
-- BotSuggestionsPanel.tsx, saveRefinedSuggestion) só mandam processado,
-- foi_editado, status_validacao e json_corrigido — nunca modelo_ia nem
-- validado (grep confirmado, só aparece no arquivo de tipos gerados). Esse é
-- o fluxo legítimo de human-in-the-loop: o PRÓPRIO produtor corrige a
-- sugestão da IA sobre o seu registro, então json_corrigido/status_validacao
-- continuam graváveis pelo dono, sem exigir admin.
--
-- O que muda: modelo_ia (deveria ser derivado de qual modelo de fato
-- processou o log, não escolhido pelo chamador) e validado (nenhum caller
-- real usa hoje) saem do payload aceito por esta RPC. Se um dia existir um
-- painel de QA para setar esses dois campos, deve ser uma RPC própria com
-- checagem de admin — não esta, que qualquer dono de log pode chamar.

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

  IF p_payload ? 'modelo_ia' OR p_payload ? 'validado' THEN
    RAISE EXCEPTION 'modelo_ia e validado não são graváveis por esta função.';
  END IF;

  UPDATE public.logs_treinamento SET
    processado = COALESCE((p_payload->>'processado')::boolean, processado),
    foi_editado = COALESCE((p_payload->>'foi_editado')::boolean, foi_editado),
    status_validacao = COALESCE(p_payload->>'status_validacao', status_validacao),
    json_corrigido = COALESCE(p_payload->'json_corrigido', json_corrigido)
  WHERE id = p_id;
END;
$$;
