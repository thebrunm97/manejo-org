-- Migration: Upgrade vector dimensions to 3072 for gemini-embedding-2-preview
-- Date: 2026-03-12

-- 1. Remover índices HNSW existentes (eles dependem da dimensão fixa)
DROP INDEX IF EXISTS knowledge_chunks_embedding_idx;
DROP INDEX IF EXISTS farm_documents_embedding_idx;

-- 2. Alterar o tipo da coluna embedding para vector(3072)
-- Nota: Isso invalida os dados existentes nas colunas de embedding.
ALTER TABLE public.knowledge_chunks 
    ALTER COLUMN embedding TYPE vector(3072);

ALTER TABLE public.farm_documents 
    ALTER COLUMN embedding TYPE vector(3072);

-- 3. Recriar índices HNSW para 3072 dimensões (usando halfvec para superar o limite de 2000 dimensões)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx 
ON public.knowledge_chunks 
USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS farm_documents_embedding_idx 
ON public.farm_documents 
USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- 4. Atualizar função match_chunks para aceitar vector(3072)
CREATE OR REPLACE FUNCTION match_chunks (
  query_embedding vector(3072),
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

-- 5. Atualizar função match_farm_documents para aceitar vector(3072)
CREATE OR REPLACE FUNCTION match_farm_documents (
  query_embedding vector(3072),
  match_pmo_id bigint,
  match_threshold double precision DEFAULT 0.5,
  match_count int DEFAULT 5
) RETURNS TABLE (
  id bigint,
  document_name text,
  content text,
  similarity float,
  is_global boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.document_name,
    f.content,
    1 - (f.embedding <=> query_embedding) AS similarity,
    (f.pmo_id IS NULL) AS is_global
  FROM farm_documents f
  WHERE (f.pmo_id = match_pmo_id OR f.pmo_id IS NULL)
  AND 1 - (f.embedding <=> query_embedding) > match_threshold
  ORDER BY f.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
