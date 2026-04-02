-- 20260411000000_finance_ledger_base.sql
-- Épico: Módulo Financeiro e de Custos
-- Fase 01: Fundação de Dados (Ledger Pattern)

-- 1. Categorias Financeiras
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    descricao text,
    created_at timestamptz DEFAULT now()
);

-- Inserindo Categorias Base
INSERT INTO public.categorias_financeiras (nome, tipo, descricao) VALUES
('Insumos', 'DESPESA', 'Compra de sementes, mudas, fertilizantes e defensivos'),
('Mão de Obra', 'DESPESA', 'Pagamento de funcionários, diaristas e serviços externos'),
('Venda de Produção', 'RECEITA', 'Receita proveniente da comercialização de produtos'),
('Manutenção', 'DESPESA', 'Reparo de equipamentos, ferramentas e instalações'),
('Logística/Frete', 'DESPESA', 'Custos de transporte e entrega'),
('Energia/Água', 'DESPESA', 'Contas de concessionárias e insumos básicos'),
('Outros', 'DESPESA', 'Despesas diversas não classificadas'),
('Outras Receitas', 'RECEITA', 'Receitas diversas (ex: venda de ativos, subvenções)')
ON CONFLICT DO NOTHING;

-- 2. Transações Financeiras (O Fato)
CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    propriedade_id bigint NOT NULL REFERENCES public.propriedades(id) ON DELETE CASCADE,
    pmo_id bigint REFERENCES public.pmos(id) ON DELETE SET NULL,
    categoria_id uuid REFERENCES public.categorias_financeiras(id),
    tipo text NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    valor_total numeric(12,2) NOT NULL DEFAULT 0,
    data_competencia date NOT NULL DEFAULT CURRENT_DATE,
    fornecedor_cliente text,
    nota_fiscal text,
    status_pagamento text DEFAULT 'PAGO' CHECK (status_pagamento IN ('PAGO', 'PENDENTE', 'PROGRAMADO')),
    observacao text,
    created_at timestamptz DEFAULT now(),
    user_id uuid NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- 3. Alocações (O Rateio)
CREATE TABLE IF NOT EXISTS public.transacao_alocacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transacao_id uuid NOT NULL REFERENCES public.transacoes_financeiras(id) ON DELETE CASCADE,
    talhao_id bigint REFERENCES public.talhoes(id) ON DELETE CASCADE,
    caderno_campo_id uuid REFERENCES public.caderno_campo(id) ON DELETE SET NULL,
    valor_alocado numeric(12,2) NOT NULL DEFAULT 0,
    percentual_alocado numeric(5,2),
    created_at timestamptz DEFAULT now()
);

-- 4. Row Level Security (RLS)
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacao_alocacoes ENABLE ROW LEVEL SECURITY;

-- Políticas para categorias_financeiras (Leitura para todos autenticados)
CREATE POLICY "Permitir leitura de categorias para todos autenticados" 
ON public.categorias_financeiras FOR SELECT 
USING (auth.role() = 'authenticated');

-- Políticas para transacoes_financeiras
CREATE POLICY "Usuários podem ver suas próprias transações"
ON public.transacoes_financeiras FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias transações"
ON public.transacoes_financeiras FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem editar suas próprias transações"
ON public.transacoes_financeiras FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias transações"
ON public.transacoes_financeiras FOR DELETE
USING (auth.uid() = user_id);

-- Políticas para transacao_alocacoes (Vinculadas à transação pai)
CREATE POLICY "Usuários podem ver suas próprias alocações"
ON public.transacao_alocacoes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.transacoes_financeiras t
        WHERE t.id = transacao_id AND t.user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem inserir suas próprias alocações"
ON public.transacao_alocacoes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.transacoes_financeiras t
        WHERE t.id = transacao_id AND t.user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem editar suas próprias alocações"
ON public.transacao_alocacoes FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.transacoes_financeiras t
        WHERE t.id = transacao_id AND t.user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem deletar suas próprias alocações"
ON public.transacao_alocacoes FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.transacoes_financeiras t
        WHERE t.id = transacao_id AND t.user_id = auth.uid()
    )
);

-- Índices para performance
CREATE INDEX idx_transacoes_user_id ON public.transacoes_financeiras(user_id);
CREATE INDEX idx_transacoes_propriedade_id ON public.transacoes_financeiras(propriedade_id);
CREATE INDEX idx_alocacoes_transacao_id ON public.transacao_alocacoes(transacao_id);
CREATE INDEX idx_alocacoes_talhao_id ON public.transacao_alocacoes(talhao_id);
