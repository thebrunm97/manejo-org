-- update_profile: cast de pmo_ativo_id/propriedade_ativa_id para bigint.
-- Aplicada em produção via MCP em 2026-09-10 sem arquivo no repo; recuperada
-- de supabase_migrations.schema_migrations em 2026-09-30 (sincronização de
-- drift).

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
        pmo_ativo_id = CASE WHEN p_updates ? 'pmo_ativo_id' THEN (p_updates->>'pmo_ativo_id')::bigint ELSE pmo_ativo_id END,
        propriedade_ativa_id = CASE WHEN p_updates ? 'propriedade_ativa_id' THEN (p_updates->>'propriedade_ativa_id')::bigint ELSE propriedade_ativa_id END,
        nome = CASE WHEN p_updates ? 'nome' THEN p_updates->>'nome' ELSE nome END,
        telefone = CASE WHEN p_updates ? 'telefone' THEN p_updates->>'telefone' ELSE telefone END,
        avatar_url = CASE WHEN p_updates ? 'avatar_url' THEN p_updates->>'avatar_url' ELSE avatar_url END,
        consentimento_replay_sessao = CASE WHEN p_updates ? 'consentimento_replay_sessao' THEN (p_updates->>'consentimento_replay_sessao')::boolean ELSE consentimento_replay_sessao END,
        consentimento_replay_sessao_em = CASE WHEN p_updates ? 'consentimento_replay_sessao' THEN now() ELSE consentimento_replay_sessao_em END,
        updated_at = now()
    WHERE id = v_user_id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_profile FROM public;
GRANT EXECUTE ON FUNCTION public.update_profile TO authenticated;
