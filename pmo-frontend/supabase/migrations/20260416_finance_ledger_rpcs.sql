-- 20260416_finance_ledger_rpcs.sql
-- Function: rpc_registrar_transacao_com_rateio
-- Descrição: Registra uma transação financeira e suas alocações (rateio) de forma atômica.
--           Garante que a soma das alocações bata com o valor total.

CREATE OR REPLACE FUNCTION public.rpc_registrar_transacao_com_rateio(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_propriedade_id bigint;
    v_categoria_id uuid;
    v_tipo text;
    v_valor_total numeric(12,2);
    v_fornecedor_cliente text;
    v_user_id uuid;
    v_alocacoes jsonb;
    v_transacao_id uuid;
    v_soma_alocacoes numeric(12,2) := 0;
    v_alocacao record;
    v_count int := 0;
BEGIN
    -- 1. Extração de Parâmetros
    v_propriedade_id := (payload->>'propriedade_id')::bigint;
    v_categoria_id := (payload->>'categoria_id')::uuid;
    v_tipo := payload->>'tipo';
    v_valor_total := (payload->>'valor_total')::numeric(12,2);
    v_fornecedor_cliente := payload->>'fornecedor_cliente';
    v_user_id := (payload->>'user_id')::uuid;
    v_alocacoes := payload->'alocacoes';

    -- 2. Validação Matemática (Obrigatória se houver alocações)
    IF v_alocacoes IS NOT NULL AND jsonb_array_length(v_alocacoes) > 0 THEN
        SELECT SUM((val->>'valor_alocado')::numeric(12,2))
        INTO v_soma_alocacoes
        FROM jsonb_array_elements(v_alocacoes) AS val;

        -- Comparação com margem de 1 centavo para arredondamentos
        IF ABS(v_soma_alocacoes - v_valor_total) > 0.01 THEN
            RAISE EXCEPTION 'Erro de Integridade Financeira: A soma das alocações (R$ %) não corresponde ao valor total da transação (R$ %).', 
                v_soma_alocacoes, v_valor_total;
        END IF;
    END IF;

    -- 3. Inserção da Transação Pai
    INSERT INTO public.transacoes_financeiras (
        propriedade_id,
        categoria_id,
        tipo,
        valor_total,
        fornecedor_cliente,
        user_id,
        status_pagamento
    ) VALUES (
        v_propriedade_id,
        v_categoria_id,
        v_tipo,
        v_valor_total,
        v_fornecedor_cliente,
        v_user_id,
        'PAGO'
    ) RETURNING id INTO v_transacao_id;

    -- 4. Inserção das Alocações (Loop)
    IF v_alocacoes IS NOT NULL AND jsonb_array_length(v_alocacoes) > 0 THEN
        FOR v_alocacao IN SELECT * FROM jsonb_to_recordset(v_alocacoes) AS x(talhao_id bigint, valor_alocado numeric(12,2))
        LOOP
            INSERT INTO public.transacao_alocacoes (
                transacao_id,
                talhao_id,
                valor_alocado
            ) VALUES (
                v_transacao_id,
                v_alocacao.talhao_id,
                v_alocacao.valor_alocado
            );
            v_count := v_count + 1;
        END LOOP;
    ELSE
        -- Caso não haja alocações por talhão, cria uma alocação "Geral" (talhao_id NULL)
        INSERT INTO public.transacao_alocacoes (
            transacao_id,
            talhao_id,
            valor_alocado
        ) VALUES (
            v_transacao_id,
            NULL,
            v_valor_total
        );
        v_count := 1;
    END IF;

    -- 5. Retorno de Sucesso
    RETURN jsonb_build_object(
        'success', true,
        'transacao_id', v_transacao_id,
        'alocacoes_count', v_count,
        'mensagem', 'Transação registrada com sucesso.'
    );

EXCEPTION WHEN OTHERS THEN
    -- O Postgres fará ROLLBACK automático de toda a transação se houver erro
    RAISE;
END;
$$;

-- Grant permissões para o service_role chamar a função
GRANT EXECUTE ON FUNCTION public.rpc_registrar_transacao_com_rateio(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_transacao_com_rateio(jsonb) TO authenticated;
