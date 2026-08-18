-- Migration: Criar RPC para update de propriedades (DT-18)
-- Date: 2026-08-17

CREATE OR REPLACE FUNCTION public.rpc_update_propriedade(
    p_id BIGINT,
    p_updates JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_owner_id UUID;
BEGIN
    -- 1. Autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Não autenticado', 'code', 'UNAUTHORIZED');
    END IF;

    -- 2. Posse (Replicando estritamente a política RLS "Usuários gerenciam suas propriedades")
    SELECT user_id INTO v_owner_id FROM public.propriedades WHERE id = p_id;
    
    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Propriedade não encontrada', 'code', 'NOT_FOUND');
    END IF;
    
    IF v_owner_id != v_user_id THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Acesso negado. Apenas o proprietário pode alterar.', 'code', 'FORBIDDEN');
    END IF;

    -- 3. Atualização Sanitizada (Allow-list Explícita para Evitar Mass Assignment)
    UPDATE public.propriedades
    SET
        nome = CASE WHEN p_updates ? 'nome' THEN (p_updates->>'nome') ELSE nome END,
        car = CASE WHEN p_updates ? 'car' THEN (p_updates->>'car') ELSE car END,
        inscricao_estadual = CASE WHEN p_updates ? 'inscricao_estadual' THEN (p_updates->>'inscricao_estadual') ELSE inscricao_estadual END,
        matricula = CASE WHEN p_updates ? 'matricula' THEN (p_updates->>'matricula') ELSE matricula END,
        endereco_cadastral = CASE WHEN p_updates ? 'endereco_cadastral' THEN (p_updates->>'endereco_cadastral') ELSE endereco_cadastral END,
        modalidade_predominante = CASE WHEN p_updates ? 'modalidade_predominante' THEN CAST((p_updates->>'modalidade_predominante') AS public.modalidade_producao_enum) ELSE modalidade_predominante END,
        tem_producao_paralela = CASE WHEN p_updates ? 'tem_producao_paralela' THEN CAST((p_updates->>'tem_producao_paralela') AS BOOLEAN) ELSE tem_producao_paralela END,
        updated_at = NOW()
    WHERE id = p_id;

    RETURN jsonb_build_object('status', 'success', 'data', jsonb_build_object('id', p_id));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM, 'code', SQLSTATE);
END;
$$;
