-- Migração: rpc_registrar_operacao_campo
-- Unifica registros de Limpeza, Propagação, Manejo e Compostagem

CREATE OR REPLACE FUNCTION public.rpc_registrar_operacao_campo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    tipo_arg TEXT, -- 'Limpeza', 'Propagacao', 'Manejo', 'Compostagem'
    payload_arg JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_pilha_id UUID;
    v_status TEXT := 'success';
    v_message TEXT;
    v_data_registro DATE := COALESCE((payload_arg->>'data')::DATE, CURRENT_DATE);
BEGIN

    CASE tipo_arg
        WHEN 'Limpeza' THEN
            INSERT INTO public.pmo_limpeza (
                pmo_id, 
                data_limpeza, 
                item_area, 
                tipo_limpeza, 
                produto_utilizado, 
                dosagem, 
                responsavel,
                observacao
            )
            VALUES (
                pmo_id_arg,
                v_data_registro,
                payload_arg->>'item_area',
                payload_arg->>'tipo_limpeza',
                payload_arg->>'produto_utilizado',
                payload_arg->>'dosagem',
                COALESCE(payload_arg->>'responsavel', 'Produtor'),
                payload_arg->>'observacao'
            )
            RETURNING id INTO v_id;

            INSERT INTO public.caderno_campo (
                pmo_id, user_id, tipo_atividade, data_registro, 
                produto, secao_origem, observacao_original, detalhes_tecnicos
            )
            VALUES (
                pmo_id_arg, user_id_arg, 'Limpeza', v_data_registro,
                payload_arg->>'item_area', 'mcp_rpc_v3',
                format('Limpeza de %s (%s) registrada via bot.', payload_arg->>'item_area', payload_arg->>'tipo_limpeza'),
                payload_arg
            );

        WHEN 'Propagacao' THEN
            INSERT INTO public.pmo_propagacao (
                pmo_id, tipo, especies, origem, quantidade, sistema_organico, data_compra
            )
            VALUES (
                pmo_id_arg,
                payload_arg->>'tipo',
                payload_arg->>'especies',
                payload_arg->>'origem',
                payload_arg->>'quantidade',
                COALESCE((payload_arg->>'sistema_organico')::BOOLEAN, true),
                v_data_registro
            )
            RETURNING id INTO v_id;

            INSERT INTO public.caderno_campo (
                pmo_id, user_id, tipo_atividade, data_registro, 
                produto, secao_origem, observacao_original, detalhes_tecnicos, quantidade_valor
            )
            VALUES (
                pmo_id_arg, user_id_arg, 'Propagacao', v_data_registro,
                payload_arg->>'especies', 'mcp_rpc_v3',
                format('Material de propagação %s (%s) registrado via bot.', payload_arg->>'especies', payload_arg->>'tipo'),
                payload_arg,
                NULL -- quantidade é texto na pmo_propagacao, tratamos aqui
            );

        WHEN 'Manejo' THEN
             INSERT INTO public.pmo_manejo (
                pmo_id, insumo, fonte, quantidade, data_aplicacao, metodo_aplicacao, talhoes_aplicados
            )
            VALUES (
                pmo_id_arg,
                payload_arg->>'insumo',
                payload_arg->>'fonte',
                payload_arg->>'quantidade',
                v_data_registro,
                payload_arg->>'metodo_aplicacao',
                COALESCE(payload_arg->'talhoes_aplicados', '[]'::jsonb)
            )
            RETURNING id INTO v_id;

            INSERT INTO public.caderno_campo (
                pmo_id, user_id, tipo_atividade, data_registro, 
                produto, secao_origem, observacao_original, detalhes_tecnicos
            )
            VALUES (
                pmo_id_arg, user_id_arg, 'Manejo', v_data_registro,
                payload_arg->>'insumo', 'mcp_rpc_v3',
                format('Aplicação de %s registrada via bot.', payload_arg->>'insumo'),
                payload_arg
            );

        WHEN 'Compostagem' THEN
            IF payload_arg->>'acao' = 'Nova Pilha' THEN
                INSERT INTO public.pmo_compostagem (
                    pmo_id, user_id, n_pilha, ingredientes, data_montagem, status
                )
                VALUES (
                    pmo_id_arg, user_id_arg, 
                    payload_arg->>'identificador_pilha', 
                    payload_arg->>'materiais', 
                    v_data_registro, 'ativo'
                )
                RETURNING id INTO v_id;

                v_message := format('Nova pilha %s criada.', payload_arg->>'identificador_pilha');
            ELSE
                -- Lookup Pilha ID by Name/Number
                SELECT id INTO v_pilha_id 
                FROM public.pmo_compostagem 
                WHERE pmo_id = pmo_id_arg 
                  AND n_pilha ILIKE payload_arg->>'identificador_pilha'
                LIMIT 1;

                IF v_pilha_id IS NULL THEN
                    RAISE EXCEPTION 'Pilha % não encontrada para o PMO %', payload_arg->>'identificador_pilha', pmo_id_arg;
                END IF;

                INSERT INTO public.pmo_compostagem_eventos (
                    pilha_id, tipo_evento, valor_temperatura, data_evento, observacao
                )
                VALUES (
                    v_pilha_id,
                    LOWER(payload_arg->>'acao'),
                    COALESCE((payload_arg->>'temperatura')::NUMERIC, 0),
                    v_data_registro,
                    payload_arg->>'observacao'
                )
                RETURNING id INTO v_id;

                v_message := format('Evento %s registrado na pilha %s.', payload_arg->>'acao', payload_arg->>'identificador_pilha');
            END IF;

            INSERT INTO public.caderno_campo (
                pmo_id, user_id, tipo_atividade, data_registro, 
                produto, secao_origem, observacao_original, detalhes_tecnicos
            )
            VALUES (
                pmo_id_arg, user_id_arg, 'Compostagem', v_data_registro,
                payload_arg->>'identificador_pilha', 'mcp_rpc_v3',
                format('Compostagem: %s na pilha %s.', payload_arg->>'acao', payload_arg->>'identificador_pilha'),
                payload_arg
            );

        ELSE
            RAISE EXCEPTION 'Tipo de operação inválido: %', tipo_arg;
    END CASE;

    RETURN jsonb_build_object(
        'status', v_status,
        'id', v_id,
        'message', COALESCE(v_message, format('%s registrado com sucesso.', tipo_arg))
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$;
