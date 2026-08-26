-- Migration: Add slug to organizacoes
-- Created at: 2026-08-26

ALTER TABLE public.organizacoes ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Update existing organizations with a slug
UPDATE public.organizacoes 
SET slug = 'coop-modelo' 
WHERE nome = 'Cooperativa Central (Padrão)' AND slug IS NULL;

UPDATE public.organizacoes 
SET slug = lower(regexp_replace(nome, '\W+', '-', 'g')) || '-' || id::text 
WHERE slug IS NULL;

ALTER TABLE public.organizacoes ALTER COLUMN slug SET NOT NULL;

-- Update RPC to handle slug
CREATE OR REPLACE FUNCTION public.rpc_insert_organizacao(
    p_nome text,
    p_tipo text,
    p_cnpj text DEFAULT NULL,
    p_slug text DEFAULT NULL
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
    v_final_slug text;
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

    -- 3. Gerar slug se não fornecido
    IF p_slug IS NULL OR p_slug = '' THEN
        v_final_slug := lower(regexp_replace(p_nome, '\W+', '-', 'g')) || '-' || floor(random() * 1000)::text;
    ELSE
        v_final_slug := p_slug;
    END IF;

    -- 4. Inserir a organização
    INSERT INTO public.organizacoes (nome, cnpj, tipo, slug)
    VALUES (p_nome, p_cnpj, p_tipo, v_final_slug)
    RETURNING * INTO v_inserted_org;

    -- 5. Retornar a linha criada no padrão success/data
    RETURN jsonb_build_object(
        'status', 'success',
        'data', row_to_json(v_inserted_org)::jsonb
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Já existe uma organização com este CNPJ ou Slug.', 'code', 'UNIQUE_VIOLATION');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('status', 'error', 'message', SQLERRM, 'code', 'INTERNAL_ERROR');
END;
$$;
