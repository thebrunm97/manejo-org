-- Migration: Adição de colunas de créditos bônus na tabela profiles
-- File: supabase/migrations/20260610_add_bonus_credits_to_profiles.sql

BEGIN;

-- Adiciona a coluna bonus_credits se não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_credits integer NOT NULL DEFAULT 0;

-- Adiciona a coluna bonus_expires_at se não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_expires_at timestamp with time zone;

-- Concede o bônus de 50 créditos válidos por 7 dias ao usuário Gustavo Carrijo
UPDATE public.profiles
SET bonus_credits = 50,
    bonus_expires_at = now() + interval '7 days'
WHERE id = 'f2b8befc-27ca-4f1c-ba86-762ef10e0c67';

COMMIT;
