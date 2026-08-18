-- Caminho: supabase/tests/integration/lotes_rastreabilidade_rpc_test.sql
-- Descrição: Valida as regras de negócio e duplicidade para lotes de rastreabilidade (Item 4)

DO $$
DECLARE
    v_user_dono uuid := gen_random_uuid();
    v_user_impostor uuid := gen_random_uuid();
    v_prop_id bigint;
    v_res jsonb;
    v_codigo_lote text := 'LOT-20260817-AAA';
BEGIN
    -- ==========================================
    -- SETUP: Criar Fixtures (Isoladas via Rollback)
    -- ==========================================
    INSERT INTO auth.users (id, aud, role, email) 
    VALUES 
        (v_user_dono, 'authenticated', 'authenticated', 'dono_lote@teste.com'),
        (v_user_impostor, 'authenticated', 'authenticated', 'impostor_lote@teste.com');
        
    UPDATE public.profiles SET role = 'user' WHERE id IN (v_user_dono, v_user_impostor);

    INSERT INTO public.propriedades (nome, user_id, area_total_ha) 
    VALUES ('Fazenda do Dono', v_user_dono, 100) 
    RETURNING id INTO v_prop_id;

    -- ==========================================
    -- TESTE A: Não-dono tenta criar lote na propriedade alheia
    -- ==========================================
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_impostor), true);
    
    v_res := public.rpc_insert_lote_rastreabilidade(
        v_codigo_lote, NULL, v_prop_id, 'Tomate', CURRENT_DATE, 100
    );
    
    IF v_res->>'code' != 'ERR_FORBIDDEN' THEN
        RAISE EXCEPTION '❌ Falha Teste A: Impostor conseguiu criar lote em propriedade alheia. Recebido: %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste A (Bloqueio Impostor): PASSOU. Código: %', v_res->>'code';

    -- ==========================================
    -- TESTE B: Formato de Código Inválido
    -- ==========================================
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    
    v_res := public.rpc_insert_lote_rastreabilidade(
        'LOTE-ERRADO', NULL, v_prop_id, 'Tomate', CURRENT_DATE, 100
    );
    
    IF v_res->>'code' != 'ERR_VALIDATION' THEN
        RAISE EXCEPTION '❌ Falha Teste B: Passou regex inválida. Recebido: %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste B (Validação de Regex): PASSOU. Código: %', v_res->>'code';

    -- ==========================================
    -- TESTE C: Caminho Feliz
    -- ==========================================
    v_res := public.rpc_insert_lote_rastreabilidade(
        v_codigo_lote, NULL, v_prop_id, 'Tomate', CURRENT_DATE, 100
    );
    
    IF v_res->>'status' != 'success' THEN
        RAISE EXCEPTION '❌ Falha Teste C: Dono não conseguiu criar lote. Recebido: %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste C (Caminho Feliz): PASSOU. Status: %', v_res->>'status';

    -- ==========================================
    -- TESTE D: Duplicidade
    -- ==========================================
    v_res := public.rpc_insert_lote_rastreabilidade(
        v_codigo_lote, NULL, v_prop_id, 'Tomate 2', CURRENT_DATE, 200
    );
    
    IF v_res->>'code' != 'ERR_DUPLICATE' THEN
        RAISE EXCEPTION '❌ Falha Teste D: Duplicidade não foi interceptada corretamente. Recebido: %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste D (Bloqueio de Duplicidade): PASSOU. Código: %', v_res->>'code';

    -- ==========================================
    -- CLEANUP / ROLLBACK
    -- ==========================================
    RAISE EXCEPTION '🚀 Rollback Concluído. Testes de integracao lotes_rastreabilidade PASSARAM.';
END;
$$;
