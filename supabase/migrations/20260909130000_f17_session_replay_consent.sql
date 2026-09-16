-- F17 (TECHNICAL_DEBT.md): Sentry Session Replay gravava sessão inteira
-- (rrweb) sem opt-in do produtor. O masking padrão do replayIntegration()
-- já mascara texto/mídia por padrão, mas isso não substitui consentimento
-- explícito para LGPD — o produtor precisa poder dizer sim ou não, e essa
-- decisão precisa sobreviver entre dispositivos (por isso persistida em
-- profiles, não em localStorage).
--
-- NULL = ainda não perguntado (banner de consentimento aparece).
-- true  = aceitou; false = recusou explicitamente. Nos dois casos
-- gravados, o banner não aparece mais.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS consentimento_replay_sessao BOOLEAN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS consentimento_replay_sessao_em TIMESTAMPTZ;

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
