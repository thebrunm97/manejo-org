-- ============================================================
-- MIGRATION: Vinculação de raw_payload_id nas RPCs do Sistema
-- File: supabase/migrations/20260609002200_add_raw_payload_to_rpcs.sql
-- Description: Atualiza rpc_registrar_operacao_campo e rpc_registrar_compra_insumo
--              para receber o raw_payload_id e propagá-lo para cuaderno_campo e transacoes_financeiras.
-- ============================================================

BEGIN;

-- 1. Atualização: rpc_registrar_operacao_campo
CREATE OR REPLACE FUNCTION public.rpc_registrar_operacao_campo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    tipo_arg TEXT,
    payload_arg JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER -- Garante respeito rigoroso às políticas RLS
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
    v_tipo_financeiro TEXT := 'DESPESA';
    v_nome_categoria TEXT := 'Outros';
    v_propriedade_id BIGINT;
    
    -- Rastreabilidade / Audit Trail
    v_raw_payload_id UUID := (payload_arg->>'raw_payload_id')::UUID;
BEGIN
    -- 0. Resolver Talhão ID se fornecido por nome e interceptar a modalidade server-side
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

    -- REGISTRO UNIVERSAL NO CADERNO DE CAMPO (Modificado para incluir raw_payload_id)
    INSERT INTO public.caderno_campo (
        pmo_id, user_id, tipo_atividade, data_registro, produto, 
        quantidade_valor, quantidade_unidade, talhao_id, talhao_canteiro,
        lote, fornecedor, nota_fiscal, detalhes_tecnicos, secao_origem, observacao_original,
        modalidade_aplicada, raw_payload_id
    )
    VALUES (
        pmo_id_arg, user_id_arg, tipo_arg, v_data_registro, v_produto,
        v_qtd_valor, v_qtd_unidade, v_talhao_id_res, v_talhao_nome,
        v_lote, payload_arg->>'fornecedor', payload_arg->>'nota_fiscal',
        payload_arg, 'mcp_rpc_v2_unified', 
        COALESCE(payload_arg->>'observacao_original', format('Registro de %s via Bot.', tipo_arg)),
        v_modalidade_interceptada, v_raw_payload_id
    )
    RETURNING id INTO v_id;

    -- INTEGRAÇÃO FINANCEIRA: Inserção Atômica (Modificado para incluir raw_payload_id)
    IF v_valor_total IS NOT NULL AND v_valor_total > 0 THEN
        IF tipo_arg = 'Venda' THEN
            v_tipo_financeiro := 'RECEITA';
            v_nome_categoria := 'Venda de Produção';
        ELSIF tipo_arg IN ('Propagacao', 'Plantio', 'Manejo') THEN
            v_nome_categoria := 'Insumos';
        ELSIF tipo_arg = 'Colheita' THEN
            v_nome_categoria := 'Mão de Obra';
        END IF;

        -- Fallback: garante que a categoria seja encontrada
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
                raw_payload_id
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
                v_raw_payload_id
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

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$func$;


-- 2. Atualização: rpc_registrar_compra_insumo
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
    raw_payload_id_arg uuid DEFAULT NULL -- Novo parâmetro para Audit Trail
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
    
    -- Variáveis de controle de rateio e cêntimos
    v_total_alocado_calc NUMERIC := 0;
    v_valor_alocado NUMERIC;
    v_index INT := 0;
    v_array_length INT := 0;
BEGIN
    -- 1. Garantir que o insumo existe no catálogo (Seção 8)
    INSERT INTO public.pmo_insumos (
        pmo_id, 
        produto_manejo, 
        marca, 
        composicao, 
        procedencia
    )
    VALUES (
        pmo_id_arg, 
        produto_arg, 
        marca_arg, 
        composicao_arg, 
        procedencia_arg
    )
    ON CONFLICT (pmo_id, produto_manejo) 
    DO UPDATE SET
        marca = COALESCE(EXCLUDED.marca, pmo_insumos.marca),
        composicao = COALESCE(EXCLUDED.composicao, pmo_insumos.composicao),
        procedencia = COALESCE(EXCLUDED.procedencia, pmo_insumos.procedencia)
    RETURNING id INTO v_insumo_id;

    -- 2. Montar detalhes técnicos extras para o caderno de campo
    v_detalhes := jsonb_build_object(
        'insumo_id', v_insumo_id,
        'nota_fiscal', nota_fiscal_arg,
        'marca', marca_arg,
        'composicao', composicao_arg
    );

    -- 3. Registrar a compra no caderno de campo (Modificado para incluir raw_payload_id)
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
        modalidade_aplicada,
        raw_payload_id
    )
    VALUES (
        pmo_id_arg,
        propriedade_id_arg,
        user_id_arg,
        'Compra', 
        data_compra_arg,
        produto_arg,
        quantidade_valor_arg,
        quantidade_unidade_arg,
        fornecedor_arg,
        nota_fiscal_arg,
        v_detalhes,
        'mcp_rpc_v2',
        format('Compra de %s %s de %s registrada via bot.', quantidade_valor_arg, quantidade_unidade_arg, produto_arg),
        v_modalidade_interceptada,
        raw_payload_id_arg
    )
    RETURNING id INTO v_compra_id;

    -- Validação de Segurança (Anti-Silent Failure)
    IF v_compra_id IS NULL THEN
        RAISE EXCEPTION 'Erro crítico: O ID da compra não foi gerado.';
    END IF;

    -- 4. Registro no Ledger Financeiro se houver valor monetário
    IF valor_total_arg > 0 THEN
        -- Resolvendo a categoria financeira
        IF categoria_nome_arg IS NOT NULL AND categoria_nome_arg <> '' THEN
            SELECT id INTO v_categoria_id FROM public.categorias_financeiras 
            WHERE nome ILIKE categoria_nome_arg LIMIT 1;
        END IF;

        IF v_categoria_id IS NULL THEN
            SELECT id INTO v_categoria_id FROM public.categorias_financeiras 
            WHERE nome ILIKE 'Insumos' LIMIT 1;
        END IF;

        IF v_categoria_id IS NULL THEN
            SELECT id INTO v_categoria_id FROM public.categorias_financeiras 
            WHERE tipo = 'DESPESA' LIMIT 1;
        END IF;

        -- Inserção na tabela fato de transações (Modificado para incluir raw_payload_id)
        INSERT INTO public.transacoes_financeiras (
            pmo_id,
            propriedade_id,
            categoria_id,
            tipo,
            valor_total,
            data_competencia,
            data_transacao,
            fornecedor,
            fornecedor_cliente,
            nota_fiscal,
            user_id,
            raw_payload_id
        ) VALUES (
            pmo_id_arg,
            propriedade_id_arg,
            v_categoria_id,
            'DESPESA',
            valor_total_arg,
            data_compra_arg,
            data_compra_arg,
            fornecedor_arg,
            fornecedor_arg,
            nota_fiscal_arg,
            user_id_arg,
            raw_payload_id_arg
        )
        RETURNING id INTO v_transacao_id;

        -- 5. Inserção de Rateios (Alocações)
        IF alocacoes_talhoes_arg IS NOT NULL AND jsonb_typeof(alocacoes_talhoes_arg) = 'array' AND jsonb_array_length(alocacoes_talhoes_arg) > 0 THEN
            v_array_length := jsonb_array_length(alocacoes_talhoes_arg);
            
            FOR v_alocacao IN SELECT * FROM jsonb_array_elements(alocacoes_talhoes_arg)
            LOOP
                v_index := v_index + 1;
                
                -- Resolver id do talhão pelo nome de forma flexível
                SELECT id INTO v_talhao_id FROM public.talhoes 
                WHERE (nome = (v_alocacao->>'talhao_nome') OR nome ILIKE (v_alocacao->>'talhao_nome'))
                  AND propriedade_id = propriedade_id_arg 
                LIMIT 1;

                -- Obter e converter o valor alocado
                v_valor_alocado := (v_alocacao->>'valor_alocado')::NUMERIC;

                -- Tratamento de cêntimos
                IF v_index = v_array_length THEN
                    v_valor_alocado := valor_total_arg - v_total_alocado_calc;
                ELSE
                    v_total_alocado_calc := v_total_alocado_calc + v_valor_alocado;
                END IF;

                INSERT INTO public.transacao_alocacoes (
                    transacao_id,
                    talhao_id,
                    caderno_campo_id,
                    valor_alocado,
                    percentual_alocado
                ) VALUES (
                    v_transacao_id,
                    v_talhao_id,
                    v_compra_id,
                    v_valor_alocado,
                    CASE WHEN valor_total_arg > 0 THEN (v_valor_alocado / valor_total_arg) * 100 ELSE 0 END
                );
            END LOOP;
        ELSE
            -- Fallback: Alocação global 100% da transação
            INSERT INTO public.transacao_alocacoes (
                transacao_id,
                caderno_campo_id,
                valor_alocado,
                percentual_alocado
            ) VALUES (
                v_transacao_id,
                v_compra_id,
                valor_total_arg,
                100.00
            );
        END IF;
    END IF;

    -- 6. Retornar resposta de sucesso
    RETURN jsonb_build_object(
        'status', 'success',
        'insumo_id', v_insumo_id,
        'compra_id', v_compra_id,
        'transacao_id', v_transacao_id,
        'message', format('Insumo %s garantido no catálogo e compra registrada com sucesso.', produto_arg)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM,
        'code', SQLSTATE
    );
END;
$function$;

COMMIT;
