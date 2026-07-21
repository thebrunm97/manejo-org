-- Migration to create the new RPC for vector similarity search using BGE-M3 (1024 dimensions)
-- This uses the Cosine Distance operator <=> to match embedding_1024.

CREATE OR REPLACE FUNCTION match_documents_with_context_1024(
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
  source_document_id text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH matches AS (
    SELECT
      d.id,
      d.pmo_id,
      d.document_name,
      d.content,
      1 - (d.embedding_1024 <=> query_embedding) AS similarity,
      CASE WHEN d.pmo_id = 0 THEN true ELSE false END AS is_global,
      d.metadata,
      d.chunk_index,
      d.source_document_id
    FROM farm_documents d
    WHERE (d.pmo_id = match_pmo_id OR d.pmo_id = 0)
      AND d.embedding_1024 IS NOT NULL
      AND 1 - (d.embedding_1024 <=> query_embedding) > match_threshold
    ORDER BY d.embedding_1024 <=> query_embedding
    LIMIT match_count
  )
  -- Currently we return the matched chunk directly. 
  -- If windowing is needed in the future, we can join with adjacent chunks using chunk_index.
  SELECT * FROM matches;
END;
$$;
