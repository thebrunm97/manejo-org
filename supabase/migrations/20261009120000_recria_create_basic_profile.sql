-- Recria public.create_basic_profile (DT-58, onboarding pelo WhatsApp).
--
-- A migration 20260824130000_create_basic_profile_rpc consta como aplicada em
-- supabase_migrations.schema_migrations, mas a função NÃO existe em produção
-- (verificado em 2026-10-09: PostgREST PGRST202 "Could not find the function
-- public.create_basic_profile(p_nome, p_user_id)"). Todo cadastro novo pelo
-- WhatsApp falhava no SIM de confirmação.
--
-- Diferença em relação à versão original: preenche profiles.telefone a partir
-- de auth.users.phone quando estiver vazio. O trigger handle_new_user só copia
-- o telefone de raw_user_meta_data->>'telefone', e o bot localiza o produtor
-- por profiles.telefone — sem isto, o perfil nasceria "invisível" para o bot.

CREATE OR REPLACE FUNCTION public.create_basic_profile(
  p_user_id UUID,
  p_nome TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  SELECT u.phone INTO v_phone FROM auth.users u WHERE u.id = p_user_id;

  INSERT INTO public.profiles (id, nome, role, telefone)
  VALUES (p_user_id, p_nome, 'user', NULLIF(v_phone, ''))
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome,
      telefone = COALESCE(public.profiles.telefone, EXCLUDED.telefone);

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Só o backend do bot (service_role) chama: não há sessão de usuário no
-- momento do cadastro, logo nada a checar com auth.uid().
REVOKE ALL ON FUNCTION public.create_basic_profile(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_basic_profile(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_basic_profile(UUID, TEXT) TO service_role;
