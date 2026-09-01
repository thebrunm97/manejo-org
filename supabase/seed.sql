-- Seed minimal para Staging
-- Insere um usuário de auth e o perfil admin correspondente, se necessário.
-- profiles.id referencia auth.users(id) (ver migration 20260401_create_profiles.sql),
-- por isso o usuário de auth precisa existir antes do profile.

INSERT INTO auth.users (id, aud, role, email)
VALUES ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@staging.local')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, nome, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'Admin Staging', 'admin')
ON CONFLICT DO NOTHING;
