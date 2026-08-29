-- =============================================================================
-- FIX v2: Corrigir nome da coluna lote_rastreabilidade → lote
-- =============================================================================
-- Execute este script no SQL Editor do Supabase Dashboard

-- DROP para garantir recriação limpa (sem overload)
DROP FUNCTION IF EXISTS public.rpc_registrar_operacao_campo(bigint, bigint, uuid, text, jsonb, date);
DROP FUNCTION IF EXISTS public.rpc_registrar_operacao_campo(bigint, uuid, text, jsonb, date, bigint);

-- Recriar com coluna correta: "lote" (não "lote_rastreabilidade")
CREATE OR REPLACE FUNCTION public.rpc_registrar_operacao_campo(
  pmo_id_arg         bigint,
  propriedade_id_arg bigint,
  user_id_arg        uuid,
  tipo_arg           text,
  payload_arg        jsonb,
  data_arg           date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   UUID;
  v_lote TEXT;
  v_tipo TEXT := tipo_arg;
BEGIN
  -- Gerar lote automático para Colheita
  IF v_tipo = 'Colheita' THEN
    v_lote := 'COL-'
      || TO_CHAR(COALESCE(data_arg, CURRENT_DATE), 'YYYYMMDD')
      || '-' || UPPER(LEFT(COALESCE(payload_arg->>'produto', 'XXX'), 3))
      || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
  END IF;

  -- INSERT com coluna "lote" (nome correto na tabela caderno_campo)
  INSERT INTO public.caderno_campo (
    pmo_id,
    propriedade_id,
    user_id,
    tipo_atividade,
    produto,
    quantidade_valor,
    quantidade_unidade,
    data_registro,
    detalhes_tecnicos,
    talhao_canteiro,
    lote              -- ← CORRIGIDO de lote_rastreabilidade para lote
  ) VALUES (
    pmo_id_arg,
    propriedade_id_arg,
    user_id_arg,
    v_tipo,
    COALESCE(payload_arg->>'produto', payload_arg->>'item_area', 'NÃO INFORMADO'),
    (payload_arg->>'quantidade_valor')::NUMERIC,
    payload_arg->>'quantidade_unidade',
    COALESCE(data_arg, CURRENT_DATE),
    payload_arg,
    COALESCE(payload_arg->>'talhao_nome', payload_arg->>'talhao'),
    v_lote
  )
  RETURNING id INTO v_id;

  -- Verificação Anti-Falso Positivo
  IF v_id IS NULL THEN
    RETURN jsonb_build_object(
      'status',  'error',
      'message', 'INSERT falhou: RLS bloqueou a operação ou a tabela não retornou ID.',
      'hint',    'RLS_BLOCK_SUSPECTED'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'id',     v_id,
    'lote',   v_lote
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status',  'error',
    'message', SQLERRM,
    'detail',  SQLSTATE
  );
END;
$$;

-- Forçar reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- ✅ Verificação: deve retornar exatamente 1 linha com args canônicos
SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'rpc_registrar_operacao_campo';
