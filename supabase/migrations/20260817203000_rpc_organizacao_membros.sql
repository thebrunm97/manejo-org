-- Migration: 20260817203000_rpc_organizacao_membros.sql
-- Description: RPCs seguras para vinculação/desvinculação de membros de organização (DT-18 Item 3)

CREATE OR REPLACE FUNCTION public.rpc_add_organizacao_membro(
    p_organizacao_id bigint,
    p_propriedade_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_prop_owner uuid;
BEGIN
    -- 1. Verifica se a propriedade existe e obtém o dono
    SELECT user_id INTO v_prop_owner
    FROM public.propriedades
    WHERE id = p_propriedade_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Propriedade não encontrada.', 'code', 'ERR_NOT_FOUND');
    END IF;

    -- 2. Valida autorização (apenas o dono pode vincular)
    IF v_prop_owner != auth.uid() THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Apenas o dono da propriedade pode vinculá-la a uma organização.', 'code', 'ERR_AUTH_FORBIDDEN');
    END IF;

    -- 3. Insere a vinculação (Trata duplicidade)
    BEGIN
        INSERT INTO public.organizacao_membros (organizacao_id, propriedade_id, role, data_filiacao)
        VALUES (p_organizacao_id, p_propriedade_id, 'membro', now());
    EXCEPTION
        WHEN unique_violation THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'Esta propriedade já é membro desta organização.', 'code', 'ERR_DUPLICATE');
    END;

    RETURN jsonb_build_object('status', 'success', 'data', jsonb_build_object('organizacao_id', p_organizacao_id, 'propriedade_id', p_propriedade_id));
END;
$$;


CREATE OR REPLACE FUNCTION public.rpc_remove_organizacao_membro(
    p_organizacao_id bigint,
    p_propriedade_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_prop_owner uuid;
    v_deleted_count int;
BEGIN
    -- 1. Verifica se a propriedade existe e obtém o dono
    SELECT user_id INTO v_prop_owner
    FROM public.propriedades
    WHERE id = p_propriedade_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Propriedade não encontrada.', 'code', 'ERR_NOT_FOUND');
    END IF;

    -- 2. Valida autorização (apenas o dono pode desvincular)
    IF v_prop_owner != auth.uid() THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Apenas o dono da propriedade pode desvinculá-la de uma organização.', 'code', 'ERR_AUTH_FORBIDDEN');
    END IF;

    -- 3. Executa a deleção
    DELETE FROM public.organizacao_membros
    WHERE organizacao_id = p_organizacao_id AND propriedade_id = p_propriedade_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count = 0 THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Vínculo não encontrado.', 'code', 'ERR_NOT_FOUND');
    END IF;

    RETURN jsonb_build_object('status', 'success', 'message', 'Vínculo removido com sucesso.');
END;
$$;
