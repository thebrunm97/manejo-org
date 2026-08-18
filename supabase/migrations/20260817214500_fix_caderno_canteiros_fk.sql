-- Fix Schema Drift: caderno_campo_canteiros missing canteiro_id and FK
ALTER TABLE public.caderno_campo_canteiros 
ADD COLUMN IF NOT EXISTS canteiro_id uuid;

ALTER TABLE public.caderno_campo_canteiros 
DROP CONSTRAINT IF EXISTS caderno_campo_canteiros_canteiro_id_fkey;

ALTER TABLE public.caderno_campo_canteiros 
ADD CONSTRAINT caderno_campo_canteiros_canteiro_id_fkey 
FOREIGN KEY (canteiro_id) REFERENCES public.canteiros(id) ON DELETE CASCADE;
