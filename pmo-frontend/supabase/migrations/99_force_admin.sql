-- RODE ISSO NO SQL EDITOR DO SUPABASE
-- Isso vai garantir que seu usuário tenha o cargo de admin

-- 1. Verifica se a coluna role existe, se não, cria (caso a migration 04 tenha falhado)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'user';
    END IF;
END $$;

-- 2. Atualiza seu usuário específico para admin
-- Substitua o email se não for este, mas peguei dos logs anteriores
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'brunno.m.soares@gmail.com');

-- 3. Confirmação (Vai mostrar o resultado abaixo)
SELECT email, id FROM auth.users WHERE email = 'brunno.m.soares@gmail.com';
SELECT * FROM public.profiles WHERE role = 'admin';
