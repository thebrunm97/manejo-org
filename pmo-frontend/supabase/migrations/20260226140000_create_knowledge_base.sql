-- Ativar a extensão pgvector (necessário ser superuser ou ter permissões na cloud)
CREATE EXTENSION IF NOT EXISTS vector;

-- Criação da tabela para armazenar os chunks de conhecimento
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_name TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(768) -- Dimensão otimizada para models/text-embedding-004
);

-- Criar um índice HNSW para busca vetorial rápida usando cosine distance
-- Isto melhora drasticamente a performance em milhões de vetores vs busca exata
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx 
ON knowledge_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Função RPC para buscar chunks por similaridade
-- Substitui a pesquisa linear (dot product) por uma ordenação de operador de distância (<=>)
CREATE OR REPLACE FUNCTION match_chunks (
  query_embedding vector(768),
  match_count int DEFAULT 5
) RETURNS TABLE (
  id UUID,
  document_name TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.document_name,
    k.content,
    k.metadata,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks k
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
