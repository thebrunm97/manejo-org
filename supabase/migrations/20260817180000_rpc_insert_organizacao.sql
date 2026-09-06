-- Migration: DT-18 Migração de Insert para RPC (organizacoes)
-- Substitui a chamada direta supabase.from('organizacoes').insert()

CREATE OR REPLACE FUNCTION public.rpc_insert_organizacao(
    p_nome text,
    p_tipo text,
    p_cnpj text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
    v_inserted_org public.organizacoes;
BEGIN
    -- 1. Identificar usuário autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Usuário não autenticado', 'code', 'UNAUTHORIZED');
    END IF;

    -- 2. Validar permissão (Apenas admins criam organizações via UI atualmente)
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_user_id AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Apenas administradores podem criar organizações', 'code', 'FORBIDDEN');
    END IF;

    -- 3. Inserir a organização
    INSERT INTO public.organizacoes (nome, cnpj, tipo)
    VALUES (p_nome, p_cnpj, p_tipo)
    RETURNING * INTO v_inserted_org;

    -- 4. Retornar a linha criada no padrão success/data
    RETURN jsonb_build_object(
        'status', 'success',
        'data', row_to_json(v_inserted_org)::jsonb
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Já existe uma organização com este CNPJ.', 'code', 'UNIQUE_VIOLATION');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('status', 'error', 'message', SQLERRM, 'code', 'INTERNAL_ERROR');
END;
$$;
