-- rpc_registrar_compra_insumo: o passo 1 (catálogo de insumos do PMO)
-- gravava em pmo_insumos com as colunas de pmo_manejo (insumo, fonte,
-- quantidade, data_aplicacao), que pmo_insumos não tem — nem em produção
-- (confirmado em 2026-10-07: a função de produção é esta mesma). Toda compra
-- registrada pelo bot falhava com "column insumo of relation pmo_insumos does
-- not exist" e, como a função devolve {"status":"error"} em vez de lançar, o
-- produtor só recebia "tive um problema técnico".
--
-- Volta ao formato da versão anterior (produto_manejo/marca/composicao/
-- procedencia, upsert em unique_pmo_insumo_produto), mantendo tudo o que a
-- versão com idempotência trouxe. Achado pelo teste E2E de despesa (DT-139).
--
-- Só o passo 1 muda; o restante é cópia de
-- 20260816000000_add_idempotency_to_mutations.sql.

CREATE OR REPLACE FUNCTION public.rpc_registrar_compra_insumo(
    pmo_id_arg bigint, 
    propriedade_id_arg bigint,
    user_id_arg uuid, 
    produto_arg text, 
    quantidade_valor_arg numeric, 
    quantidade_unidade_arg text, 
    fornecedor_arg text DEFAULT NULL::text, 
    data_compra_arg date DEFAULT CURRENT_DATE, 
    nota_fiscal_arg text DEFAULT NULL::text, 
    marca_arg text DEFAULT NULL::text, 
    composicao_arg text DEFAULT NULL::text, 
    procedencia_arg text DEFAULT NULL::text,
    valor_total_arg numeric DEFAULT 0,
    alocacoes_talhoes_arg jsonb DEFAULT NULL,
    categoria_nome_arg text DEFAULT NULL,
    raw_payload_id_arg uuid DEFAULT NULL,
    idempotency_key_arg text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_insumo_id UUID;
    v_compra_id UUID;
    v_transacao_id UUID;
    v_detalhes JSONB;
    v_alocacao JSONB;
    v_talhao_id BIGINT;
    v_categoria_id UUID;
    v_modalidade_interceptada public.modalidade_producao_enum := 'ORGANICO';
    
    v_total_alocado_calc NUMERIC := 0;
    v_valor_alocado NUMERIC;
    v_index INT := 0;
    v_array_length INT := 0;
    v_existing_id UUID;
BEGIN
    -- 0. Checagem de Idempotência Pré-Insert
    IF idempotency_key_arg IS NOT NULL AND idempotency_key_arg <> '' THEN
        SELECT id INTO v_existing_id 
        FROM public.caderno_campo 
        WHERE idempotency_key = idempotency_key_arg 
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'already_processed',
                'compra_id', v_existing_id,
                'message', 'Compra já registrada anteriormente (Deduplicação de Idempotência).'
            );
        END IF;
    END IF;

    -- 1. Registrar no catálogo de insumos do PMO (upsert por produto).
    --    Antes gravava insumo/fonte/quantidade/data_aplicacao — colunas de
    --    pmo_manejo, que pmo_insumos não tem: toda compra falhava aqui.
    INSERT INTO public.pmo_insumos (
        pmo_id,
        propriedade_id,
        produto_manejo,
        marca,
        composicao,
        procedencia
    )
    VALUES (
        pmo_id_arg,
        propriedade_id_arg,
        produto_arg,
        NULLIF(marca_arg, ''),
        NULLIF(composicao_arg, ''),
        COALESCE(NULLIF(procedencia_arg, ''), NULLIF(fornecedor_arg, ''))
    )
    ON CONFLICT (pmo_id, produto_manejo)
    DO UPDATE SET
        marca = COALESCE(EXCLUDED.marca, pmo_insumos.marca),
        composicao = COALESCE(EXCLUDED.composicao, pmo_insumos.composicao),
        procedencia = COALESCE(EXCLUDED.procedencia, pmo_insumos.procedencia)
    RETURNING id INTO v_insumo_id;

    -- 2. Montar detalhes técnicos extras
    v_detalhes := jsonb_build_object(
        'insumo_id', v_insumo_id,
        'nota_fiscal', nota_fiscal_arg,
        'marca', marca_arg,
        'composicao', composicao_arg
    );

    -- 3. Registrar a compra no caderno de campo (com idempotency_key)
    INSERT INTO public.caderno_campo (
        pmo_id,
        propriedade_id,
        user_id,
        tipo_atividade,
        data_registro,
        produto,
        quantidade_valor,
        quantidade_unidade,
        fornecedor,
        nota_fiscal,
        detalhes_tecnicos,
        secao_origem,
        observacao_original,
        raw_payload_id,
        idempotency_key
    )
    VALUES (
        pmo_id_arg,
        propriedade_id_arg,
        user_id_arg,
        'Compra de Insumo',
        data_compra_arg,
        produto_arg,
        quantidade_valor_arg,
        quantidade_unidade_arg,
        fornecedor_arg,
        nota_fiscal_arg,
        v_detalhes,
        'pmo_insumos',
        'Compra registrada automaticamente via bot.',
        raw_payload_id_arg,
        idempotency_key_arg
    )
    RETURNING id INTO v_compra_id;

    -- 4. Registrar transação financeira se houver valor
    IF valor_total_arg > 0 THEN
        IF categoria_nome_arg IS NOT NULL AND categoria_nome_arg <> '' THEN
            SELECT id INTO v_categoria_id 
            FROM public.categorias_financeiras 
            WHERE nome ILIKE '%' || categoria_nome_arg || '%' 
              AND tipo = 'DESPESA'
            LIMIT 1;
        END IF;

        IF v_categoria_id IS NULL THEN
            SELECT id INTO v_categoria_id 
            FROM public.categorias_financeiras 
            WHERE nome ILIKE '%Insumos%' 
              AND tipo = 'DESPESA'
            LIMIT 1;
        END IF;

        IF v_categoria_id IS NULL THEN
            SELECT id INTO v_categoria_id 
            FROM public.categorias_financeiras 
            WHERE tipo = 'DESPESA' 
            LIMIT 1;
        END IF;

        INSERT INTO public.transacoes_financeiras (
            pmo_id,
            propriedade_id,
            categoria_id,
            tipo,
            valor_total,
            data_competencia,
            data_transacao,
            fornecedor_cliente,
            user_id,
            raw_payload_id,
            idempotency_key
        )
        VALUES (
            pmo_id_arg,
            propriedade_id_arg,
            v_categoria_id,
            'despesa',
            valor_total_arg,
            data_compra_arg,
            data_compra_arg,
            fornecedor_arg,
            user_id_arg,
            raw_payload_id_arg,
            idempotency_key_arg
        )
        RETURNING id INTO v_transacao_id;

        -- 5. Rateio de Talhões
        IF alocacoes_talhoes_arg IS NOT NULL AND jsonb_array_length(alocacoes_talhoes_arg) > 0 THEN
            v_array_length := jsonb_array_length(alocacoes_talhoes_arg);
            FOR v_alocacao IN SELECT * FROM jsonb_array_elements(alocacoes_talhoes_arg)
            LOOP
                v_index := v_index + 1;
                v_talhao_id := NULL;

                IF (v_alocacao->>'talhao_id') IS NOT NULL AND (v_alocacao->>'talhao_id') <> '' THEN
                    v_talhao_id := (v_alocacao->>'talhao_id')::BIGINT;
                ELSIF (v_alocacao->>'talhao_nome') IS NOT NULL AND (v_alocacao->>'talhao_nome') <> '' THEN
                    SELECT id INTO v_talhao_id
                    FROM public.talhoes
                    WHERE nome ILIKE (v_alocacao->>'talhao_nome')
                      AND (propriedade_id = propriedade_id_arg OR propriedade_id IS NULL)
                    LIMIT 1;
                END IF;

                v_valor_alocado := (v_alocacao->>'valor_alocado')::NUMERIC;
                IF v_valor_alocado IS NULL OR v_valor_alocado <= 0 THEN
                    v_valor_alocado := ROUND(valor_total_arg / v_array_length, 2);
                END IF;

                v_total_alocado_calc := v_total_alocado_calc + v_valor_alocado;

                IF v_index = v_array_length AND v_total_alocado_calc <> valor_total_arg THEN
                    v_valor_alocado := v_valor_alocado + (valor_total_arg - v_total_alocado_calc);
                END IF;

                INSERT INTO public.transacao_alocacoes (
                    transacao_id,
                    caderno_campo_id,
                    talhao_id,
                    valor_alocado,
                    percentual_alocado
                )
                VALUES (
                    v_transacao_id,
                    v_compra_id,
                    v_talhao_id,
                    v_valor_alocado,
                    ROUND((v_valor_alocado / valor_total_arg) * 100, 2)
                );
            END LOOP;
        ELSE
            INSERT INTO public.transacao_alocacoes (
                transacao_id,
                caderno_campo_id,
                talhao_id,
                valor_alocado,
                percentual_alocado
            )
            VALUES (
                v_transacao_id,
                v_compra_id,
                NULL,
                valor_total_arg,
                100.00
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'compra_id', v_compra_id,
        'transacao_id', v_transacao_id,
        'message', 'Compra de insumo e transação financeira registradas com sucesso.'
    );

EXCEPTION 
    WHEN unique_violation THEN
        SELECT id INTO v_existing_id 
        FROM public.caderno_campo 
        WHERE idempotency_key = idempotency_key_arg 
        LIMIT 1;

        RETURN jsonb_build_object(
            'status', 'already_processed',
            'compra_id', v_existing_id,
            'message', 'Compra já registrada em concorrência (Constraint UNIQUE disparada).'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM
        );
END;
$function$;
