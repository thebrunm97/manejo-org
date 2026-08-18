CREATE OR REPLACE FUNCTION rpc_insert_lote_rastreabilidade(
    p_codigo_lote text,
    p_caderno_campo_id uuid,
    p_propriedade_id bigint,
    p_cultura text,
    p_data_colheita date,
    p_quantidade numeric,
    p_qr_code_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_prop_owner uuid;
    v_caderno_owner uuid;
    v_inserted_id uuid;
BEGIN
    -- 1. Check Authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Não autenticado', 'code', 'ERR_AUTH');
    END IF;

    -- 2. Validate format: LOT-YYYYMMDD-XXX
    IF NOT p_codigo_lote ~ '^LOT-\d{8}-[A-Z0-9]{3}$' THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Formato de código de lote inválido', 'code', 'ERR_VALIDATION');
    END IF;

    -- 3. Validate Ownership of Propriedade
    SELECT user_id INTO v_prop_owner FROM propriedades WHERE id = p_propriedade_id;
    IF v_prop_owner IS NULL OR v_prop_owner != v_user_id THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Propriedade inválida ou não pertence ao usuário', 'code', 'ERR_FORBIDDEN');
    END IF;

    -- 4. Validate Ownership of Caderno de Campo (if linked)
    IF p_caderno_campo_id IS NOT NULL THEN
        SELECT user_id INTO v_caderno_owner FROM caderno_campo WHERE id = p_caderno_campo_id;
        IF v_caderno_owner IS NULL OR v_caderno_owner != v_user_id THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'Caderno de campo inválido ou não pertence ao usuário', 'code', 'ERR_FORBIDDEN');
        END IF;
    END IF;

    -- 5. Insert with unique violation catch
    BEGIN
        INSERT INTO lotes_rastreabilidade (
            codigo_lote,
            caderno_campo_id,
            propriedade_id,
            cultura,
            data_colheita,
            quantidade,
            qr_code_url,
            user_id
        ) VALUES (
            p_codigo_lote,
            p_caderno_campo_id,
            p_propriedade_id,
            p_cultura,
            p_data_colheita,
            p_quantidade,
            p_qr_code_url,
            v_user_id
        ) RETURNING id INTO v_inserted_id;

        RETURN jsonb_build_object(
            'status', 'success',
            'data', jsonb_build_object(
                'id', v_inserted_id,
                'codigo_lote', p_codigo_lote
            )
        );
    EXCEPTION
        WHEN unique_violation THEN
            -- Retorna erro específico para o JS tentar gerar novo ID
            RETURN jsonb_build_object(
                'status', 'error',
                'message', 'Código de lote já existe (colisão)',
                'code', 'ERR_DUPLICATE'
            );
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'status', 'error',
                'message', SQLERRM,
                'code', 'ERR_UNKNOWN'
            );
    END;
END;
$$;
