CREATE OR REPLACE FUNCTION match_user_memory(
  query_embedding vector(1024),
  match_pmo_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  fact text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ump.id,
    ump.fact,
    ump.category,
    1 - (ump.embedding <=> query_embedding) AS similarity
  FROM user_memory_profiles ump
  WHERE ump.pmo_id = match_pmo_id
    AND 1 - (ump.embedding <=> query_embedding) > match_threshold
  ORDER BY ump.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
