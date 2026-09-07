-- Caminho: supabase/tests/integration/dt18_remaining_mutation_rpcs_test.sql
-- Descrição: Teste de integração para as 5 RPCs de mutação restantes (DT-18)
-- Valida que usuário dono consegue operar e usuário não-dono é RECUSADO com exceção.

DO $$
DECLARE
    v_user_dono uuid := gen_random_uuid();
    v_user_impostor uuid := gen_random_uuid();
    v_prop_id bigint;
    v_pmo_id bigint;
    v_item_id uuid;
    v_log_id uuid;
    v_prop_item public.pmo_propagacao;
    v_limite public.limites_seguranca;
    v_failed boolean;
BEGIN
    -- ==========================================
    -- SETUP: Criar Fixtures
    -- ==========================================
    INSERT INTO auth.users (id, aud, role, email) 
    VALUES 
        (v_user_dono, 'authenticated', 'authenticated', 'dono_dt18@teste.com'),
        (v_user_impostor, 'authenticated', 'authenticated', 'impostor_dt18@teste.com');

    INSERT INTO public.profiles (id, nome, role)
    VALUES
        (v_user_dono, 'Dono DT18', 'user'),
        (v_user_impostor, 'Impostor DT18', 'user')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
        
    INSERT INTO public.propriedades (nome, user_id) 
    VALUES ('Fazenda DT18 Teste', v_user_dono) 
    RETURNING id INTO v_prop_id;

    INSERT INTO public.pmos (propriedade_id, user_id, status, cultura, produtividade_kg_ha)
    VALUES (v_prop_id, v_user_dono, 'em_elaboracao', 'Hortaliças', 1500.00)
    RETURNING id INTO v_pmo_id;

    -- =========================================================================
    -- RPC 1: create_propagacao_item
    -- =========================================================================
    -- Teste 1.1: Não-dono tenta criar item no PMO do dono (DEVE RECUSAR)
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_impostor), true);
    v_failed := false;
    BEGIN
        PERFORM public.create_propagacao_item(v_pmo_id, '{"tipo": "muda", "especies": "Tomate"}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        v_failed := true;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION '❌ Falha 1.1: create_propagacao_item permitiu criação por não-dono!';
    END IF;
    RAISE NOTICE '✅ 1.1: create_propagacao_item (recusa não-dono): PASSOU';

    -- Teste 1.2: Dono cria item com sucesso
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    v_prop_item := public.create_propagacao_item(
        v_pmo_id,
        '{"tipo": "muda", "especies": "Alface Americana", "origem": "BioSementes", "quantidade": "50 mudas", "sistema_organico": true, "data_compra": "2026-09-01"}'::jsonb
    );
    IF v_prop_item.id IS NULL OR v_prop_item.especies != 'Alface Americana' OR v_prop_item.propriedade_id != v_prop_id THEN
        RAISE EXCEPTION '❌ Falha 1.2: create_propagacao_item retornou dados inválidos: %', v_prop_item;
    END IF;
    v_item_id := v_prop_item.id;
    RAISE NOTICE '✅ 1.2: create_propagacao_item (sucesso dono): PASSOU (id=%)', v_item_id;

    -- =========================================================================
    -- RPC 2: update_propagacao_item
    -- =========================================================================
    -- Teste 2.1: Não-dono tenta atualizar item do dono (DEVE RECUSAR)
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_impostor), true);
    v_failed := false;
    BEGIN
        PERFORM public.update_propagacao_item(v_item_id, '{"especies": "Hacked"}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        v_failed := true;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION '❌ Falha 2.1: update_propagacao_item permitiu edição por não-dono!';
    END IF;
    RAISE NOTICE '✅ 2.1: update_propagacao_item (recusa não-dono): PASSOU';

    -- Teste 2.2: Dono atualiza item com sucesso
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    PERFORM public.update_propagacao_item(v_item_id, '{"quantidade": "100 mudas", "origem": "BioSementes Org"}'::jsonb);
    
    SELECT * INTO v_prop_item FROM public.pmo_propagacao WHERE id = v_item_id;
    IF v_prop_item.quantidade != '100 mudas' OR v_prop_item.origem != 'BioSementes Org' OR v_prop_item.especies != 'Alface Americana' THEN
        RAISE EXCEPTION '❌ Falha 2.2: update_propagacao_item não persistiu valores esperados: %', v_prop_item;
    END IF;
    RAISE NOTICE '✅ 2.2: update_propagacao_item (sucesso dono): PASSOU';

    -- =========================================================================
    -- RPC 3: delete_propagacao_item
    -- =========================================================================
    -- Teste 3.1: Não-dono tenta deletar item do dono (DEVE RECUSAR)
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_impostor), true);
    v_failed := false;
    BEGIN
        PERFORM public.delete_propagacao_item(v_item_id);
    EXCEPTION WHEN OTHERS THEN
        v_failed := true;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION '❌ Falha 3.1: delete_propagacao_item permitiu exclusão por não-dono!';
    END IF;
    RAISE NOTICE '✅ 3.1: delete_propagacao_item (recusa não-dono): PASSOU';

    -- Teste 3.2: Dono deleta item com sucesso
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    PERFORM public.delete_propagacao_item(v_item_id);
    IF EXISTS (SELECT 1 FROM public.pmo_propagacao WHERE id = v_item_id) THEN
        RAISE EXCEPTION '❌ Falha 3.2: delete_propagacao_item não removeu o registro!';
    END IF;
    RAISE NOTICE '✅ 3.2: delete_propagacao_item (sucesso dono): PASSOU';

    -- =========================================================================
    -- RPC 4: update_log_treinamento
    -- =========================================================================
    -- Inserir fixture de log de treinamento para o dono
    INSERT INTO public.logs_treinamento (id, user_id, pmo_id, processado, texto_usuario)
    VALUES (gen_random_uuid(), v_user_dono, v_pmo_id, false, 'Plantio de milho')
    RETURNING id INTO v_log_id;

    -- Teste 4.1: Não-dono tenta atualizar log de treinamento (DEVE RECUSAR)
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_impostor), true);
    v_failed := false;
    BEGIN
        PERFORM public.update_log_treinamento(v_log_id, '{"processado": true}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        v_failed := true;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION '❌ Falha 4.1: update_log_treinamento permitiu alteração por não-dono!';
    END IF;
    RAISE NOTICE '✅ 4.1: update_log_treinamento (recusa não-dono): PASSOU';

    -- Teste 4.2: Dono atualiza log de treinamento com sucesso
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    PERFORM public.update_log_treinamento(
        v_log_id,
        '{"processado": true, "status_validacao": "corrigido_humano", "foi_editado": true, "json_corrigido": {"especie": "Milho Crioulo"}}'::jsonb
    );

    IF NOT EXISTS (
        SELECT 1 FROM public.logs_treinamento 
        WHERE id = v_log_id 
          AND processado = true 
          AND status_validacao = 'corrigido_humano'
          AND foi_editado = true
          AND json_corrigido->>'especie' = 'Milho Crioulo'
    ) THEN
        RAISE EXCEPTION '❌ Falha 4.2: update_log_treinamento não persistiu os valores esperados';
    END IF;
    RAISE NOTICE '✅ 4.2: update_log_treinamento (sucesso dono): PASSOU';

    -- =========================================================================
    -- RPC 5: upsert_limites_seguranca
    -- =========================================================================
    -- Teste 5.1: Não-dono tenta salvar limites de segurança (DEVE RECUSAR)
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_impostor), true);
    v_failed := false;
    BEGIN
        PERFORM public.upsert_limites_seguranca(v_prop_id, v_pmo_id, '{"limite_transacao": 10000, "limite_manejo": 2000}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        v_failed := true;
    END;
    IF NOT v_failed THEN
        RAISE EXCEPTION '❌ Falha 5.1: upsert_limites_seguranca permitiu alteração por não-dono!';
    END IF;
    RAISE NOTICE '✅ 5.1: upsert_limites_seguranca (recusa não-dono): PASSOU';

    -- Teste 5.2: Dono salva limites de segurança (INSERT inicial)
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_user_dono), true);
    v_limite := public.upsert_limites_seguranca(
        v_prop_id,
        v_pmo_id,
        '{"limite_transacao": 35000.50, "limite_manejo": 4500.00}'::jsonb
    );
    IF v_limite.limite_transacao != 35000.50 OR v_limite.limite_manejo != 4500.00 THEN
        RAISE EXCEPTION '❌ Falha 5.2: upsert_limites_seguranca retornou valores inesperados: %', v_limite;
    END IF;
    RAISE NOTICE '✅ 5.2: upsert_limites_seguranca (sucesso dono - insert): PASSOU';

    -- Teste 5.3: Dono atualiza limites de segurança (UPDATE no conflito)
    v_limite := public.upsert_limites_seguranca(
        v_prop_id,
        v_pmo_id,
        '{"limite_transacao": 60000.00, "limite_manejo": 8000.00}'::jsonb
    );
    IF v_limite.limite_transacao != 60000.00 OR v_limite.limite_manejo != 8000.00 THEN
        RAISE EXCEPTION '❌ Falha 5.3: upsert_limites_seguranca não atualizou no conflito: %', v_limite;
    END IF;
    RAISE NOTICE '✅ 5.3: upsert_limites_seguranca (sucesso dono - update): PASSOU';

    -- Limpeza final de fixtures (Rollback)
    RAISE EXCEPTION '🚀 Rollback Concluído. Todas as 5 RPCs foram validadas com sucesso (testes positivos e negativos)!';
END;
$$;
