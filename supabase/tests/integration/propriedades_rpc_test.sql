-- Caminho: supabase/tests/integration/propriedades_rpc_test.sql
-- Descrição: Teste de integração para a RPC rpc_update_propriedade (DT-18)
-- Valida isolamento RLS e proteção contra Mass Assignment

DO $$
DECLARE
    v_user_dono uuid := gen_random_uuid();
    v_user_outro uuid := gen_random_uuid();
    v_prop_id bigint;
    v_res jsonb;
BEGIN
    -- ==========================================
    -- SETUP: Criar Fixtures (Isoladas via Rollback)
    -- ==========================================
    -- Insere usuários na tabela auth.users para satisfazer a constraint de FK
    INSERT INTO auth.users (id, aud, role, email) 
    VALUES 
        (v_user_dono, 'authenticated', 'authenticated', 'dono_fixture@teste.com'),
        (v_user_outro, 'authenticated', 'authenticated', 'outro_fixture@teste.com');
        
    -- Cria a propriedade atrelada ao usuário dono
    INSERT INTO public.propriedades (nome, user_id) 
    VALUES ('Fazenda Fixture (Dono)', v_user_dono) 
    RETURNING id INTO v_prop_id;

    -- ==========================================
    -- TESTE 1: USUÁRIO NÃO-DONO TENTA EDITAR (DEVE FALHAR COM FORBIDDEN)
    -- ==========================================
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_outro), true);
    v_res := public.rpc_update_propriedade(v_prop_id, '{"nome": "Nome Hackeado"}'::jsonb);
    
    IF v_res->>'code' != 'FORBIDDEN' THEN
        RAISE EXCEPTION '❌ Falha Teste 1: Esperado FORBIDDEN, recebido %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste 1 (Bloqueio Não-Dono): PASSOU';

    -- ==========================================
    -- TESTE 2: USUÁRIO DONO TENTA EDITAR (DEVE SUCEDER)
    -- ==========================================
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    v_res := public.rpc_update_propriedade(v_prop_id, '{"nome": "Nome Seguro"}'::jsonb);
    
    IF v_res->>'status' != 'success' THEN
        RAISE EXCEPTION '❌ Falha Teste 2: Esperado success, recebido %', v_res;
    END IF;
    RAISE NOTICE '✅ Teste 2 (Sucesso Dono): PASSOU';

    -- ==========================================
    -- TESTE 3: MASS ASSIGNMENT (IGNORAR CAMPOS NÃO PERMITIDOS)
    -- ==========================================
    -- Tentativa de sequestrar a propriedade mandando o 'user_id' no payload
    v_res := public.rpc_update_propriedade(v_prop_id, format('{"user_id": "%s", "car": "CAR-SECURE"}', v_user_outro)::jsonb);
    
    IF v_res->>'status' != 'success' THEN
        RAISE EXCEPTION '❌ Falha Teste 3: Esperado success com filtro, recebido %', v_res;
    END IF;
    
    -- Verificação estrita: garantir que o user_id real no banco não foi alterado
    IF (SELECT user_id::text FROM public.propriedades WHERE id = v_prop_id) != v_user_dono::text THEN
        RAISE EXCEPTION '❌ Falha Teste 3: user_id foi alterado! Vulnerabilidade de Mass Assignment detectada.';
    END IF;
    RAISE NOTICE '✅ Teste 3 (Filtro Mass Assignment): PASSOU';

    -- ==========================================
    -- CLEANUP / ROLLBACK
    -- ==========================================
    -- Forçar um erro para emitir ROLLBACK automático no bloco DO, revertendo todas as fixtures
    RAISE EXCEPTION '🚀 Rollback Concluído. Todos os testes de integração do banco PASSARAM.';
END;
$$;
