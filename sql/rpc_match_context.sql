-- Criação da função RPC para RAG com Janelamento Contextual (Contextual Windowing)
-- Utiliza os novos campos chunk_index e source_document_id

CREATE OR REPLACE FUNCTION match_documents_with_context(
  query_embedding vector(1024),
  match_pmo_id bigint,
  match_threshold float,
  match_count int,
  window_size int DEFAULT 1
)
RETURNS TABLE (
  id bigint,
  pmo_id bigint,
  document_name text,
  content text,
  similarity float,
  is_global boolean,
  metadata jsonb,
  chunk_index int,
  source_document_id varchar
)
LANGUAGE sql
AS $$
WITH top_matches AS (
  -- 1. Encontra os 'match_count' chunks originais mais similares
  SELECT 
    fd.id,
    fd.pmo_id,
    fd.source_document_id,
    fd.chunk_index,
    1 - (fd.embedding_1024 <=> query_embedding) AS similarity
  FROM farm_documents fd
  WHERE 1 - (fd.embedding_1024 <=> query_embedding) > match_threshold
    -- Se match_pmo_id for fornecido, filtra; senão busca apenas os nulos (globais)
    AND (match_pmo_id IS NULL OR fd.pmo_id = match_pmo_id OR fd.pmo_id IS NULL)
  ORDER BY fd.embedding_1024 <=> query_embedding
  LIMIT match_count
)
-- 2. Faz JOIN para trazer os chunks vizinhos do mesmo documento
SELECT DISTINCT ON (context_docs.source_document_id, context_docs.chunk_index)
  context_docs.id,
  context_docs.pmo_id,
  context_docs.document_name,
  context_docs.content,
  top_matches.similarity, -- Mantém a similaridade do chunk âncora que trouxe este contexto
  (context_docs.pmo_id IS NULL) as is_global,
  '{}'::jsonb as metadata, -- Assumindo sem metadata por padrão, ou context_docs.metadata se existir na tabela real
  context_docs.chunk_index,
  context_docs.source_document_id
FROM top_matches
JOIN farm_documents context_docs 
  ON top_matches.source_document_id = context_docs.source_document_id
  AND context_docs.chunk_index BETWEEN (top_matches.chunk_index - window_size) AND (top_matches.chunk_index + window_size)
-- 3. Ordena os resultados
ORDER BY 
  context_docs.source_document_id, 
  context_docs.chunk_index,
  top_matches.similarity DESC;
$$;
