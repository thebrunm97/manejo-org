-- ============================================================
-- MIGRATION: Motor Analítico Financeiro - Slice 1
-- RPCs: get_dre_mensal, get_lucro_por_talhao
-- ============================================================

-- ============================================================
-- 1. ÍNDICES DE PERFORMANCE
-- ============================================================
-- Índices em transacoes_financeiras para filtro por propriedade, data e tipo
CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_propriedade_id
    ON transacoes_financeiras(propriedade_id);

CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_competencia
    ON transacoes_financeiras(data_competencia);

CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_tipo
    ON transacoes_financeiras(tipo);

-- Índice composto para a query mais comum: filtrar por propriedade + ano
CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_prop_comp
    ON transacoes_financeiras(propriedade_id, data_competencia, tipo);

-- Índice em transacao_alocacoes para joins por talhão
CREATE INDEX IF NOT EXISTS idx_transacao_alocacoes_talhao_id
    ON transacao_alocacoes(talhao_id);

CREATE INDEX IF NOT EXISTS idx_transacao_alocacoes_transacao_id
    ON transacao_alocacoes(transacao_id);


-- ============================================================
-- 2. RPC: get_dre_mensal
-- Retorna DRE consolidado mês a mês para uma propriedade e ano.
-- Usa generate_series para garantir os 12 meses, mesmo sem transações.
-- Respeita RLS: o usuário só acessa transações linkadas à sua propriedade.
-- ============================================================
CREATE OR REPLACE FUNCTION get_dre_mensal(
    p_propriedade_id BIGINT,
    p_ano            INTEGER
)
RETURNS TABLE(
    mes      TEXT,
    receitas NUMERIC,
    despesas NUMERIC,
    lucro    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER -- Respeita o RLS do usuário chamador
AS $$
    WITH serie AS (
        -- Garante os 12 meses independente de transações
        SELECT gs::INTEGER AS num_mes,
               TO_CHAR(TO_DATE(gs::TEXT, 'MM'), 'Mon') AS mes_abrev
        FROM generate_series(1, 12) AS gs
    ),
    agreg AS (
        SELECT
            EXTRACT(MONTH FROM data_competencia)::INTEGER AS num_mes,
            SUM(CASE WHEN tipo = 'RECEITA' THEN valor_total ELSE 0 END) AS receitas,
            SUM(CASE WHEN tipo = 'DESPESA' THEN valor_total ELSE 0 END) AS despesas
        FROM transacoes_financeiras
        WHERE propriedade_id = p_propriedade_id
          AND EXTRACT(YEAR FROM data_competencia) = p_ano
          AND status_pagamento = 'PAGO'
        GROUP BY EXTRACT(MONTH FROM data_competencia)::INTEGER
    )
    SELECT
        s.mes_abrev                                                          AS mes,
        COALESCE(a.receitas, 0)                                             AS receitas,
        COALESCE(a.despesas, 0)                                             AS despesas,
        COALESCE(a.receitas, 0) - COALESCE(a.despesas, 0)                  AS lucro
    FROM serie s
    LEFT JOIN agreg a ON a.num_mes = s.num_mes
    ORDER BY s.num_mes;
$$;


-- ============================================================
-- 3. RPC: get_lucro_por_talhao
-- Retorna o resultado consolidado por talhão para uma propriedade e ano.
-- Utiliza transacao_alocacoes para decompor o valor alocado por talhão.
-- Respeita RLS: o usuário só acessa dados de seus talhões.
-- ============================================================
CREATE OR REPLACE FUNCTION get_lucro_por_talhao(
    p_propriedade_id BIGINT,
    p_ano            INTEGER
)
RETURNS TABLE(
    talhao_id   BIGINT,
    talhao_nome TEXT,
    cor         TEXT,
    receitas    NUMERIC,
    despesas    NUMERIC,
    lucro       NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER -- Respeita o RLS do usuário chamador
AS $$
    SELECT
        t.id                                                            AS talhao_id,
        t.nome                                                          AS talhao_nome,
        COALESCE(t.cor, '#16a34a')                                      AS cor,
        COALESCE(SUM(CASE WHEN tf.tipo = 'RECEITA' THEN ta.valor_alocado ELSE 0 END), 0) AS receitas,
        COALESCE(SUM(CASE WHEN tf.tipo = 'DESPESA' THEN ta.valor_alocado ELSE 0 END), 0) AS despesas,
        COALESCE(SUM(CASE WHEN tf.tipo = 'RECEITA' THEN ta.valor_alocado ELSE -ta.valor_alocado END), 0) AS lucro
    FROM talhoes t
    INNER JOIN transacao_alocacoes ta ON ta.talhao_id = t.id
    INNER JOIN transacoes_financeiras tf ON tf.id = ta.transacao_id
    WHERE t.propriedade_id = p_propriedade_id
      AND EXTRACT(YEAR FROM tf.data_competencia) = p_ano
      AND tf.status_pagamento = 'PAGO'
    GROUP BY t.id, t.nome, t.cor
    ORDER BY lucro DESC;
$$;


-- ============================================================
-- 4. GRANT: permissão de execução para usuários autenticados
-- ============================================================
GRANT EXECUTE ON FUNCTION get_dre_mensal(BIGINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lucro_por_talhao(BIGINT, INTEGER) TO authenticated;
