-- Migration: DT-65 — fecha IDOR nas RPCs "*_arg" (geracao caller-trusted)
-- Contexto: essas SECURITY DEFINER aceitavam pmo_id_arg/user_id_arg do
-- chamador sem checar posse, e nunca receberam REVOKE EXECUTE — continuavam
-- com EXECUTE aberto para anon/authenticated/PUBLIC nos dois ambientes
-- (confirmado ao vivo via has_function_privilege antes desta migration).
-- Ver ADR-010 e DT-65 em pmo-bot-go/docs/debitos_tecnicos.md.

-- ============================================================
-- GRUPO 1 — RPCs cujo unico chamador real e o bot (service_role).
-- Sem chamador no frontend (confirmado via grep em pmo-frontend/src).
-- Mesmo padrao ja usado em create_basic_profile
-- (20260824130000_create_basic_profile_rpc.sql:31-32).
-- ============================================================

REVOKE ALL ON FUNCTION public.registrar_atividade_pmo(
    bigint, uuid, text, date, text, numeric, text, text, text[], text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_atividade_pmo(
    bigint, uuid, text, date, text, numeric, text, text, text[], text, text, text, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_registrar_compra_insumo(
    bigint, bigint, uuid, text, numeric, text, text, date, text, text, text, text, numeric, jsonb, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_compra_insumo(
    bigint, bigint, uuid, text, numeric, text, text, date, text, text, text, text, numeric, jsonb, text, uuid, text
) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_registrar_operacao_campo(
    bigint, uuid, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_operacao_campo(
    bigint, uuid, text, jsonb
) TO service_role;

-- ============================================================
-- GRUPO 2 — orfas: sem chamador vivo no bot nem no frontend
-- (confirmado via grep; so aparecem em CHANGELOG.md, docs/state.md e nos
-- tipos TS gerados). Bloqueadas sem GRANT a ninguem ate uma decisao
-- separada (resgatar no padrao do Grupo 1, ou remover como o DT-47 fez
-- com outras orfas). Ver DT-46(c).
-- ============================================================

REVOKE ALL ON FUNCTION public.criar_infraestrutura_pmo(
    bigint, uuid, text, numeric, jsonb, bigint
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.criar_infraestrutura_pmo(
    bigint, uuid, text, numeric, jsonb, bigint, bigint
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.criar_infraestrutura_pmo(
    bigint, uuid, bigint, text, numeric, jsonb
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.rpc_registrar_cota_produtor(
    uuid, bigint, uuid, numeric, date, text, text
) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- GRUPO 3 — rpc_registrar_transacao_com_rateio: unica com dois
-- chamadores reais (bot via service_role E frontend via sessao do
-- proprio usuario, financeiroService.ts:87-91). Nao pode so perder
-- EXECUTE de authenticated — precisa passar a verificar posse quando
-- ha sessao de usuario. Corpo identico ao anterior
-- (20260816000000_add_idempotency_to_mutations.sql:558-693), so com o
-- bloco de autorizacao novo logo apos a checagem de idempotencia.
-- ============================================================

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
    v_caller_role TEXT := auth.jwt() ->> 'role';
    v_caller_uid UUID := auth.uid();
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
    v_pmo_id := (p_payload->>'pmo_id')::BIGINT;
    v_data_competencia := COALESCE((p_payload->>'data_competencia')::DATE, CURRENT_DATE);

    IF v_propriedade_id IS NULL OR v_valor_total IS NULL OR v_tipo IS NULL THEN
        RAISE EXCEPTION 'Os campos propriedade_id, tipo e valor_total são obrigatórios.';
    END IF;

    -- DT-65: quem pode escrever "em nome de quem". service_role (o bot) e o
    -- unico chamador confiado a passar user_id/pmo_id crus no payload — e
    -- so ele tem EXECUTE fora de 'authenticated' apos esta migration. Uma
    -- sessao de usuario real (frontend) tem seu proprio user_id sempre
    -- vencendo o payload, e a propriedade referenciada precisa ser dela.
    IF v_caller_role = 'service_role' THEN
        v_user_id := (p_payload->>'user_id')::UUID;
    ELSIF v_caller_uid IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.propriedades
            WHERE id = v_propriedade_id AND user_id = v_caller_uid
        ) THEN
            RAISE EXCEPTION 'Propriedade inválida ou não pertence ao usuário';
        END IF;
        v_user_id := v_caller_uid;
    ELSE
        RAISE EXCEPTION 'Não autorizado';
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

REVOKE ALL ON FUNCTION public.rpc_registrar_transacao_com_rateio(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_transacao_com_rateio(jsonb) TO authenticated, service_role;
