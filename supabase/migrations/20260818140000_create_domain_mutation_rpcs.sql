-- Migration: Create Domain Mutation RPCs (DT-18)
-- Objetivo: Blindar gravações diretas encapsulando-as em funções SECURITY DEFINER.
-- Fase 1: Fundação (Profiles e Talhões)

-- ==========================================
-- 1. PROFILES
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_profile(p_updates jsonb) RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_result public.profiles;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    UPDATE public.profiles
    SET 
        pmo_ativo_id = CASE WHEN p_updates ? 'pmo_ativo_id' THEN (p_updates->>'pmo_ativo_id')::uuid ELSE pmo_ativo_id END,
        propriedade_ativa_id = CASE WHEN p_updates ? 'propriedade_ativa_id' THEN (p_updates->>'propriedade_ativa_id')::bigint ELSE propriedade_ativa_id END,
        nome = CASE WHEN p_updates ? 'nome' THEN p_updates->>'nome' ELSE nome END,
        telefone = CASE WHEN p_updates ? 'telefone' THEN p_updates->>'telefone' ELSE telefone END,
        avatar_url = CASE WHEN p_updates ? 'avatar_url' THEN p_updates->>'avatar_url' ELSE avatar_url END,
        updated_at = now()
    WHERE id = v_user_id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_profile FROM public;
GRANT EXECUTE ON FUNCTION public.update_profile TO authenticated;

-- ==========================================
-- 2. TALHOES
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_talhao(p_payload jsonb)
RETURNS public.talhoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_result public.talhoes;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- Valida propriedade (se informada)
    IF (p_payload->>'propriedade_id') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.propriedades p
            WHERE p.id = (p_payload->>'propriedade_id')::bigint AND p.user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Propriedade inválida ou não pertence ao usuário';
        END IF;
    END IF;

    INSERT INTO public.talhoes (
        nome,
        geometry,
        area_ha,
        area_total_m2,
        cor,
        cultura,
        tipo,
        propriedade_id,
        user_id
    ) VALUES (
        p_payload->>'nome',
        p_payload->'geometry',
        (p_payload->>'area_ha')::numeric,
        (p_payload->>'area_total_m2')::numeric,
        p_payload->>'cor',
        p_payload->>'cultura',
        COALESCE(p_payload->>'tipo', 'produtivo'),
        (p_payload->>'propriedade_id')::bigint,
        v_user_id
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_talhao FROM public;
GRANT EXECUTE ON FUNCTION public.create_talhao TO authenticated;

CREATE OR REPLACE FUNCTION public.update_talhao(p_id bigint, p_payload jsonb)
RETURNS public.talhoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_result public.talhoes;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- Update com validação implícita de propriedade: o talhão deve pertencer ao usuário
    UPDATE public.talhoes
    SET 
        nome = COALESCE(p_payload->>'nome', nome),
        geometry = COALESCE(p_payload->'geometry', geometry),
        area_ha = COALESCE((p_payload->>'area_ha')::numeric, area_ha),
        area_total_m2 = COALESCE((p_payload->>'area_total_m2')::numeric, area_total_m2),
        cor = COALESCE(p_payload->>'cor', cor),
        cultura = COALESCE(p_payload->>'cultura', cultura),
        tipo = COALESCE(p_payload->>'tipo', tipo),
        propriedade_id = COALESCE((p_payload->>'propriedade_id')::bigint, propriedade_id)
    WHERE id = p_id AND user_id = v_user_id
    RETURNING * INTO v_result;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Talhão não encontrado ou não pertence ao usuário';
    END IF;

    RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_talhao FROM public;
GRANT EXECUTE ON FUNCTION public.update_talhao TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_talhao(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- Deleta validando a propriedade/user_id do talhão
    DELETE FROM public.talhoes
    WHERE id = p_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Talhão não encontrado ou não pertence ao usuário';
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_talhao FROM public;
GRANT EXECUTE ON FUNCTION public.delete_talhao TO authenticated;
