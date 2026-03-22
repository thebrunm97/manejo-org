-- Migration for PMO Compostagem

CREATE TABLE IF NOT EXISTS public.pmo_compostagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pmo_id BIGINT NOT NULL REFERENCES public.pmos(id) ON DELETE CASCADE,
    n_pilha TEXT NOT NULL,
    ingredientes TEXT,
    data_montagem DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ativo', 'concluido')) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pmo_compostagem_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pilha_id UUID NOT NULL REFERENCES public.pmo_compostagem(id) ON DELETE CASCADE,
    tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('revirada', 'temperatura', 'agua', 'uso')),
    valor_temperatura NUMERIC,
    data_evento DATE NOT NULL,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.pmo_compostagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmo_compostagem_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem visualizar suas próprias compostagens"
ON public.pmo_compostagem FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias compostagens"
ON public.pmo_compostagem FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias compostagens"
ON public.pmo_compostagem FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias compostagens"
ON public.pmo_compostagem FOR DELETE USING (auth.uid() = user_id);

-- Pmo_compostagem_eventos policies
CREATE POLICY "Usuários podem acessar eventos de suas compostagens"
ON public.pmo_compostagem_eventos FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pmo_compostagem WHERE id = pmo_compostagem_eventos.pilha_id AND user_id = auth.uid())
);
