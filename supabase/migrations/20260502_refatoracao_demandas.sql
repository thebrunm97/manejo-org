-- Migration: Refatoração Marketplace Interno B2B2C
-- Created at: 2026-04-02
-- File: 20260502_refatoracao_demandas.sql

BEGIN;

-- 1. Ajustes na tabela demandas_coletivas
-- Adicionando colunas necessárias e renomeando para clareza (opcional, mas seguindo a spec)
ALTER TABLE public.demandas_coletivas 
ADD COLUMN IF NOT EXISTS organizacao_id BIGINT REFERENCES public.organizacoes(id),
ADD COLUMN IF NOT EXISTS cultura_id UUID, -- Referência futura para tabela de produtos/culturas
ADD COLUMN IF NOT EXISTS volume_necessario NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS unidade_medida TEXT, -- kg, ton, sacas
ADD COLUMN IF NOT EXISTS data_limite_entrega DATE;

-- Migrar dados existentes se necessário (exemplo simplificado)
UPDATE public.demandas_coletivas 
SET volume_necessario = quantidade_total,
    unidade_medida = unidade,
    data_limite_entrega = data_entrega
WHERE volume_necessario = 0;

-- 2. Tabela demandas_intencoes (Nova)
-- Embora tenhamos cotas_produtores, o pedido pede explicitamente uma nova tabela ou fluxo. 
-- Vou criar demandas_intencoes conforme a Fase 1 da task para registrar o compromisso inicial.
CREATE TABLE IF NOT EXISTS public.demandas_intencoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demanda_id UUID NOT NULL REFERENCES public.demandas_coletivas(id) ON DELETE CASCADE,
    propriedade_id BIGINT NOT NULL REFERENCES public.propriedades(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    volume_ofertado NUMERIC NOT NULL CHECK (volume_ofertado > 0),
    status_intencao TEXT DEFAULT 'pendente' CHECK (status_intencao IN ('pendente', 'aceita', 'rejeitada')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Ajuste de RLS Policies

-- Habilitar RLS (já deve estar habilitado, mas garantindo)
ALTER TABLE public.demandas_coletivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandas_intencoes ENABLE ROW LEVEL SECURITY;

-- Limpar policies antigas de demandas_coletivas se necessário
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.demandas_coletivas;
DROP POLICY IF EXISTS "Enable insert/update/delete for admins only" ON public.demandas_coletivas;

-- Novas Policies: demandas_coletivas
-- Gestores podem gerenciar (ALL) demandas da sua organização
CREATE POLICY "Gestores podem gerenciar demandas da organizacao" 
ON public.demandas_coletivas 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.organizacao_membros om
    WHERE om.organizacao_id = public.demandas_coletivas.organizacao_id
    AND om.propriedade_id IN (SELECT id FROM public.propriedades WHERE user_id = auth.uid())
    AND om.role IN ('admin', 'gestor')
  ) OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Membros podem ler demandas da sua organização
CREATE POLICY "Membros podem ler demandas da organizacao" 
ON public.demandas_coletivas 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.organizacao_membros om
    WHERE om.organizacao_id = public.demandas_coletivas.organizacao_id
    AND om.propriedade_id IN (SELECT id FROM public.propriedades WHERE user_id = auth.uid())
  ) OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policies: demandas_intencoes
-- Produtores podem criar intenções
CREATE POLICY "Membros podem criar intencoes" 
ON public.demandas_intencoes 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizacao_membros om
    JOIN public.demandas_coletivas dc ON dc.organizacao_id = om.organizacao_id
    WHERE dc.id = demanda_id
    AND om.propriedade_id = public.demandas_intencoes.propriedade_id
    AND om.propriedade_id IN (SELECT id FROM public.propriedades WHERE user_id = auth.uid())
  )
);

-- Produtores podem ver suas próprias intenções
CREATE POLICY "Usuarios podem ver proprias intencoes" 
ON public.demandas_intencoes 
FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.organizacao_membros om
    JOIN public.demandas_coletivas dc ON dc.organizacao_id = om.organizacao_id
    WHERE dc.id = demanda_id
    AND om.role IN ('admin', 'gestor')
    AND om.propriedade_id IN (SELECT id FROM public.propriedades WHERE user_id = auth.uid())
  )
);

COMMIT;
