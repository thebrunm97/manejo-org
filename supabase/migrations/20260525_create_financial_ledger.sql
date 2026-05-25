-- ============================================================
-- MIGRATION: Módulo Financeiro e de Custos - Slice 1
-- File: supabase/migrations/20260525_create_financial_ledger.sql
-- Description: Criação das tabelas financeiras (Ledger/Rateios),
--              definição de RLS e migração dos custos legados de caderno_campo.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabelas de Fundação (Ledger Pattern)
-- ============================================================

-- 1.1 Categorias Financeiras
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    descricao text,
    pmo_id bigint REFERENCES public.pmos(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Deduplica antes de tentar adicionar a restrição UNIQUE
DELETE FROM public.categorias_financeiras a 
USING public.categorias_financeiras b 
WHERE a.id < b.id AND a.nome = b.nome;

-- Adiciona a constraint de UNIQUE no nome de forma segura
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'categorias_financeiras_nome_key'
    ) THEN
        ALTER TABLE public.categorias_financeiras 
            ADD CONSTRAINT categorias_financeiras_nome_key UNIQUE (nome);
    END IF;
END $$;

-- 1.2 Transações Financeiras (O Fato)
CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id bigint REFERENCES public.pmos(id) ON DELETE SET NULL,
    propriedade_id bigint NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
    categoria_id uuid REFERENCES public.categorias_financeiras(id),
    tipo text NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    valor_total numeric(12,2) NOT NULL DEFAULT 0,
    data_competencia date NOT NULL DEFAULT CURRENT_DATE,
    data_transacao date NOT NULL DEFAULT CURRENT_DATE,
    fornecedor text,
    fornecedor_cliente text,
    nota_fiscal text,
    status_pagamento text DEFAULT 'PAGO' CHECK (status_pagamento IN ('PAGO', 'PENDENTE', 'PROGRAMADO')),
    observacao text,
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- 1.3 Alocações (O Rateio)
CREATE TABLE IF NOT EXISTS public.transacao_alocacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transacao_id uuid NOT NULL REFERENCES public.transacoes_financeiras(id) ON DELETE CASCADE,
    talhao_id bigint REFERENCES public.talhoes(id) ON DELETE CASCADE,
    caderno_campo_id uuid REFERENCES public.caderno_campo(id) ON DELETE SET NULL,
    valor_alocado numeric(12,2) NOT NULL DEFAULT 0,
    percentual_alocado numeric(5,2) DEFAULT 100.00,
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Índices de Performance (Se não criados na migration de RPCs)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON public.transacoes_financeiras(user_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_pmo_id ON public.transacoes_financeiras(pmo_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_propriedade_id ON public.transacoes_financeiras(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_competencia ON public.transacoes_financeiras(data_competencia);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON public.transacoes_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_prop_comp ON public.transacoes_financeiras(propriedade_id, data_competencia, tipo);
CREATE INDEX IF NOT EXISTS idx_alocacoes_transacao_id ON public.transacao_alocacoes(transacao_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_talhao_id ON public.transacao_alocacoes(talhao_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_caderno_campo_id ON public.transacao_alocacoes(caderno_campo_id);

-- ============================================================
-- 3. Seed: Categorias Base
-- ============================================================
INSERT INTO public.categorias_financeiras (nome, tipo, descricao) VALUES
('Insumos', 'DESPESA', 'Compra de sementes, mudas, fertilizantes e defensivos'),
('Mão de Obra', 'DESPESA', 'Pagamento de funcionários, diaristas e serviços externos'),
('Venda de Produção', 'RECEITA', 'Receita proveniente da comercialização de produtos'),
('Manutenção', 'DESPESA', 'Reparo de equipamentos, ferramentas e instalações'),
('Logística/Frete', 'DESPESA', 'Custos de transporte e entrega'),
('Energia/Água', 'DESPESA', 'Contas de concessionárias e insumos básicos'),
('Outros', 'DESPESA', 'Despesas diversas não classificadas'),
('Outras Receitas', 'RECEITA', 'Receitas diversas (ex: venda de ativos, subvenções)')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacao_alocacoes ENABLE ROW LEVEL SECURITY;

-- 4.1 Categorias: Leitura para todos autenticados. Escrita apenas para administradores ou se customizadas.
CREATE POLICY "Permitir leitura de categorias para todos autenticados" 
ON public.categorias_financeiras FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Administradores ou donos do PMO criam categorias"
ON public.categorias_financeiras FOR ALL
TO authenticated
USING (
    pmo_id IS NULL OR 
    pmo_id IN (SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4.2 Transações: Restrição por pmo_id (ativo do perfil) ou criador.
CREATE POLICY "Usuários gerenciam transações do seu PMO ativo"
ON public.transacoes_financeiras FOR ALL
TO authenticated
USING (
    pmo_id IN (SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid()) OR 
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    pmo_id IN (SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid()) OR 
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4.3 Alocações: Herdadas da transação pai.
CREATE POLICY "Usuários gerenciam alocações das suas transações"
ON public.transacao_alocacoes FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.transacoes_financeiras t
        WHERE t.id = transacao_id 
          AND (t.pmo_id IN (SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid()) OR t.user_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.transacoes_financeiras t
        WHERE t.id = transacao_id 
          AND (t.pmo_id IN (SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid()) OR t.user_id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 5. Migração de Dados (Soft-Deprecation)
-- ============================================================
-- Migra os dados antigos de caderno_campo onde valor_total está presente
-- alocando 100% do custo/receita ao talhão associado.
WITH raw_data AS (
    SELECT 
        gen_random_uuid() AS tx_id,
        cc.id AS cc_id,
        cc.pmo_id,
        COALESCE(cc.propriedade_id, (SELECT propriedade_id FROM public.pmos WHERE id = cc.pmo_id)) AS prop_id,
        (SELECT id FROM public.categorias_financeiras 
         WHERE nome = (CASE WHEN cc.tipo_atividade = 'Venda' THEN 'Venda de Produção'
                            WHEN cc.tipo_atividade IN ('Compra', 'Compra/Aquisição') THEN 'Insumos'
                            ELSE 'Outros' END) LIMIT 1) AS cat_id,
        (CASE WHEN cc.tipo_atividade = 'Venda' THEN 'RECEITA' ELSE 'DESPESA' END) AS tx_tipo,
        cc.valor_total,
        cc.data_registro,
        cc.fornecedor,
        cc.nota_fiscal,
        COALESCE(cc.user_id, (SELECT user_id FROM public.pmos WHERE id = cc.pmo_id)) AS u_id,
        cc.created_at,
        cc.talhao_id
    FROM public.caderno_campo cc
    WHERE cc.valor_total IS NOT NULL 
      AND cc.valor_total > 0
      -- Garante que conseguimos mapear a propriedade associada
      AND (cc.propriedade_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.pmos WHERE id = cc.pmo_id AND propriedade_id IS NOT NULL))
),
ins_tx AS (
    INSERT INTO public.transacoes_financeiras (
        id,
        pmo_id,
        propriedade_id,
        categoria_id,
        tipo,
        valor_total,
        data_competencia,
        data_transacao,
        fornecedor,
        fornecedor_cliente,
        nota_fiscal,
        user_id,
        created_at
    )
    SELECT 
        tx_id,
        pmo_id,
        prop_id,
        cat_id,
        tx_tipo,
        valor_total,
        data_registro,
        data_registro,
        fornecedor,
        fornecedor,
        nota_fiscal,
        u_id,
        created_at
    FROM raw_data
)
INSERT INTO public.transacao_alocacoes (
    transacao_id,
    caderno_campo_id,
    talhao_id,
    valor_alocado,
    percentual_alocado
)
SELECT 
    tx_id,
    cc_id,
    talhao_id,
    valor_total,
    100.00
FROM raw_data;

-- ============================================================
-- 6. Documentação / Comentários de Depreciação
-- ============================================================
COMMENT ON COLUMN public.caderno_campo.valor_total IS 'DEPRECATED: Use a tabela transacoes_financeiras com vínculo em transacao_alocacoes.';
COMMENT ON COLUMN public.caderno_campo.nota_fiscal IS 'DEPRECATED: Use a tabela transacoes_financeiras.';
COMMENT ON COLUMN public.caderno_campo.fornecedor IS 'DEPRECATED: Use a tabela transacoes_financeiras.';

COMMIT;
