-- 1. RPC de Escrita Segura (ON CONFLICT com GREATEST de score e expires_at)
CREATE OR REPLACE FUNCTION save_pmo_memory_cache(
    p_pmo_id           BIGINT,
    p_user_id          UUID,
    p_fragment         TEXT,
    p_content_hash     TEXT,
    p_source           TEXT,
    p_category         TEXT,
    p_importance_score FLOAT4,
    p_embedding        vector(1024),
    p_embedding_missing BOOLEAN,
    p_expires_at       TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO pmo_memory_cache (
        pmo_id, user_id, fragment, content_hash, source,
        category, importance_score, embedding, embedding_missing, expires_at
    ) VALUES (
        p_pmo_id, p_user_id, p_fragment, p_content_hash, p_source,
        p_category, p_importance_score, p_embedding, p_embedding_missing, p_expires_at
    )
    ON CONFLICT (pmo_id, content_hash) DO UPDATE SET
        expires_at = GREATEST(pmo_memory_cache.expires_at, EXCLUDED.expires_at),
        importance_score = GREATEST(pmo_memory_cache.importance_score, EXCLUDED.importance_score),
        embedding = COALESCE(EXCLUDED.embedding, pmo_memory_cache.embedding),
        embedding_missing = CASE 
            WHEN EXCLUDED.embedding IS NOT NULL OR pmo_memory_cache.embedding IS NOT NULL THEN false 
            ELSE EXCLUDED.embedding_missing 
        END,
        updated_at = now()
    RETURNING id INTO v_id;

    -- NOTA: category e source são imutáveis por design (append-only classification)
    RETURN v_id;
END;
$$;

-- 2. RPC de Busca Semântica
CREATE OR REPLACE FUNCTION match_pmo_memory_cache(
    p_pmo_id    BIGINT,
    p_embedding vector(1024),
    p_threshold FLOAT4 DEFAULT 0.65,
    p_limit     INT    DEFAULT 5
)
RETURNS TABLE (
    id               UUID,
    fragment         TEXT,
    category         TEXT,
    source           TEXT,
    importance_score FLOAT4,
    similarity       FLOAT4,
    created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_limit     INT;
    v_threshold FLOAT4;
BEGIN
    -- Valida pmo_id
    IF p_pmo_id IS NULL OR p_pmo_id <= 0 THEN
        RAISE EXCEPTION 'match_pmo_memory_cache: p_pmo_id inválido (%)', p_pmo_id;
    END IF;

    -- Valida embedding
    IF p_embedding IS NULL THEN
        RAISE EXCEPTION 'match_pmo_memory_cache: p_embedding não pode ser nulo';
    END IF;

    -- Sanitiza parâmetros com limites seguros
    v_limit     := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
    v_threshold := LEAST(GREATEST(COALESCE(p_threshold, 0.65), 0.0), 1.0);

    RETURN QUERY
    SELECT
        mc.id,
        mc.fragment,
        mc.category,
        mc.source,
        mc.importance_score,
        (1 - (mc.embedding <=> p_embedding))::FLOAT4 AS similarity,
        mc.created_at
    FROM pmo_memory_cache mc
    WHERE mc.pmo_id = p_pmo_id
      AND mc.expires_at > now()         -- filtro de validade na query, não no índice
      AND mc.embedding IS NOT NULL
      AND (1 - (mc.embedding <=> p_embedding)) >= v_threshold
    ORDER BY ((1 - (mc.embedding <=> p_embedding)) * mc.importance_score) DESC
    LIMIT v_limit;
END;
$$;
