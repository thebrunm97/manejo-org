-- ============================================================================
-- Migration: Unify RAG search across farm_documents + knowledge_chunks
-- Purpose:   The bot's RPC only queried farm_documents, but Embrapa PDFs
--            (milho, hortaliças) were ingested into knowledge_chunks.
--            This UNION ALL approach avoids data duplication.
-- ============================================================================

-- Drop old function (return type changed: added metadata column)
DROP FUNCTION IF EXISTS public.match_farm_documents(vector, bigint, double precision, integer);

-- Recreate with unified UNION ALL logic
CREATE OR REPLACE FUNCTION public.match_farm_documents(
  query_embedding vector,
  match_pmo_id bigint,
  match_threshold double precision DEFAULT 0.75,
  match_count integer DEFAULT 3
)
RETURNS TABLE(
  id bigint,
  document_name text,
  content text,
  similarity double precision,
  is_global boolean,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM (
    -- Source 1: Farm-specific + global documents (original table)
    SELECT
      f.id,
      f.document_name,
      f.content,
      1 - (f.embedding <=> query_embedding) AS similarity,
      (f.pmo_id IS NULL) AS is_global,
      NULL::jsonb AS metadata
    FROM farm_documents f
    WHERE (f.pmo_id = match_pmo_id OR f.pmo_id IS NULL)
    AND 1 - (f.embedding <=> query_embedding) > match_threshold

    UNION ALL

    -- Source 2: Global knowledge base (Embrapa PDFs, academic papers)
    SELECT
      0::bigint AS id,
      k.document_name,
      k.content,
      1 - (k.embedding <=> query_embedding) AS similarity,
      true AS is_global,
      k.metadata
    FROM knowledge_chunks k
    WHERE 1 - (k.embedding <=> query_embedding) > match_threshold
  ) combined
  ORDER BY combined.similarity DESC
  LIMIT match_count;
END;
$$;
