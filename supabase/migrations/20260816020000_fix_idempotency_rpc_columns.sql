-- ============================================================
-- MIGRATION: 20260816020000_fix_idempotency_rpc_columns.sql
-- Description: Corrige nomes de colunas na RPC rpc_registrar_cota_produtor
--              (usuario_id -> user_id, data_plantio -> data_plantio_recomendada)
--              Extraído para evitar drift da migração base.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_registrar_cota_produtor(
    p_demanda_id UUID,
    p_propriedade_id BIGINT,
    p_usuario_id UUID,
    p_quantidade NUMERIC,
    p_data_plantio DATE DEFAULT NULL,
    p_observacao TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_cota_id UUID;
    v_cronograma_id UUID;
    v_existing_id UUID;
BEGIN
    -- 0. Checagem de Idempotência Pré-Insert
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT id INTO v_existing_id 
        FROM public.cotas_produtores 
        WHERE idempotency_key = p_idempotency_key 
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'already_processed',
                'cota_id', v_existing_id,
                'message', 'Cota de produção já registrada anteriormente (Deduplicação de Idempotência).'
            );
        END IF;
    END IF;

    -- 1. Inserção na tabela cotas_produtores (Corrigido: user_id)
    INSERT INTO public.cotas_produtores (
        demanda_id,
        propriedade_id,
        user_id,
        quantidade_assumida,
        idempotency_key
    ) VALUES (
        p_demanda_id,
        p_propriedade_id,
        p_usuario_id,
        p_quantidade,
        p_idempotency_key
    )
    RETURNING id INTO v_cota_id;

    -- 2. Inserção no cronograma_plantio (Corrigido: data_plantio_recomendada)
    IF p_data_plantio IS NOT NULL THEN
        INSERT INTO public.cronograma_plantio (
            cota_id,
            data_plantio_recomendada,
            observacao_ia
        ) VALUES (
            v_cota_id,
            p_data_plantio,
            p_observacao
        )
        RETURNING id INTO v_cronograma_id;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'cota_id', v_cota_id,
        'cronograma_id', v_cronograma_id,
        'message', 'Cota de cooperativa e cronograma vinculados com sucesso.'
    );

EXCEPTION
    WHEN unique_violation THEN
        SELECT id INTO v_existing_id 
        FROM public.cotas_produtores 
        WHERE idempotency_key = p_idempotency_key 
        LIMIT 1;

        RETURN jsonb_build_object(
            'status', 'already_processed',
            'cota_id', v_existing_id,
            'message', 'Cota já registrada em concorrência (Constraint UNIQUE disparada).'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;
