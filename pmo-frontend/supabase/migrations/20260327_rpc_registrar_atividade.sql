-- Migration: Create RPC for declarative MCP activity registration
-- Date: 2026-03-27
-- Description: RPC to register field activities from MCP tools, handling lot generation and canteiro linking.

CREATE OR REPLACE FUNCTION registrar_atividade_pmo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    atividade_arg TEXT,
    data_arg DATE,
    produto_arg TEXT,
    quantidade_valor_arg NUMERIC,
    quantidade_unidade_arg TEXT,
    talhao_nome_arg TEXT,
    canteiros_arg TEXT[],
    insumo_aplicado_arg TEXT DEFAULT NULL,
    fornecedor_arg TEXT DEFAULT NULL,
    nota_fiscal_arg TEXT DEFAULT NULL,
    detalhes_arg JSONB DEFAULT '{}'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_talhao_id BIGINT;
    v_caderno_id UUID;
    v_lote TEXT := NULL;
    v_detalhes JSONB;
    v_canteiro_id UUID;
    v_nome_canteiro TEXT;
    v_atividade_upper TEXT;
BEGIN
    -- 1. Resolve Talhão ID
    SELECT id INTO v_talhao_id 
    FROM talhoes 
    WHERE pmo_id = pmo_id_arg AND nome ILIKE '%' || talhao_nome_arg || '%' 
    LIMIT 1;

    IF v_talhao_id IS NULL THEN
        RAISE EXCEPTION 'Talhão "%" não encontrado para o PMO %', talhao_nome_arg, pmo_id_arg;
    END IF;

    -- 2. Auto-generate Lote for Colheita
    v_atividade_upper := UPPER(atividade_arg);
    IF v_atividade_upper = 'COLHEITA' THEN
        v_lote := 'LOTE-' || to_char(data_arg, 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0');
    END IF;

    -- 3. Prepare detalhes_tecnicos (Parity with Go/React logic)
    v_detalhes := detalhes_arg;
    IF v_detalhes IS NULL THEN v_detalhes := '{}'::jsonb; END IF;

    CASE v_atividade_upper
        WHEN 'PLANTIO' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'qtd_utilizada', quantidade_valor_arg,
                'unidade_medida', quantidade_unidade_arg
            );
        WHEN 'COLHEITA' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'qtd', quantidade_valor_arg,
                'unidade', quantidade_unidade_arg,
                'unidade_medida', quantidade_unidade_arg,
                'lote', COALESCE(v_detalhes->>'lote', v_lote)
            );
        WHEN 'VENDA' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'qtd', quantidade_valor_arg,
                'unidade', quantidade_unidade_arg
            );
        WHEN 'MANEJO' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'dosagem', quantidade_valor_arg,
                'unidade_dosagem', quantidade_unidade_arg,
                'unidade_medida', quantidade_unidade_arg
            );
            IF insumo_aplicado_arg IS NOT NULL AND insumo_aplicado_arg <> '' THEN
                v_detalhes := v_detalhes || jsonb_build_object('insumo_aplicado', insumo_aplicado_arg);
            END IF;
        ELSE
            -- No specific mapping for other types, keep as is
    END CASE;

    -- Add canteiro names to details for fallback/reference
    IF array_length(canteiros_arg, 1) > 0 THEN
        v_detalhes := v_detalhes || jsonb_build_object('canteiros', canteiros_arg);
    END IF;

    -- 4. Insert into caderno_campo
    INSERT INTO caderno_campo (
        pmo_id,
        user_id,
        tipo_atividade,
        data_registro,
        produto,
        quantidade_valor,
        quantidade_unidade,
        talhao_id,
        talhao_canteiro,
        lote,
        fornecedor,
        nota_fiscal,
        detalhes_tecnicos
    ) VALUES (
        pmo_id_arg,
        user_id_arg,
        atividade_arg,
        data_arg,
        produto_arg,
        quantidade_valor_arg,
        quantidade_unidade_arg,
        v_talhao_id,
        talhao_nome_arg,
        COALESCE(v_detalhes->>'lote', v_lote),
        fornecedor_arg,
        nota_fiscal_arg,
        v_detalhes
    ) RETURNING id INTO v_caderno_id;

    -- 5. Resolve and Link Canteiros
    IF array_length(canteiros_arg, 1) > 0 THEN
        FOREACH v_nome_canteiro IN ARRAY canteiros_arg
        LOOP
            -- Resolve canteiro ID (Simple ILIKE match within the talhão)
            SELECT id INTO v_canteiro_id 
            FROM canteiros 
            WHERE talhao_id = v_talhao_id AND nome ILIKE '%' || v_nome_canteiro || '%'
            LIMIT 1;

            IF v_canteiro_id IS NOT NULL THEN
                INSERT INTO caderno_campo_canteiros (caderno_campo_id, canteiro_id)
                VALUES (v_caderno_id, v_canteiro_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- 6. Return response
    RETURN jsonb_build_object(
        'status', 'success',
        'id', v_caderno_id,
        'lote', COALESCE(v_detalhes->>'lote', v_lote),
        'talhao_id', v_talhao_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$;
