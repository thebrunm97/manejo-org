-- Migration: Criação da tabela limites_seguranca para Guardrails Determinísticos
-- File: supabase/migrations/20260609_create_limites_seguranca.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.limites_seguranca (
    pmo_id bigint NOT NULL REFERENCES public.pmos(id) ON DELETE CASCADE,
    propriedade_id bigint NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
    limite_transacao numeric(12, 2) NOT NULL DEFAULT 50000.00,
    limite_manejo numeric(12, 2) NOT NULL DEFAULT 5000.00,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT limites_seguranca_pkey PRIMARY KEY (propriedade_id, pmo_id)
);

-- Habilita Row Level Security (RLS)
ALTER TABLE public.limites_seguranca ENABLE ROW LEVEL SECURITY;

-- Política RLS para SELECT: Admins ou Dono da propriedade
DROP POLICY IF EXISTS "Permitir select para admins e proprietarios" ON public.limites_seguranca;
CREATE POLICY "Permitir select para admins e proprietarios"
    ON public.limites_seguranca FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        ) OR EXISTS (
            SELECT 1 FROM public.propriedades
            WHERE propriedades.id = propriedade_id AND propriedades.user_id::text = auth.uid()::text
        )
    );

-- Política RLS para ALL (INSERT/UPDATE/DELETE): Admins ou Dono da propriedade
DROP POLICY IF EXISTS "Permitir all para admins e proprietarios" ON public.limites_seguranca;
CREATE POLICY "Permitir all para admins e proprietarios"
    ON public.limites_seguranca FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        ) OR EXISTS (
            SELECT 1 FROM public.propriedades
            WHERE propriedades.id = propriedade_id AND propriedades.user_id::text = auth.uid()::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        ) OR EXISTS (
            SELECT 1 FROM public.propriedades
            WHERE propriedades.id = propriedade_id AND propriedades.user_id::text = auth.uid()::text
        )
    );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_limites_seguranca_modtime ON public.limites_seguranca;
CREATE TRIGGER update_limites_seguranca_modtime
    BEFORE UPDATE ON public.limites_seguranca
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_update_timestamp();

COMMIT;
