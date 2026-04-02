-- Migration: Multi-modalidade e Produção Paralela
-- Criação de enums, relacionamentos de propriedade_id e refatoração de RPCs Zero-Trust

-- 1. Criação do Domínio/Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modalidade_producao_enum') THEN
        CREATE TYPE public.modalidade_producao_enum AS ENUM ('ORGANICO', 'CONVENCIONAL', 'TRANSICAO');
    END IF;
END
$$;

-- 2. Alteração na tabela Propriedades
ALTER TABLE public.propriedades 
    ADD COLUMN IF NOT EXISTS tem_producao_paralela BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS modalidade_predominante public.modalidade_producao_enum DEFAULT 'ORGANICO';

-- 3. Alteração na tabela Talhões (Desacoplamento de PMO)
ALTER TABLE public.talhoes 
    ADD COLUMN IF NOT EXISTS propriedade_id BIGINT REFERENCES public.propriedades(id),
    ADD COLUMN IF NOT EXISTS modalidade_producao public.modalidade_producao_enum DEFAULT 'ORGANICO';

ALTER TABLE public.talhoes ALTER COLUMN pmo_id DROP NOT NULL;

-- 4. Rastros de Modalidade Aplicada nos Logs Operacionais
ALTER TABLE public.pmo_manejo ADD COLUMN IF NOT EXISTS modalidade_aplicada public.modalidade_producao_enum DEFAULT 'ORGANICO';
ALTER TABLE public.caderno_campo ADD COLUMN IF NOT EXISTS modalidade_aplicada public.modalidade_producao_enum DEFAULT 'ORGANICO';

-- 5. Refatoração da RPC: rpc_registrar_operacao_campo (v3 Zero-Trust)
CREATE OR REPLACE FUNCTION public.rpc_registrar_operacao_campo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    tipo_arg TEXT,
    payload_arg JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
    -- 0. Resolver Talhão ID se fornecido por nome e interceptar a modalidade server-side
    IF v_talhao_nome IS NOT NULL AND v_talhao_nome <> '' THEN
        -- Tenta pelo PMO (legacy) ou livre
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

    -- REGISTRO UNIVERSAL NO CADERNO DE CAMPO (Seção 11) com rastreamento da modalidade do polígono
    INSERT INTO public.caderno_campo (
        pmo_id, user_id, tipo_atividade, data_registro, produto, 
        quantidade_valor, quantidade_unidade, talhao_id, talhao_canteiro,
        lote, fornecedor, nota_fiscal, detalhes_tecnicos, secao_origem, observacao_original,
        modalidade_aplicada
    )
    VALUES (
        pmo_id_arg, user_id_arg, tipo_arg, v_data_registro, v_produto,
        v_qtd_valor, v_qtd_unidade, v_talhao_id_res, v_talhao_nome,
        v_lote, payload_arg->>'fornecedor', payload_arg->>'nota_fiscal',
        payload_arg, 'mcp_rpc_v2_unified', 
        COALESCE(payload_arg->>'observacao_original', format('Registro de %s via Bot.', tipo_arg)),
        v_modalidade_interceptada
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

-- 6. Refatoração da RPC: rpc_registrar_compra_insumo (Zero-Trust)
CREATE OR REPLACE FUNCTION public.rpc_registrar_compra_insumo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    produto_arg TEXT,
    quantidade_valor_arg NUMERIC,
    quantidade_unidade_arg TEXT,
    fornecedor_arg TEXT DEFAULT NULL,
    data_compra_arg DATE DEFAULT CURRENT_DATE,
    nota_fiscal_arg TEXT DEFAULT NULL,
    marca_arg TEXT DEFAULT NULL,
    composicao_arg TEXT DEFAULT NULL,
    procedencia_arg TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_insumo_id UUID;
    v_compra_id UUID;
    v_detalhes JSONB;
    v_modalidade_interceptada public.modalidade_producao_enum := 'ORGANICO';
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

    -- 3. Registrar a compra no caderno de campo, carimbando ORGANICO default caso seja global
    INSERT INTO public.caderno_campo (
        pmo_id,
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
        modalidade_aplicada
    )
    VALUES (
        pmo_id_arg,
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
        v_modalidade_interceptada
    )
    RETURNING id INTO v_compra_id;

    -- Opcional: registrar na tabela compras se existente (legacy support)
    -- Inserir log dummy caso tabela legacy esteja ativa
    -- INSERT INTO public.compras ...

    -- 4. Retornar IDs
    RETURN jsonb_build_object(
        'status', 'success',
        'insumo_id', v_insumo_id,
        'compra_id', v_compra_id,
        'message', format('Insumo %s garantido no catálogo e compra registrada com sucesso.', produto_arg)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$func$;
