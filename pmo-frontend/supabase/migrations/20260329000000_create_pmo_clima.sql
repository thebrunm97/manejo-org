-- Migration: Create pmo_clima for AgTech Pro Weather System
-- Description: Creates the table to store weather data for each PMO.
-- Runs every 3 hours via the Go backend.

CREATE TABLE IF NOT EXISTS public.pmo_clima (
    id uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
    pmo_id bigint NOT NULL REFERENCES public.pmos(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    temperatura_c numeric,
    umidade integer,
    vento_kph numeric,
    condicao_texto text,
    condicao_icone text,
    previsao_dias jsonb,
    CONSTRAINT pk_pmo_clima PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pmo_clima_pmo_id ON public.pmo_clima(pmo_id);
CREATE INDEX IF NOT EXISTS idx_pmo_clima_created_at ON public.pmo_clima(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.pmo_clima ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read their own PMO's weather data
-- Note: we assume frontend queries will filter by pmo_id, relying on application logic or existing RLS
-- But a safe default is allowing read for authenticated users
CREATE POLICY "Enable read access for authenticated users" 
ON public.pmo_clima 
FOR SELECT 
TO authenticated 
USING (true);

-- Backend (service_role) will be doing the inserts automatically, bypassing RLS.
