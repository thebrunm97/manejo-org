-- Fixture dos testes E2E do backend (e2e/*_test.go, build tag e2e).
--
-- Produtor fictício com telefone 5511999999999, propriedade, PMO 9999 e
-- talhão — o que e2e_utils.go (TestPMOID, TestPhone) espera. Idempotente:
-- pode rodar de novo em cima de um banco que já tem o fixture.
--
-- Uso (Supabase local, `supabase start`):
--   docker exec -i supabase_db_manejo-org-app-clean psql -U postgres -d postgres < pmo-bot-go/e2e/fixture.sql
-- Em staging, rodar o mesmo arquivo pelo SQL editor / MCP.

DO $$
DECLARE
  v_user uuid := '00000000-0000-4000-8000-00000000e2e0';
  v_prop bigint;
BEGIN
  -- O trigger check_profile_pmo_ativo_ownership só libera trocar
  -- pmo_ativo_id para o dono via JWT ou para service_role; aqui não há JWT.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2e-produtor@manejo.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;

  -- O trigger on_auth_user_created cria o profile; o upsert cobre bancos
  -- sem o trigger.
  INSERT INTO public.profiles (id, nome, telefone)
  VALUES (v_user, 'Produtor E2E', '5511999999999')
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone;

  SELECT id INTO v_prop FROM public.propriedades WHERE user_id = v_user ORDER BY id LIMIT 1;
  IF v_prop IS NULL THEN
    INSERT INTO public.propriedades (nome, user_id) VALUES ('Sítio E2E', v_user) RETURNING id INTO v_prop;
  END IF;

  INSERT INTO public.pmos (id, user_id, propriedade_id, nome_identificador, status, form_data)
  VALUES (9999, v_user, v_prop, 'PMO E2E', 'ativo', '{}')
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, propriedade_id = EXCLUDED.propriedade_id;

  IF NOT EXISTS (SELECT 1 FROM public.talhoes WHERE pmo_id = 9999) THEN
    INSERT INTO public.talhoes (pmo_id, user_id, propriedade_id, nome, area_ha)
    VALUES (9999, v_user, v_prop, 'Talhão Principal', 1);
  END IF;

  -- plan_tier 'pro': sem teto diário de créditos (supabase/quota.go) — a
  -- suíte roda várias vezes por dia e o plano free esgotava ("Limite esgotado").
  UPDATE public.profiles SET pmo_ativo_id = 9999, propriedade_ativa_id = v_prop, plan_tier = 'pro' WHERE id = v_user;
END
$$;
