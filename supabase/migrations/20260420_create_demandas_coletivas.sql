-- Migration: Phase 04 - Slice 1 (Collective Planning Foundation)
-- Created at: 2026-04-01

-- 1. Create Status Enums or Check Constraints
-- Using check constraints for simplicity in this slice unless requested otherwise.

-- 2. demandas_coletivas
CREATE TABLE IF NOT EXISTS public.demandas_coletivas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    cultura TEXT NOT NULL,
    unidade TEXT NOT NULL,
    quantidade_total NUMERIC NOT NULL CHECK (quantidade_total > 0),
    quantidade_assumida NUMERIC DEFAULT 0,
    preco_referencia NUMERIC,
    data_entrega DATE NOT NULL,
    status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_captacao', 'fechada', 'cancelada')),
    modalidade_exigida modalidade_producao_enum DEFAULT 'ORGANICO',
    criado_por UUID REFERENCES auth.users(id),
    cooperativa_id BIGINT -- Future use
);

-- 3. cotas_produtores
CREATE TABLE IF NOT EXISTS public.cotas_produtores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demanda_id UUID NOT NULL REFERENCES public.demandas_coletivas(id) ON DELETE CASCADE,
    propriedade_id BIGINT NOT NULL REFERENCES public.propriedades(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    quantidade_assumida NUMERIC NOT NULL,
    quantidade_entregue NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'entregue_parcial', 'entregue_total', 'cancelada')),
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (demanda_id, propriedade_id)
);

-- 4. cronograma_plantio (1:1 with cotas)
CREATE TABLE IF NOT EXISTS public.cronograma_plantio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cota_id UUID NOT NULL REFERENCES public.cotas_produtores(id) ON DELETE CASCADE UNIQUE,
    ciclo_dias_estimado INTEGER,
    data_plantio_recomendada DATE,
    data_alerta_whatsapp DATE,
    alerta_enviado BOOLEAN DEFAULT false,
    observacao_ia TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Trigger de Integridade (DMBOK)
CREATE OR REPLACE FUNCTION public.check_capacidade_cota()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantidade_assumida <= 0 THEN
        RAISE EXCEPTION 'A quantidade assumida deve ser maior que zero.';
    END IF;
    -- Note: Advanced logic for area x productivity will be implemented in Slice 2.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_capacidade_cota
BEFORE INSERT OR UPDATE ON public.cotas_produtores
FOR EACH ROW EXECUTE FUNCTION public.check_capacidade_cota();

-- 6. Enable RLS
ALTER TABLE public.demandas_coletivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotas_produtores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_plantio ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- demandas_coletivas
CREATE POLICY "Enable read access for all authenticated users" 
ON public.demandas_coletivas FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert/update/delete for admins only" 
ON public.demandas_coletivas FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- cotas_produtores
CREATE POLICY "Users can see their own cotas or as admin" 
ON public.cotas_produtores FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can manage their own cotas or as admin" 
ON public.cotas_produtores FOR ALL 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- cronograma_plantio
CREATE POLICY "Users can see their own cronogramas or as admin" 
ON public.cronograma_plantio FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.cotas_produtores 
    WHERE id = public.cronograma_plantio.cota_id AND user_id = auth.uid()
  ) OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Only bot/admin can manage cronogramas" 
ON public.cronograma_plantio FOR ALL 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
