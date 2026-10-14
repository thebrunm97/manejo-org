-- Complemento de compra de insumo: depois de registrar "3 sacos de adubo", o
-- bot pergunta que adubo era e quantos kg tem cada saco; a resposta chega
-- aqui. Grava em caderno_campo.detalhes_tecnicos (composicao,
-- peso_unidade_kg) e, quando há tipo, atualiza a composição do insumo no
-- catálogo do PMO (pmo_insumos, ligado por detalhes_tecnicos.insumo_id).
--
-- Posse: a compra precisa ser do próprio usuário e o PMO dele
-- (assert_dono_pmo, DT-102). Só service_role executa.

CREATE OR REPLACE FUNCTION public.rpc_complementar_compra_insumo(
    compra_id_arg uuid,
    user_id_arg uuid,
    composicao_arg text DEFAULT NULL,
    peso_unidade_kg_arg numeric DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_pmo_id bigint;
    v_dono uuid;
    v_detalhes jsonb;
    v_composicao text := NULLIF(btrim(composicao_arg), '');
BEGIN
    SELECT pmo_id, user_id, COALESCE(detalhes_tecnicos, '{}'::jsonb)
      INTO v_pmo_id, v_dono, v_detalhes
      FROM public.caderno_campo
     WHERE id = compra_id_arg
       AND tipo_atividade = 'Compra de Insumo';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Compra não encontrada.');
    END IF;
    IF v_dono IS DISTINCT FROM user_id_arg THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Compra de outro usuário.');
    END IF;
    PERFORM public.assert_dono_pmo(v_pmo_id, user_id_arg, NULL);

    IF peso_unidade_kg_arg IS NOT NULL AND peso_unidade_kg_arg <= 0 THEN
        peso_unidade_kg_arg := NULL;
    END IF;

    UPDATE public.caderno_campo
       SET detalhes_tecnicos = v_detalhes || jsonb_strip_nulls(jsonb_build_object(
               'composicao', v_composicao,
               'peso_unidade_kg', peso_unidade_kg_arg))
     WHERE id = compra_id_arg;

    IF v_composicao IS NOT NULL AND (v_detalhes->>'insumo_id') IS NOT NULL THEN
        UPDATE public.pmo_insumos
           SET composicao = v_composicao
         WHERE id = (v_detalhes->>'insumo_id')::uuid
           AND pmo_id = v_pmo_id;
    END IF;

    RETURN jsonb_build_object('status', 'success');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_complementar_compra_insumo(uuid, uuid, text, numeric)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_complementar_compra_insumo(uuid, uuid, text, numeric)
    TO service_role;
