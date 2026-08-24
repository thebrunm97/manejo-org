-- Migration: RPC create_basic_profile para onboarding progressivo (DT-58, Fatia 2)
-- Objetivo: o produtor inicia o cadastro pelo WhatsApp só com o nome.
-- Propriedade, área e talhão ficam para uma etapa de complementação futura,
-- que continua usando setup_initial_profile (não alterada por esta migration).

CREATE OR REPLACE FUNCTION public.create_basic_profile(
  p_user_id UUID,
  p_nome TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, role)
  VALUES (p_user_id, p_nome, 'user')
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Diferente de setup_initial_profile (chamável por anon/authenticated via
-- PostgREST, daí a checagem de auth.uid() lá dentro), esta função só é
-- chamada pelo backend do bot logo após criar o usuário em auth.users pela
-- Admin API — não existe sessão de usuário para checar nesse momento. A
-- proteção aqui é restringir a execução à service_role.
REVOKE ALL ON FUNCTION public.create_basic_profile(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_basic_profile(UUID, TEXT) TO service_role;
