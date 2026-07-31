-- Create rag_arena_models table
CREATE TABLE public.rag_arena_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    label TEXT NOT NULL,
    temperature NUMERIC DEFAULT 0.2,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 100,
    supports_tools BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.rag_arena_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.rag_arena_models
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert Core Seed Data
INSERT INTO public.rag_arena_models 
(model_id, provider_name, label, temperature, is_default, sort_order, supports_tools, notes)
VALUES
-- Core (Daily use)
('google/gemini-2.5-flash', 'openrouter', 'Gemini 2.5 Flash', 0.2, true, 10, true, 'Rápido, barato, excelente baseline'),
('openai/gpt-4o-mini', 'openrouter', 'GPT-4o-mini', 0.2, true, 20, true, 'Equilíbrio OpenAI para tarefas do dia a dia'),
('anthropic/claude-3-haiku', 'openrouter', 'Claude 3 Haiku', 0.2, true, 30, true, 'Muito rápido, excelente com formato estruturado'),
('qwen/qwen-2.5-72b-instruct', 'openrouter', 'Qwen 2.5 72B', 0.2, true, 40, true, 'Altíssimo nível de instrução, open-weights top tier'),

-- Extended (Exploração / Benchmark avançado)
('google/gemini-3.5-flash', 'openrouter', 'Gemini 3.5 Flash', 0.2, false, 50, true, 'Teste de nova geração Google'),
('moonshotai/moonlight-16b-a3b-instruct', 'openrouter', 'Moonlight 16B', 0.2, false, 60, false, 'Modelo Chinês muito forte em contexto longo e extração'),
('z-ai/glm-4.5-air', 'openrouter', 'GLM-4.5 Air', 0.2, false, 70, true, 'Alternativa leve e super eficiente'),
('meta-llama/llama-3.1-8b-instruct', 'openrouter', 'Llama 3.1 8B', 0.2, false, 80, true, 'Baseline open-weights leve');
