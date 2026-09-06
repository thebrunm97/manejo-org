-- ============================================================
-- MIGRATION: Rollback da Idempotência nas Tabelas de Mutação e RPCs
-- File: supabase/migrations/20260816000001_rollback_idempotency_to_mutations.sql
-- Description: Reverte a migração 20260816000000_add_idempotency_to_mutations.sql
--              removendo índices, colunas e restaurando assinaturas prévias.
-- ============================================================

BEGIN;

-- 1. Remoção dos índices UNIQUE de idempotência
DROP INDEX IF EXISTS public.idx_caderno_campo_idempotency_key;
DROP INDEX IF EXISTS public.idx_transacoes_financeiras_idempotency_key;
DROP INDEX IF EXISTS public.idx_cotas_produtores_idempotency_key;

-- 2. Remoção das colunas adicionadas
ALTER TABLE public.caderno_campo 
DROP COLUMN IF EXISTS idempotency_key;

ALTER TABLE public.transacoes_financeiras 
DROP COLUMN IF EXISTS idempotency_key;

ALTER TABLE public.cotas_produtores 
DROP COLUMN IF EXISTS idempotency_key;

-- 3. Restauração das RPCs anteriores (sem checagem de idempotency_key)
CREATE OR REPLACE FUNCTION public.rpc_registrar_operacao_campo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    tipo_arg TEXT,
    payload_arg JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
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
    
    v_valor_total NUMERIC := (payload_arg->>'valor_total')::NUMERIC;
    v_transacao_id UUID;
    v_categoria_id UUID;
    v_tipo_financeiro TEXT := 'DESPESA';
    v_nome_categoria TEXT := 'Outros';
    v_propriedade_id BIGINT;
    v_raw_payload_id UUID := (payload_arg->>'raw_payload_id')::UUID;
BEGIN
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

COMMIT;
