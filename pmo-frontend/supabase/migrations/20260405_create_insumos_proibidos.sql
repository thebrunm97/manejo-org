-- 20260405_create_insumos_proibidos.sql
-- Migração para remover blacklist hardcoded e usar Reference Data (Tabela de Insumos Proibidos)

-- 1. Habilitar unaccent para buscas fuzzy se não existir
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Criar tabela de insumos proibidos
CREATE TABLE IF NOT EXISTS public.insumos_proibidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    principio_ativo TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Habilitar RLS (Segurança)
ALTER TABLE public.insumos_proibidos ENABLE ROW LEVEL SECURITY;

-- Permissões de leitura para todos os usuários autenticados
CREATE POLICY "Leitura pública de insumos proibidos" 
ON public.insumos_proibidos FOR SELECT 
TO authenticated 
USING (true);

-- 4. Inserir dados iniciais da Blacklist Crítica
INSERT INTO public.insumos_proibidos (nome, principio_ativo) VALUES
('glifosato', 'Glifosato'),
('roundup', 'Glifosato'),
('2,4-d', 'Acido Diclorofenoxiacetico'),
('paraquat', 'Paraquat'),
('atrazina', 'Atrazina'),
('clorpirifos', 'Clorpirifos'),
('fipronil', 'Fipronil'),
('imidacloprid', 'Imidacloprid'),
('ureia', 'Nitrogenio Sintetico'),
('npk', 'Fertilizante Mineral NPK'),
('superfosfato', 'Fosforo Sintetico'),
('cloreto de potassio', 'Potassio Sintetico')
ON CONFLICT (nome) DO NOTHING;

-- 5. Recriar função de validação is_chemical_input (Zero-Trust Dinâmico)
CREATE OR REPLACE FUNCTION public.is_chemical_input(p_nome_produto TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.insumos_proibidos 
        WHERE unaccent(LOWER(p_nome_produto)) ILIKE '%' || unaccent(LOWER(nome)) || '%'
    );
END;
$$;
