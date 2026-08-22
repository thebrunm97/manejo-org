-- ============================================================================
-- MIGRAÇÃO: 20260816010000_create_mutation_drafts.sql
-- Fase 2.2: Tabela de Rascunhos de Mutações (HITL) e RPCs Atômicas de Draft e Commit
-- ============================================================================

-- 1. Criação da Tabela de Rascunhos
CREATE TABLE IF NOT EXISTS public.mutation_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id BIGINT NOT NULL REFERENCES public.pmos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_phone TEXT NOT NULL,
    supersedes_draft_id UUID REFERENCES public.mutation_drafts(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'superseded', 'expired', 'failed')),
    operations JSONB NOT NULL,
    summary_text TEXT,
    error_detail TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '45 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices de Lookup e Unicidade
CREATE INDEX IF NOT EXISTS idx_mutation_drafts_lookup 
ON public.mutation_drafts (from_phone, pmo_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_mutation_drafts_supersedes 
ON public.mutation_drafts (supersedes_draft_id);

-- Garante no máximo 1 rascunho 'pending' por (from_phone, pmo_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mutation_drafts_one_pending
ON public.mutation_drafts (from_phone, pmo_id)
WHERE status = 'pending';

-- 3. RLS na Tabela (Leitura para dono, escrita restrita a service_role/SECURITY DEFINER)
ALTER TABLE public.mutation_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver seus próprios rascunhos"
ON public.mutation_drafts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. RPC Atômica para Criação/Supersede de Rascunho (Prevenção de Race Conditions)
CREATE OR REPLACE FUNCTION public.create_or_supersede_mutation_draft(
    p_pmo_id BIGINT,
    p_user_id UUID,
    p_from_phone TEXT,
    p_operations JSONB,
    p_summary_text TEXT DEFAULT NULL,
    p_ttl_minutes INT DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_id UUID;
    v_new_draft_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF p_operations IS NULL OR jsonb_array_length(p_operations) = 0 THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Lista de operações não pode ser vazia.'
        );
    END IF;

    -- 1. Trava qualquer draft 'pending' existente para o mesmo (from_phone, pmo_id)
    SELECT id INTO v_existing_id
    FROM public.mutation_drafts
    WHERE from_phone = p_from_phone
      AND pmo_id = p_pmo_id
      AND status = 'pending'
    FOR UPDATE;

    -- 2. Se existia um rascunho pendente, marca-o como superseded
    IF v_existing_id IS NOT NULL THEN
        UPDATE public.mutation_drafts
        SET status = 'superseded',
            updated_at = now()
        WHERE id = v_existing_id;
    END IF;

    v_expires_at := now() + (COALESCE(p_ttl_minutes, 45) || ' minutes')::INTERVAL;

    -- 3. Insere o novo rascunho apontando para o anterior (se houver)
    INSERT INTO public.mutation_drafts (
        pmo_id,
        user_id,
        from_phone,
        supersedes_draft_id,
        status,
        operations,
        summary_text,
        expires_at
    ) VALUES (
        p_pmo_id,
        p_user_id,
        p_from_phone,
        v_existing_id,
        'pending',
        p_operations,
        p_summary_text,
        v_expires_at
    )
    RETURNING id INTO v_new_draft_id;

    RETURN jsonb_build_object(
        'status', 'created',
        'draft_id', v_new_draft_id,
        'superseded_draft_id', v_existing_id,
        'expires_at', v_expires_at,
        'operations_count', jsonb_array_length(p_operations),
        'message', 'Rascunho de mutação criado com sucesso.'
    );
END;
$$;

-- 5. RPC Atômica com Sub-bloco EXCEPTION para Persistência de Falhas no Commit
CREATE OR REPLACE FUNCTION public.commit_mutation_draft(
    p_draft_id UUID,
    p_user_id UUID,
    p_pmo_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_draft RECORD;
    v_op JSONB;
    v_op_type TEXT;
    v_op_payload JSONB;
    v_idx INT := 0;
    v_idemp_key TEXT;
    v_res JSONB;
    v_results JSONB := '[]'::JSONB;
    v_err_msg TEXT;
    v_propriedade_id BIGINT;
    v_tipo_campo TEXT;
BEGIN
    -- 1. Lock FOR UPDATE e Validação Multi-tenant
    SELECT * INTO v_draft
    FROM public.mutation_drafts
    WHERE id = p_draft_id
      AND pmo_id = p_pmo_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'not_found',
            'message', 'Rascunho de mutação não encontrado ou não pertence a esta PMO.'
        );
    END IF;

    -- Se já foi aprovado anteriormente, retorna idempotentemente
    IF v_draft.status = 'approved' THEN
        RETURN jsonb_build_object(
            'status', 'already_approved',
            'draft_id', p_draft_id,
            'message', 'Este rascunho de mutação já foi aprovado e executado anteriormente.'
        );
    END IF;

    -- Se for terminal (failed, rejected, superseded)
    IF v_draft.status IN ('failed', 'rejected', 'superseded') THEN
        RETURN jsonb_build_object(
            'status', v_draft.status,
            'draft_id', p_draft_id,
            'error_detail', v_draft.error_detail,
            'message', 'Rascunho em estado terminal (' || v_draft.status || '). Crie um novo rascunho.'
        );
    END IF;

    -- Validação de TTL
    IF v_draft.expires_at < now() THEN
        UPDATE public.mutation_drafts
        SET status = 'expired', updated_at = now()
        WHERE id = p_draft_id;

        RETURN jsonb_build_object(
            'status', 'expired',
            'draft_id', p_draft_id,
            'message', 'O tempo limite para confirmação deste rascunho (45 minutos) expirou.'
        );
    END IF;

    -- Obter propriedade_id associada ao pmo_id se necessário
    SELECT propriedade_id INTO v_propriedade_id FROM public.pmos WHERE id = p_pmo_id LIMIT 1;

    -- 2. Sub-bloco com EXCEPTION para garantir persistência do status 'failed'
    BEGIN
        FOR v_op IN SELECT * FROM jsonb_array_elements(v_draft.operations) LOOP
            v_op_type := lower(trim(COALESCE(v_op->>'type', v_op->>'tipo', '')));
            v_op_payload := COALESCE(v_op->'payload', v_op->'dados', v_op);
            v_idemp_key := p_draft_id::TEXT || '-op-' || v_idx::TEXT;

            -- Injeta idempotency_key derivada
            v_op_payload := v_op_payload || jsonb_build_object('idempotency_key', v_idemp_key);

            CASE v_op_type
                WHEN 'caderno_campo', 'operacao_campo', 'limpeza', 'propagacao', 'plantio', 'colheita', 'manejo', 'compostagem' THEN
                    v_tipo_campo := initcap(COALESCE(v_op->>'tipo_operacao', v_op_type));
                    IF v_tipo_campo IN ('Caderno_Campo', 'Caderno_campo', 'Operacao_Campo', 'Operacao_campo') THEN
                        v_tipo_campo := 'Plantio';
                    END IF;

                    v_res := public.rpc_registrar_operacao_campo(
                        p_pmo_id,
                        p_user_id,
                        v_tipo_campo,
                        v_op_payload
                    );
                WHEN 'compra_insumo', 'compra' THEN
                    v_res := public.rpc_registrar_compra_insumo(
                        pmo_id_arg => p_pmo_id,
                        propriedade_id_arg => COALESCE((v_op_payload->>'propriedade_id')::BIGINT, v_propriedade_id),
                        user_id_arg => p_user_id,
                        produto_arg => v_op_payload->>'produto',
                        quantidade_valor_arg => (v_op_payload->>'quantidade_valor')::NUMERIC,
                        quantidade_unidade_arg => v_op_payload->>'quantidade_unidade',
                        fornecedor_arg => v_op_payload->>'fornecedor',
                        data_compra_arg => COALESCE((v_op_payload->>'data_compra')::DATE, (v_op_payload->>'data')::DATE, CURRENT_DATE),
                        nota_fiscal_arg => v_op_payload->>'nota_fiscal',
                        marca_arg => v_op_payload->>'marca',
                        composicao_arg => v_op_payload->>'composicao',
                        procedencia_arg => v_op_payload->>'procedencia',
                        valor_total_arg => COALESCE((v_op_payload->>'valor_total')::NUMERIC, 0),
                        alocacoes_talhoes_arg => v_op_payload->'alocacoes_talhoes',
                        categoria_nome_arg => v_op_payload->>'categoria_nome',
                        raw_payload_id_arg => NULL,
                        idempotency_key_arg => v_idemp_key
                    );
                WHEN 'transacoes_com_rateio', 'transacao_rateio', 'despesa', 'venda' THEN
                    v_op_payload := v_op_payload || jsonb_build_object(
                        'pmo_id', p_pmo_id,
                        'user_id', p_user_id,
                        'propriedade_id', COALESCE((v_op_payload->>'propriedade_id')::BIGINT, v_propriedade_id)
                    );
                    v_res := public.rpc_registrar_transacao_com_rateio(v_op_payload);
                WHEN 'cotas_produtores', 'cota_produtor', 'cota' THEN
                    v_res := public.rpc_registrar_cota_produtor(
                        p_demanda_id => (v_op_payload->>'demanda_id')::UUID,
                        p_propriedade_id => COALESCE((v_op_payload->>'propriedade_id')::BIGINT, v_propriedade_id),
                        p_usuario_id => p_user_id,
                        p_quantidade => (v_op_payload->>'quantidade')::NUMERIC,
                        p_data_plantio => (v_op_payload->>'data_plantio')::DATE,
                        p_observacao => v_op_payload->>'observacao',
                        p_idempotency_key => v_idemp_key
                    );
                ELSE
                    RAISE EXCEPTION 'Tipo de operação não suportado: %', v_op_type;
            END CASE;

            -- Checa se a sub-RPC retornou erro de negócio
            IF v_res IS NULL OR v_res->>'status' NOT IN ('success', 'already_processed') THEN
                RAISE EXCEPTION 'Operação % (%) falhou: %', v_idx, v_op_type, COALESCE(v_res->>'message', 'Erro não especificado');
            END IF;

            v_results := v_results || jsonb_build_object('index', v_idx, 'type', v_op_type, 'result', v_res);
            v_idx := v_idx + 1;
        END LOOP;

        -- Todas as operações concluídas com sucesso:
        UPDATE public.mutation_drafts
        SET status = 'approved',
            updated_at = now()
        WHERE id = p_draft_id;

        RETURN jsonb_build_object(
            'status', 'approved',
            'draft_id', p_draft_id,
            'results', v_results,
            'message', 'Lote de mutações executado com sucesso.'
        );

    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
        
        -- Atualiza rascunho como failed (estado terminal)
        UPDATE public.mutation_drafts
        SET status = 'failed',
            error_detail = v_err_msg,
            updated_at = now()
        WHERE id = p_draft_id;

        RETURN jsonb_build_object(
            'status', 'failed',
            'draft_id', p_draft_id,
            'error_detail', v_err_msg,
            'message', 'Falha na execução atômica do lote de mutações.'
        );
    END;
END;
$$;
