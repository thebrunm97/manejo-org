-- Caminho: supabase/tests/integration/organizacao_membros_rpc_test.sql
-- Descrição: Valida as regras de autorização e duplicidade para membros de organização (DT-18)

DO $$
DECLARE
    v_user_dono uuid := gen_random_uuid();
    v_user_impostor uuid := gen_random_uuid();
    v_org_id bigint;
    v_prop_id bigint;
    v_res jsonb;
BEGIN
    -- ==========================================
    -- SETUP: Criar Fixtures (Isoladas via Rollback)
    -- ==========================================
    -- 1. Inserir na tabela de autenticação
    INSERT INTO auth.users (id, aud, role, email) 
    VALUES 
        (v_user_dono, 'authenticated', 'authenticated', 'dono@teste.com'),
        (v_user_impostor, 'authenticated', 'authenticated', 'impostor@teste.com');
        
    -- 2. Atualizar profiles criados automaticamente via trigger
    UPDATE public.profiles 
    SET role = 'user'
    WHERE id IN (v_user_dono, v_user_impostor);

    -- 3. Criar Organização
    INSERT INTO public.organizacoes (nome, tipo) 
    VALUES ('Cooperativa Fixture', 'cooperativa') 
    RETURNING id INTO v_org_id;

    -- 4. Criar Propriedade vinculada ao Dono
    INSERT INTO public.propriedades (nome, user_id, area_total_ha) 
    VALUES ('Fazenda do Dono', v_user_dono, 100) 
    RETURNING id INTO v_prop_id;

    -- ==========================================
    -- TESTE A: Não-dono tenta vincular (DEVE FALHAR)
    -- ==========================================
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_impostor), true);
    
    v_res := public.rpc_add_organizacao_membro(v_org_id, v_prop_id);
    
    IF v_res->>'code' != 'ERR_AUTH_FORBIDDEN' THEN
        RAISE EXCEPTION '❌ Falha Teste A: Impostor conseguiu (ou falhou errado) ao tentar vincular propriedade alheia. Recebido: %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste A (Bloqueio Impostor): PASSOU. Código: %', v_res->>'code';

    -- ==========================================
    -- TESTE B: Dono legítimo vincula (DEVE PASSAR)
    -- ==========================================
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    
    v_res := public.rpc_add_organizacao_membro(v_org_id, v_prop_id);
    
    IF v_res->>'status' != 'success' THEN
        RAISE EXCEPTION '❌ Falha Teste B: Dono legítimo não conseguiu vincular. Recebido: %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste B (Caminho Feliz): PASSOU. Status: %', v_res->>'status';

    -- ==========================================
    -- TESTE C: Duplicidade no vínculo (DEVE FALHAR COM ERR_DUPLICATE)
    -- ==========================================
    -- O dono tenta adicionar a MESMA propriedade na MESMA organização
    v_res := public.rpc_add_organizacao_membro(v_org_id, v_prop_id);
    
    IF v_res->>'code' != 'ERR_DUPLICATE' THEN
        RAISE EXCEPTION '❌ Falha Teste C: Tratamento de duplicidade falhou. Recebido: %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste C (Bloqueio de Duplicidade): PASSOU. Código: %', v_res->>'code';

    -- ==========================================
    -- CLEANUP / ROLLBACK
    -- ==========================================
    -- Forçar um erro para emitir ROLLBACK automático no bloco DO, revertendo todas as fixtures
    RAISE EXCEPTION '🚀 Rollback Concluído. Testes de integracao organizacao_membros PASSARAM.';
END;
$$;
