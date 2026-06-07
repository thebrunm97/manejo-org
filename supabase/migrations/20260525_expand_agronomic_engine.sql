-- Migration: Expand Agronomic Engine with Corn (Grain and Silage) and Fuzzy matching
-- Created at: 2026-05-25

-- 1. Insert seed data for Milho Grão and Milho Silagem
INSERT INTO public.ref_cultura_extracao 
    (cultura, produtividade_referencia_t_ha, extracao_n_kg_t, extracao_p2o5_kg_t, extracao_k2o_kg_t, fonte_referencia, ativo)
VALUES 
    ('Milho Grão', 8.0, 20.0, 8.0, 20.0, 'SBCS - Limiar de Referência (Manual de Adubação)', true),
    ('Milho Silagem', 35.0, 4.0, 1.5, 4.5, 'SBCS - Limiar de Referência (Manual de Adubação - Massa Verde)', true)
ON CONFLICT (cultura, produtividade_referencia_t_ha) DO NOTHING;

-- 2. Update the RPC function to support fuzzy wildcard ILIKE matching
CREATE OR REPLACE FUNCTION public.calcular_balanco_nutricional(
    p_cultura text,
    p_meta_t_ha numeric,
    p_adubo_nome text
)
RETURNS json AS $$
DECLARE
    v_extracao RECORD;
    v_adubo RECORD;
    v_demanda_n_kg numeric;
    v_n_disponivel_kg numeric;
    v_dose_recomendada_kg numeric;
    v_fornecimento_p_kg numeric;
    v_fornecimento_k_kg numeric;
BEGIN
    -- Busque a extração da cultura informada usando busca por termo parcial
    SELECT * INTO v_extracao 
    FROM public.ref_cultura_extracao 
    WHERE (cultura ILIKE '%' || p_cultura || '%' OR p_cultura ILIKE '%' || cultura || '%')
      AND ativo = true
    ORDER BY id ASC LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cultura não encontrada: %', p_cultura;
    END IF;

    -- Busque os teores do adubo informado usando busca por termo parcial
    SELECT * INTO v_adubo
    FROM public.ref_adubos_organicos
    WHERE (nome ILIKE '%' || p_adubo_nome || '%' OR p_adubo_nome ILIKE '%' || nome || '%')
      AND ativo = true
    ORDER BY id ASC LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Adubo não encontrado: %', p_adubo_nome;
    END IF;

    -- Calcule a Demanda de N em kg: p_meta_t_ha * extracao_n_kg_t
    v_demanda_n_kg := p_meta_t_ha * v_extracao.extracao_n_kg_t;

    -- Calcule o N disponível por 1 tonelada de adubo
    -- Em 1 kg de adubo = (n_total_percentual / 100) * taxa_liberacao_n_ciclo1
    v_n_disponivel_kg := (v_adubo.n_total_percentual / 100.0) * v_adubo.taxa_liberacao_n_ciclo1;

    -- Se o adubo não tem N para liberar
    IF v_n_disponivel_kg <= 0 THEN
        RAISE EXCEPTION 'Adubo tem 0 de N disponível: %', p_adubo_nome;
    END IF;

    -- Calcule a dose recomendada do adubo em kg para bater a meta de N e Arredonde para inteiro
    v_dose_recomendada_kg := ROUND(v_demanda_n_kg / v_n_disponivel_kg);

    -- Calcule o quanto essa dose de adubo vai fornecer de P e K reais no ciclo 1
    v_fornecimento_p_kg := v_dose_recomendada_kg * (v_adubo.p2o5_total_percentual / 100.0) * v_adubo.taxa_liberacao_p_ciclo1;
    v_fornecimento_k_kg := v_dose_recomendada_kg * (v_adubo.k2o_total_percentual / 100.0) * v_adubo.taxa_liberacao_k_ciclo1;

    -- Retorne um JSON
    RETURN json_build_object(
        'dose_recomendada_kg', v_dose_recomendada_kg,
        'demanda_n_kg', v_demanda_n_kg,
        'fornecimento_p_kg', v_fornecimento_p_kg,
        'fornecimento_k_kg', v_fornecimento_k_kg,
        'cultura_encontrada', v_extracao.cultura,
        'adubo_encontrado', v_adubo.nome
    );
END;
$$ LANGUAGE plpgsql;
