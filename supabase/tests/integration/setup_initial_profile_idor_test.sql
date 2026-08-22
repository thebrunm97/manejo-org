-- Caminho: supabase/tests/integration/setup_initial_profile_idor_test.sql
-- Descrição: Teste de regressão do IDOR em setup_initial_profile (DT-20)
-- Valida bloqueio de falsificação de identidade e sucesso no caminho feliz.

DO $$
DECLARE
    v_user_legitimo uuid := gen_random_uuid();
    v_user_vitima uuid := gen_random_uuid();
    v_res jsonb;
    v_prop_id bigint;
BEGIN
    -- ==========================================
    -- SETUP: Criar Fixtures (Isoladas via Rollback)
    -- ==========================================
    -- 1. Inserir na tabela de autenticação
    INSERT INTO auth.users (id, aud, role, email) 
    VALUES 
        (v_user_legitimo, 'authenticated', 'authenticated', 'legitimo@teste.com'),
        (v_user_vitima, 'authenticated', 'authenticated', 'vitima@teste.com');
        
    -- 2. Inserir profiles iniciais vazios (como é antes do onboarding)
    INSERT INTO public.profiles (id, role, nome) 
    VALUES 
        (v_user_legitimo, 'produtor', 'Sem Nome'),
        (v_user_vitima, 'produtor', 'Sem Nome');

    -- ==========================================
    -- TESTE 1: TENTATIVA DE IDOR (DEVE FALHAR)
    -- ==========================================
    -- Caller é v_user_legitimo, mas tenta passar o ID de v_user_vitima
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_legitimo), true);
    
    v_res := public.setup_initial_profile(
        v_user_vitima,           -- p_user_id (ALVO MALICIOSO)
        'Hacker',                -- p_nome
        'Fazenda Sequestrada',   -- p_propriedade_nome
        100.0,                   -- p_area_ha
        'Talhão Injetado'        -- p_talhao_nome
    );
    
    IF v_res->>'success' = 'true' THEN
        RAISE EXCEPTION '❌ Falha Teste 1: IDOR teve sucesso! Recebido: %', v_res;
    END IF;
    
    -- Validar se os dados da vítima foram alterados
    IF EXISTS (SELECT 1 FROM public.propriedades WHERE user_id = v_user_vitima) THEN
        RAISE EXCEPTION '❌ Falha Teste 1: Propriedade forjada foi criada para a vítima!';
    END IF;
    
    RAISE NOTICE '✅ Teste 1 (Bloqueio de IDOR): PASSOU. Retorno seguro: %', v_res->>'error';

    -- ==========================================
    -- TESTE 2: ONBOARDING LEGÍTIMO (DEVE SUCEDER)
    -- ==========================================
    -- Caller é v_user_legitimo, passa seu próprio ID
    v_res := public.setup_initial_profile(
        v_user_legitimo,         -- p_user_id (CORRETO)
        'Produtor Ficticio',     -- p_nome
        'Sítio Fictício',        -- p_propriedade_nome
        50.5,                    -- p_area_ha
        'Talhão Principal'       -- p_talhao_nome
    );
    
    IF v_res->>'success' != 'true' THEN
        RAISE EXCEPTION '❌ Falha Teste 2: Onboarding legítimo falhou! Recebido: %', v_res;
    END IF;
    
    -- Capturar ID da propriedade criada para garantir que o BD preencheu corretamente
    v_prop_id := (v_res->>'propriedade_id')::bigint;
    
    IF NOT EXISTS (SELECT 1 FROM public.propriedades WHERE id = v_prop_id AND user_id = v_user_legitimo) THEN
         RAISE EXCEPTION '❌ Falha Teste 2: Propriedade não salva corretamente para o dono legítimo.';
    END IF;

    RAISE NOTICE '✅ Teste 2 (Onboarding Legítimo): PASSOU. Propriedade gerada: %', v_prop_id;

    -- ==========================================
    -- CLEANUP / ROLLBACK
    -- ==========================================
    -- Forçar um erro para emitir ROLLBACK automático no bloco DO, revertendo todas as fixtures
    RAISE EXCEPTION '🚀 Rollback Concluído. Todos os testes de integração do banco PASSARAM.';
END;
$$;
