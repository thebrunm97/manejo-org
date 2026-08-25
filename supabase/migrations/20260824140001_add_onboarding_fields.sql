-- Migration: Add Onboarding Fields
-- Created at: 2026-08-24

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tipo_perfil TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS culturas_interesse TEXT[];

ALTER TABLE public.propriedades ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.propriedades ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- As table 'talhoes' already has 'modalidade_producao' we don't need to add it there.
