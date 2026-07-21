-- Ativar a extensão pgvector caso ainda não esteja ativa
CREATE EXTENSION IF NOT EXISTS vector;

-- Criação da tabela de perfil de memória
CREATE TABLE IF NOT EXISTS user_memory_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id UUID NOT NULL REFERENCES pmo(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    fact TEXT NOT NULL, -- Ex: "Iniciou transição orgânica em Jan 2025"
    category TEXT, -- Ex: "cultura", "infraestrutura", "alerta_climatico"
    embedding vector(1024), -- Para modelos de embedding text-embedding-004 ou similar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Índices para busca semântica e queries rápidas por produtor
CREATE INDEX IF NOT EXISTS idx_user_memory_profiles_embedding ON user_memory_profiles USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_user_memory_pmo_id ON user_memory_profiles(pmo_id);
