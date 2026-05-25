-- ============================================================
-- MIGRATION: Nova RPC de Registro Financeiro (Fase 2)
-- File: supabase/migrations/20260526_create_financeiro_transactions_rpc.sql
-- Description: Cria a RPC que registra transações financeiras puras com suporte a rateio por talhões.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_registrar_transacao_com_rateio(
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER -- Garante que as políticas RLS sejam aplicadas baseadas no usuário logado (auth.uid())
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
BEGIN
    -- 1. Validação inicial do payload JSONB
    IF p_payload IS NULL THEN
        RAISE EXCEPTION 'Payload JSONB não fornecido.';
    END IF;

    -- Extração de campos básicos
    v_propriedade_id := (p_payload->>'propriedade_id')::BIGINT;
    v_categoria_id := (p_payload->>'categoria_id')::UUID;
    v_tipo := p_payload->>'tipo';
    v_valor_total := (p_payload->>'valor_total')::NUMERIC;
    v_fornecedor_cliente := p_payload->>'fornecedor_cliente';
    v_user_id := (p_payload->>'user_id')::UUID;
    v_pmo_id := (p_payload->>'pmo_id')::BIGINT;
    v_data_competencia := COALESCE((p_payload->>'data_competencia')::DATE, CURRENT_DATE);

    IF v_propriedade_id IS NULL OR v_valor_total IS NULL OR v_tipo IS NULL THEN
        RAISE EXCEPTION 'Os campos propriedade_id, tipo e valor_total são obrigatórios.';
    END IF;

    -- 2. Inserção atômica na tabela fato de transações
    INSERT INTO public.transacoes_financeiras (
        pmo_id,
        propriedade_id,
        categoria_id,
        tipo,
        valor_total,
        data_competencia,
        data_transacao,
        fornecedor_cliente,
        user_id
    ) VALUES (
        v_pmo_id,
        v_propriedade_id,
        v_categoria_id,
        v_tipo,
        v_valor_total,
        v_data_competencia,
        CURRENT_DATE,
        v_fornecedor_cliente,
        v_user_id
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
        -- Fallback: Alocação global 100% da transação (sem talhão vinculado)
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

    -- 4. Retornar resposta de sucesso em JSONB
    RETURN jsonb_build_object(
        'status', 'success',
        'transacao_id', v_transacao_id,
        'message', format('Transação financeira registrada com sucesso. ID: %s', v_transacao_id)
    );

EXCEPTION WHEN OTHERS THEN
    -- Rollback automático ocorre em blocos transacionais (Postgres default failure)
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;
