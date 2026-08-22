-- Seed minimal para Staging
-- Insere um perfil e propriedade de teste se necessário.

INSERT INTO public.profiles (id, user_id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Admin Staging', 'admin')
ON CONFLICT DO NOTHING;
