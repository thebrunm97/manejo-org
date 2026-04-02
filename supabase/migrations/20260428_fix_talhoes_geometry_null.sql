-- Migration: Allow NULL geometry in talhoes
-- Date: 2026-04-28

-- Permite que talhões sejam criados sem o desenho inicial do mapa
ALTER TABLE public.talhoes ALTER COLUMN geometry DROP NOT NULL;
