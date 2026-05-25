-- ============================================================
-- MIGRATION: RPC Balanço IA (Módulo Financeiro)
-- File: supabase/migrations/20260526_create_rpc_balanco_ia.sql
-- Description: Agrega receitas, despesas e top 3 despesas para o CFO de Bolso (LLM)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_balanco_ia(
    p_propriedade_id BIGINT,
    p_ano INT,
    p_mes INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER -- Segurança RLS: Só permite ler dados onde auth.uid() tem acesso na transacoes_financeiras
AS $$
DECLARE
    v_receitas NUMERIC := 0;
    v_despesas NUMERIC := 0;
    v_saldo NUMERIC := 0;
    v_top_despesas JSONB := '[]'::JSONB;
    v_periodo TEXT;
BEGIN
    -- 1. Validar propriedade
    IF p_propriedade_id IS NULL THEN
        RAISE EXCEPTION 'A propriedade_id é obrigatória.';
    END IF;

    -- 2. Montar string de período amigável
    IF p_mes IS NOT NULL THEN
        v_periodo := to_char(to_date(p_mes::text || '/' || p_ano::text, 'MM/YYYY'), 'TMMonth YYYY');
    ELSE
        v_periodo := p_ano::text;
    END IF;

    -- 3. Calcular Receitas
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_receitas
    FROM transacoes_financeiras
    WHERE propriedade_id = p_propriedade_id
      AND tipo = 'RECEITA'
      AND extract(year from data_competencia) = p_ano
      AND (p_mes IS NULL OR extract(month from data_competencia) = p_mes);

    -- 4. Calcular Despesas
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_despesas
    FROM transacoes_financeiras
    WHERE propriedade_id = p_propriedade_id
      AND tipo = 'DESPESA'
      AND extract(year from data_competencia) = p_ano
      AND (p_mes IS NULL OR extract(month from data_competencia) = p_mes);

    -- 5. Calcular Saldo
    v_saldo := v_receitas - v_despesas;

    -- 6. Buscar Top 3 Despesas
    WITH RankedDespesas AS (
        SELECT 
            cf.nome AS categoria,
            SUM(tf.valor_total) AS valor
        FROM transacoes_financeiras tf
        LEFT JOIN categorias_financeiras cf ON tf.categoria_id = cf.id
        WHERE tf.propriedade_id = p_propriedade_id
          AND tf.tipo = 'DESPESA'
          AND extract(year from tf.data_competencia) = p_ano
          AND (p_mes IS NULL OR extract(month from tf.data_competencia) = p_mes)
        GROUP BY cf.nome
        ORDER BY valor DESC
        LIMIT 3
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'c', categoria,
            'v', valor
        )
    ), '[]'::JSONB)
    INTO v_top_despesas
    FROM RankedDespesas;

    -- 7. Retornar JSONB final minificado
    RETURN jsonb_build_object(
        'periodo', v_periodo,
        'receitas', v_receitas,
        'despesas', v_despesas,
        'saldo', v_saldo,
        'top_despesas', v_top_despesas
    );
END;
$$;
