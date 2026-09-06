-- Migration to fix local schema drift for frontend AuthContext
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS propriedade_ativa_id bigint REFERENCES public.propriedades(id) ON DELETE SET NULL;

-- Fix missing FK for pmo_ativo_id which is needed by PostgREST to expand pmos(*)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pmo_ativo_id_fkey;
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_pmo_ativo_id_fkey FOREIGN KEY (pmo_ativo_id) REFERENCES public.pmos(id) ON DELETE SET NULL;
