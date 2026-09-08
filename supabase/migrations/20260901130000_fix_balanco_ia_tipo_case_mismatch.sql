-- ============================================================
-- MIGRATION: Corrige rpc_get_balanco_ia (DT-69)
-- Description: rpc_registrar_transacao_com_rateio passou a normalizar
--   `tipo` para minúsculo com LOWER() a partir de
--   20260816000000_add_idempotency_to_mutations.sql, mas rpc_get_balanco_ia
--   (criada em 20260526060000_create_rpc_balanco_ia.sql) nunca foi
--   atualizada — seguia comparando `tipo = 'DESPESA'`/`tipo = 'RECEITA'`
--   maiúsculo, que não bate com nenhuma linha gravada desde então. Efeito
--   em produção: consultar_balanco_financeiro (a ferramenta "CFO de bolso")
--   retorna receitas/despesas/saldo sempre zerados, silenciosamente, desde
--   ~2026-08-16. Achado ao escrever o teste de isolamento real do DT-66.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_balanco_ia(
    p_propriedade_id BIGINT,
    p_ano INT,
    p_mes INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_receitas NUMERIC := 0;
    v_despesas NUMERIC := 0;
    v_saldo NUMERIC := 0;
    v_top_despesas JSONB := '[]'::JSONB;
    v_periodo TEXT;
BEGIN
    IF p_propriedade_id IS NULL THEN
        RAISE EXCEPTION 'A propriedade_id é obrigatória.';
    END IF;

    IF p_mes IS NOT NULL THEN
        v_periodo := to_char(to_date(p_mes::text || '/' || p_ano::text, 'MM/YYYY'), 'TMMonth YYYY');
    ELSE
        v_periodo := p_ano::text;
    END IF;

    -- Comparação por LOWER(tipo) — o valor gravado é sempre minúsculo desde
    -- que rpc_registrar_transacao_com_rateio passou a normalizar com LOWER()
    -- (20260816000000_add_idempotency_to_mutations.sql), mas LOWER() aqui
    -- também cobre qualquer linha antiga gravada em maiúsculo.
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_receitas
    FROM transacoes_financeiras
    WHERE propriedade_id = p_propriedade_id
      AND LOWER(tipo) = 'receita'
      AND extract(year from data_competencia) = p_ano
      AND (p_mes IS NULL OR extract(month from data_competencia) = p_mes);

    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_despesas
    FROM transacoes_financeiras
    WHERE propriedade_id = p_propriedade_id
      AND LOWER(tipo) = 'despesa'
      AND extract(year from data_competencia) = p_ano
      AND (p_mes IS NULL OR extract(month from data_competencia) = p_mes);

    v_saldo := v_receitas - v_despesas;

    WITH RankedDespesas AS (
        SELECT
            cf.nome AS categoria,
            SUM(tf.valor_total) AS valor
        FROM transacoes_financeiras tf
        LEFT JOIN categorias_financeiras cf ON tf.categoria_id = cf.id
        WHERE tf.propriedade_id = p_propriedade_id
          AND LOWER(tf.tipo) = 'despesa'
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

    RETURN jsonb_build_object(
        'periodo', v_periodo,
        'receitas', v_receitas,
        'despesas', v_despesas,
        'saldo', v_saldo,
        'top_despesas', v_top_despesas
    );
END;
$$;
