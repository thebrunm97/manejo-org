-- ============================================================
-- MIGRATION: Idempotência nas Tabelas de Mutação e RPCs do Supabase
-- File: supabase/migrations/20260816000000_add_idempotency_to_mutations.sql
-- Description: Adiciona coluna idempotency_key e índices UNIQUE em caderno_campo,
--              transacoes_financeiras e cotas_produtores.
--              Atualiza todas as RPCs de mutação para deduplicação determinística:
--              1. rpc_registrar_operacao_campo
--              2. rpc_registrar_compra_insumo
--              3. rpc_registrar_transacao_com_rateio
--              4. rpc_registrar_cota_produtor
-- ============================================================

-- 1. Estrutura: Colunas e Índices UNIQUE de Idempotência (Sem Lock de Tabela)
ALTER TABLE public.caderno_campo 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_caderno_campo_idempotency_key 
ON public.caderno_campo (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.transacoes_financeiras 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_transacoes_financeiras_idempotency_key 
ON public.transacoes_financeiras (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.cotas_produtores 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_cotas_produtores_idempotency_key 
ON public.cotas_produtores (idempotency_key) 
WHERE idempotency_key IS NOT NULL;


-- 2. Limpeza de Sobrecargas Obsoletas e Atualização das RPCs de Mutação

-- Limpeza de sobrecargas legadas de rpc_registrar_operacao_campo
DROP FUNCTION IF EXISTS public.rpc_registrar_operacao_campo(bigint, bigint, uuid, text, jsonb, date);
DROP FUNCTION IF EXISTS public.rpc_registrar_operacao_campo(bigint, uuid, text, jsonb);

-- Limpeza de sobrecargas legadas de rpc_registrar_compra_insumo (15 e 16 parâmetros)
DROP FUNCTION IF EXISTS public.rpc_registrar_compra_insumo(bigint, bigint, uuid, text, numeric, text, text, date, text, text, text, text, numeric, jsonb, text);
DROP FUNCTION IF EXISTS public.rpc_registrar_compra_insumo(bigint, bigint, uuid, text, numeric, text, text, date, text, text, text, text, numeric, jsonb, text, uuid);
DROP FUNCTION IF EXISTS public.rpc_registrar_compra_insumo(bigint, bigint, uuid, text, numeric, text, text, date, text, text, text, text, numeric, jsonb, text, uuid, text);

-- Limpeza de sobrecarga de rpc_registrar_transacao_com_rateio
DROP FUNCTION IF EXISTS public.rpc_registrar_transacao_com_rateio(jsonb);

-- Atualização: rpc_registrar_operacao_campo com Deduplicação
CREATE OR REPLACE FUNCTION public.rpc_registrar_operacao_campo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    tipo_arg TEXT,
    payload_arg JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_id UUID;
    v_pilha_id UUID;
    v_talhao_id_res BIGINT;
    v_modalidade_interceptada public.modalidade_producao_enum := 'ORGANICO';
    v_status TEXT := 'success';
    v_message TEXT;
    v_lote TEXT;
    v_data_registro DATE := COALESCE((payload_arg->>'data')::DATE, CURRENT_DATE);
    v_produto TEXT := payload_arg->>'produto';
    v_qtd_valor NUMERIC := (payload_arg->>'quantidade_valor')::NUMERIC;
    v_qtd_unidade TEXT := payload_arg->>'quantidade_unidade';
    v_talhao_nome TEXT := payload_arg->>'talhao_nome';
    v_canteiro_ids JSONB := COALESCE(payload_arg->'canteiro_ids', '[]');
    
    -- Integração Financeira
    v_valor_total NUMERIC := (payload_arg->>'valor_total')::NUMERIC;
    v_transacao_id UUID;
    v_categoria_id UUID;
    v_tipo_financeiro TEXT := 'despesa';
    v_nome_categoria TEXT := 'Outros';
    v_propriedade_id BIGINT;
    
    -- Rastreabilidade e Idempotência
    v_raw_payload_id UUID := (payload_arg->>'raw_payload_id')::UUID;
    v_idempotency_key TEXT := payload_arg->>'idempotency_key';
    v_existing_id UUID;
    v_existing_lote TEXT;
BEGIN
    -- 0. Checagem de Idempotência Pré-Insert
    IF v_idempotency_key IS NOT NULL AND v_idempotency_key <> '' THEN
        SELECT id, lote INTO v_existing_id, v_existing_lote 
        FROM public.caderno_campo 
        WHERE idempotency_key = v_idempotency_key 
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'already_processed',
                'id', v_existing_id,
                'lote', v_existing_lote,
                'message', 'Operação já registrada anteriormente (Deduplicação de Idempotência).'
            );
        END IF;
    END IF;

    -- 1. Resolver Talhão ID se fornecido por nome
    IF v_talhao_nome IS NOT NULL AND v_talhao_nome <> '' THEN
        SELECT id, modalidade_producao INTO v_talhao_id_res, v_modalidade_interceptada
        FROM public.talhoes 
        WHERE nome ILIKE v_talhao_nome
          AND (pmo_id = pmo_id_arg OR pmo_id IS NULL)
        LIMIT 1;
    END IF;

    CASE tipo_arg
        WHEN 'Limpeza' THEN
            INSERT INTO public.pmo_limpeza (
                pmo_id, data_limpeza, item_area, tipo_limpeza, produto_utilizado, dosagem, responsavel, observacao
            )
            VALUES (
                pmo_id_arg, v_data_registro, payload_arg->>'item_area', payload_arg->>'tipo_limpeza',
                payload_arg->>'produto_utilizado', payload_arg->>'dosagem', 
                COALESCE(payload_arg->>'responsavel', 'Produtor'), payload_arg->>'observacao'
            )
            RETURNING id INTO v_id;

            v_message := format('Limpeza de %s registrada com sucesso.', payload_arg->>'item_area');

        WHEN 'Propagacao', 'Plantio' THEN
            INSERT INTO public.pmo_propagacao (
                pmo_id, tipo, especies, origem, quantidade, sistema_organico, data_compra
            )
            VALUES (
                pmo_id_arg, COALESCE(payload_arg->>'tipo', tipo_arg), COALESCE(payload_arg->>'especies', v_produto),
                payload_arg->>'origem', COALESCE(payload_arg->>'quantidade', v_qtd_valor::TEXT || ' ' || v_qtd_unidade),
                (v_modalidade_interceptada = 'ORGANICO'), v_data_registro
            )
            RETURNING id INTO v_id;

            v_message := format('%s de %s registrada com sucesso.', COALESCE(payload_arg->>'tipo', tipo_arg), COALESCE(payload_arg->>'especies', v_produto));

        WHEN 'Manejo' THEN
            INSERT INTO public.pmo_manejo (
                pmo_id, insumo, fonte, quantidade, data_aplicacao, metodo_aplicacao, talhoes_aplicados, modalidade_aplicada
            )
            VALUES (
                pmo_id_arg, payload_arg->>'insumo', payload_arg->>'fonte', payload_arg->>'quantidade',
                v_data_registro, payload_arg->>'metodo_aplicacao', COALESCE(payload_arg->'talhoes_aplicados', '[]'::jsonb),
                v_modalidade_interceptada
            )
            RETURNING id INTO v_id;

            v_message := format('Aplicação de %s registrada com sucesso.', payload_arg->>'insumo');

        WHEN 'Compostagem' THEN
            IF payload_arg->>'acao' = 'Nova Pilha' THEN
                INSERT INTO public.pmo_compostagem (pmo_id, user_id, n_pilha, ingredientes, data_montagem, status)
                VALUES (pmo_id_arg, user_id_arg, payload_arg->>'identificador_pilha', payload_arg->>'materiais', v_data_registro, 'ativo')
                RETURNING id INTO v_id;
                v_message := format('Nova pilha %s criada.', payload_arg->>'identificador_pilha');
            ELSE
                SELECT id INTO v_pilha_id FROM public.pmo_compostagem WHERE pmo_id = pmo_id_arg AND n_pilha ILIKE payload_arg->>'identificador_pilha' LIMIT 1;
                IF v_pilha_id IS NULL THEN RAISE EXCEPTION 'Pilha % não encontrada.', payload_arg->>'identificador_pilha'; END IF;
                INSERT INTO public.pmo_compostagem_eventos (pilha_id, tipo_evento, valor_temperatura, data_evento, observacao)
                VALUES (v_pilha_id, LOWER(payload_arg->>'acao'), COALESCE((payload_arg->>'temperatura')::NUMERIC, 0), v_data_registro, payload_arg->>'observacao')
                RETURNING id INTO v_id;
                v_message := format('Evento %s registrado na pilha %s.', payload_arg->>'acao', payload_arg->>'identificador_pilha');
            END IF;

        WHEN 'Colheita' THEN
            v_lote := format('COL-%s-%s-%s', to_char(v_data_registro, 'YYYYMMDD'), UPPER(LEFT(v_produto, 3)), floor(random()*900+100)::text);
            v_message := format('Colheita de %s registrada com sucesso (Lote: %s).', v_produto, v_lote);

        WHEN 'Venda' THEN
            v_message := format('Venda/Saída de %s registrada com sucesso.', v_produto);

        ELSE
            RAISE EXCEPTION 'Tipo de operação inválido: %', tipo_arg;
    END CASE;

    -- 2. REGISTRO UNIVERSAL NO CADERNO DE CAMPO (Com idempotency_key)
    INSERT INTO public.caderno_campo (
        pmo_id, user_id, tipo_atividade, data_registro, produto, 
        quantidade_valor, quantidade_unidade, talhao_id, talhao_canteiro,
        lote, fornecedor, nota_fiscal, detalhes_tecnicos, secao_origem, observacao_original,
        modalidade_aplicada, raw_payload_id, idempotency_key
    )
    VALUES (
        pmo_id_arg, user_id_arg, tipo_arg, v_data_registro, v_produto,
        v_qtd_valor, v_qtd_unidade, v_talhao_id_res, v_talhao_nome,
        v_lote, payload_arg->>'fornecedor', payload_arg->>'nota_fiscal',
        payload_arg, 'mcp_rpc_v2_unified', 
        COALESCE(payload_arg->>'observacao_original', format('Registro de %s via Bot.', tipo_arg)),
        v_modalidade_interceptada, v_raw_payload_id, v_idempotency_key
    )
    RETURNING id INTO v_id;

    -- 3. INTEGRAÇÃO FINANCEIRA
    IF v_valor_total IS NOT NULL AND v_valor_total > 0 THEN
        IF tipo_arg = 'Venda' THEN
            v_tipo_financeiro := 'receita';
            v_nome_categoria := 'Venda de Produção';
        ELSIF tipo_arg IN ('Propagacao', 'Plantio', 'Manejo') THEN
            v_nome_categoria := 'Insumos';
        ELSIF tipo_arg = 'Colheita' THEN
            v_nome_categoria := 'Mão de Obra';
        END IF;

        SELECT id INTO v_categoria_id FROM public.categorias_financeiras WHERE nome = v_nome_categoria LIMIT 1;
        
        IF v_categoria_id IS NULL THEN
            IF v_tipo_financeiro = 'RECEITA' THEN
                SELECT id INTO v_categoria_id FROM public.categorias_financeiras WHERE nome ILIKE '%Outras Receitas%' LIMIT 1;
            ELSE
                SELECT id INTO v_categoria_id FROM public.categorias_financeiras WHERE nome ILIKE '%Outras Despesas%' LIMIT 1;
            END IF;
        END IF;

        IF v_categoria_id IS NOT NULL THEN
            v_propriedade_id := COALESCE((payload_arg->>'propriedade_id')::BIGINT, (SELECT propriedade_id FROM public.pmos WHERE id = pmo_id_arg LIMIT 1));

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
            ) VALUES (
                pmo_id_arg,
                v_propriedade_id,
                v_categoria_id,
                v_tipo_financeiro,
                v_valor_total,
                v_data_registro,
                v_data_registro,
                COALESCE(payload_arg->>'fornecedor', payload_arg->>'cliente'),
                user_id_arg,
                v_raw_payload_id,
                v_idempotency_key
            ) RETURNING id INTO v_transacao_id;

            INSERT INTO public.transacao_alocacoes (
                transacao_id,
                caderno_campo_id,
                talhao_id,
                valor_alocado,
                percentual_alocado
            ) VALUES (
                v_transacao_id,
                v_id,
                v_talhao_id_res,
                v_valor_total,
                100.00
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'status', v_status,
        'id', v_id,
        'lote', v_lote,
        'message', v_message
    );

EXCEPTION 
    WHEN unique_violation THEN
        SELECT id, lote INTO v_existing_id, v_existing_lote 
        FROM public.caderno_campo 
        WHERE idempotency_key = v_idempotency_key 
        LIMIT 1;

        RETURN jsonb_build_object(
            'status', 'already_processed',
            'id', v_existing_id,
            'lote', v_existing_lote,
            'message', 'Operação já registrada em concorrência (Constraint UNIQUE disparada).'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM
        );
END;
$func$;


-- 3. Atualização: rpc_registrar_compra_insumo com Deduplicação
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

    -- 1. Registrar no catálogo de insumos do PMO
    INSERT INTO public.pmo_insumos (
        pmo_id, 
        insumo, 
        fonte, 
        quantidade,
        data_aplicacao
    )
    VALUES (
        pmo_id_arg, 
        produto_arg, 
        fornecedor_arg, 
        quantidade_valor_arg::text || ' ' || quantidade_unidade_arg,
        data_compra_arg
    )
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


-- 4. Atualização: rpc_registrar_transacao_com_rateio com Deduplicação
CREATE OR REPLACE FUNCTION public.rpc_registrar_transacao_com_rateio(
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transacao_id UUID;
    v_propriedade_id BIGINT;
    v_categoria_id UUID;
    v_tipo TEXT;
    v_valor_total NUMERIC;
    v_fornecedor_cliente TEXT;
    v_user_id UUID;
    v_pmo_id BIGINT;
    v_alocacao JSONB;
    v_data_competencia DATE;
    v_idempotency_key TEXT;
    v_existing_id UUID;
BEGIN
    IF p_payload IS NULL THEN
        RAISE EXCEPTION 'Payload JSONB não fornecido.';
    END IF;

    v_idempotency_key := COALESCE(p_payload->>'idempotency_key', p_payload->>'idempotency_key_arg');

    -- 0. Checagem de Idempotência Pré-Insert
    IF v_idempotency_key IS NOT NULL AND v_idempotency_key <> '' THEN
        SELECT id INTO v_existing_id 
        FROM public.transacoes_financeiras 
        WHERE idempotency_key = v_idempotency_key 
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'already_processed',
                'transacao_id', v_existing_id,
                'message', 'Transação financeira já registrada anteriormente (Deduplicação de Idempotência).'
            );
        END IF;
    END IF;

    -- Extração de campos básicos
    v_propriedade_id := (p_payload->>'propriedade_id')::BIGINT;
    v_categoria_id := (p_payload->>'categoria_id')::UUID;
    v_tipo := LOWER(p_payload->>'tipo');
    v_valor_total := (p_payload->>'valor_total')::NUMERIC;
    v_fornecedor_cliente := p_payload->>'fornecedor_cliente';
    v_user_id := (p_payload->>'user_id')::UUID;
    v_pmo_id := (p_payload->>'pmo_id')::BIGINT;
    v_data_competencia := COALESCE((p_payload->>'data_competencia')::DATE, CURRENT_DATE);

    IF v_propriedade_id IS NULL OR v_valor_total IS NULL OR v_tipo IS NULL THEN
        RAISE EXCEPTION 'Os campos propriedade_id, tipo e valor_total são obrigatórios.';
    END IF;

    -- 2. Inserção atômica na tabela de transações
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
        idempotency_key
    ) VALUES (
        v_pmo_id,
        v_propriedade_id,
        v_categoria_id,
        v_tipo,
        v_valor_total,
        v_data_competencia,
        CURRENT_DATE,
        v_fornecedor_cliente,
        v_user_id,
        v_idempotency_key
    )
    RETURNING id INTO v_transacao_id;

    -- 3. Inserção de Rateios (Alocações)
    IF p_payload ? 'alocacoes' AND jsonb_typeof(p_payload->'alocacoes') = 'array' THEN
        FOR v_alocacao IN SELECT * FROM jsonb_array_elements(p_payload->'alocacoes')
        LOOP
            INSERT INTO public.transacao_alocacoes (
                transacao_id,
                talhao_id,
                valor_alocado
            ) VALUES (
                v_transacao_id,
                (v_alocacao->>'talhao_id')::BIGINT,
                (v_alocacao->>'valor_alocado')::NUMERIC
            );
        END LOOP;
    ELSE
        INSERT INTO public.transacao_alocacoes (
            transacao_id,
            valor_alocado,
            percentual_alocado
        ) VALUES (
            v_transacao_id,
            v_valor_total,
            100.00
        );
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'transacao_id', v_transacao_id,
        'message', format('Transação financeira registrada com sucesso. ID: %s', v_transacao_id)
    );

EXCEPTION 
    WHEN unique_violation THEN
        SELECT id INTO v_existing_id 
        FROM public.transacoes_financeiras 
        WHERE idempotency_key = v_idempotency_key 
        LIMIT 1;

        RETURN jsonb_build_object(
            'status', 'already_processed',
            'transacao_id', v_existing_id,
            'message', 'Transação financeira já registrada em concorrência (Constraint UNIQUE disparada).'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;


-- 5. Atualização: rpc_registrar_cota_produtor com Deduplicação
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

    -- 1. Inserção na tabela cotas_produtores
    INSERT INTO public.cotas_produtores (
        demanda_id,
        propriedade_id,
        usuario_id,
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

    -- 2. Inserção no cronograma_plantio se data informada
    IF p_data_plantio IS NOT NULL THEN
        INSERT INTO public.cronograma_plantio (
            cota_id,
            data_plantio,
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


