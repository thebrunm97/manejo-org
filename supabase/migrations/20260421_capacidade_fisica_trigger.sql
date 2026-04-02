-- Migration: Phase 04 - Slice 3 (Physical Capacity Guard)
-- Created at: 2026-04-01

-- 1. Create Reference Table
CREATE TABLE IF NOT EXISTS public.referencia_agronomica (
    cultura TEXT PRIMARY KEY,
    produtividade_kg_ha NUMERIC NOT NULL
);

-- 2. Insert Default Data
INSERT INTO public.referencia_agronomica (cultura, produtividade_kg_ha)
VALUES 
    ('cenoura', 30000),
    ('abóbora', 15000),
    ('alface', 20000),
    ('tomate', 40000),
    ('mandioca', 12000)
ON CONFLICT (cultura) DO UPDATE SET produtividade_kg_ha = EXCLUDED.produtividade_kg_ha;

-- 3. Update Function
CREATE OR REPLACE FUNCTION public.check_capacidade_cota()
RETURNS TRIGGER AS $$
DECLARE
    v_area_total_ha NUMERIC;
    v_cultura TEXT;
    v_produtividade_kg_ha NUMERIC;
    v_capacidade_maxima NUMERIC;
BEGIN
    -- 1. Get Property Area
    SELECT area_total_ha INTO v_area_total_ha 
    FROM public.propriedades 
    WHERE id = NEW.propriedade_id;

    -- 2. Get Demand Crop
    SELECT cultura INTO v_cultura 
    FROM public.demandas_coletivas 
    WHERE id = NEW.demanda_id;

    -- 3. Get Productivity Reference with Fallback
    SELECT produtividade_kg_ha INTO v_produtividade_kg_ha 
    FROM public.referencia_agronomica 
    WHERE LOWER(cultura) = LOWER(v_cultura);

    IF v_produtividade_kg_ha IS NULL THEN
        v_produtividade_kg_ha := 50000; -- High Fallback to not block new crops
    END IF;

    -- 4. Calculate Max Capacity
    v_capacidade_maxima := COALESCE(v_area_total_ha, 0) * v_produtividade_kg_ha;

    -- 5. Validate
    IF NEW.quantidade_assumida > v_capacidade_maxima AND v_capacidade_maxima > 0 THEN
        RAISE EXCEPTION 'ERRO_CAPACIDADE: Limite da propriedade é % kg.', v_capacidade_maxima;
    END IF;

    IF NEW.quantidade_assumida <= 0 THEN
        RAISE EXCEPTION 'A quantidade assumida deve ser maior que zero.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
