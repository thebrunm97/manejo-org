-- MIGRATION: Registro de Compra com Rateio Ledger (Fase 2)
-- File: supabase/migrations/20260607_fase2_ledger_rateio.sql
-- Description: Atualiza a RPC rpc_registrar_compra_insumo para suportar rateio de custos e categorias dinâmicas.

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
    categoria_nome_arg text DEFAULT NULL
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

    -- 3. Registrar a compra no caderno de campo
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
        modalidade_aplicada
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
        v_modalidade_interceptada
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

        -- Inserção na tabela fato de transações (CORRIGIDO: totalizando 11 colunas e 11 expressões)
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
            user_id
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
            user_id_arg
        )
        RETURNING id INTO v_transacao_id;

        -- 5. Inserção de Rateios (Alocações)
        IF alocacoes_talhoes_arg IS NOT NULL AND jsonb_typeof(alocacoes_talhoes_arg) = 'array' AND jsonb_array_length(alocacoes_talhoes_arg) > 0 THEN
            v_array_length := jsonb_array_length(alocacoes_talhoes_arg);
            
            FOR v_alocacao IN SELECT * FROM jsonb_array_elements(alocacoes_talhoes_arg)
            LOOP
                v_index := v_index + 1;
                
                -- Resolver id do talhão pelo nome de forma flexível (exato ou ILIKE)
                SELECT id INTO v_talhao_id FROM public.talhoes 
                WHERE (nome = (v_alocacao->>'talhao_nome') OR nome ILIKE (v_alocacao->>'talhao_nome'))
                  AND propriedade_id = propriedade_id_arg 
                LIMIT 1;

                -- Obter e converter o valor alocado
                v_valor_alocado := (v_alocacao->>'valor_alocado')::NUMERIC;

                -- Tratamento de cêntimos: o último item absorve a diferença de arredondamento
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
                    v_talhao_id, -- Pode ser nulo (Global) se não encontrado
                    v_compra_id,
                    v_valor_alocado,
                    CASE WHEN valor_total_arg > 0 THEN (v_valor_alocado / valor_total_arg) * 100 ELSE 0 END
                );
            END LOOP;
        ELSE
            -- Fallback: Alocação global 100% da transação (sem talhão vinculado)
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
