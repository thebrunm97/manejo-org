-- Garante que a extensão pgvector está ativa (versão mínima recomendada: 0.5+)
-- para suporte a vector(1024) e operator vector_cosine_ops no HNSW.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS pmo_memory_cache (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id           BIGINT      NOT NULL,
    user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    fragment         TEXT        NOT NULL,
    -- SHA-256 normalizado do fragment para dedup (lowercase + trim)
    content_hash     TEXT        NOT NULL,
    source           TEXT        NOT NULL DEFAULT 'audio_transcription',
    -- 'audio_transcription' | 'text_message' | 'image_description'
    category         TEXT        NOT NULL DEFAULT 'agronomy',
    -- 'agronomy' | 'regulation' | 'finance' | 'farm_context'
    importance_score FLOAT4      NOT NULL DEFAULT 0.5 CHECK (importance_score BETWEEN 0 AND 1),
    -- vector(1024) alinhado com text-embedding-004; valide dimensão antes do deploy
    -- se mudar de modelo, recrie o índice HNSW com a dimensão correta
    embedding        vector(1024),
    embedding_missing BOOLEAN    NOT NULL DEFAULT false,  -- true se embedding falhou, elegível para retry
    retry_count      INT         NOT NULL DEFAULT 0,      -- teto de 3 retentativas para evitar poison pills
    expires_at       TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ATENÇÃO: índices NÃO usam WHERE expires_at > now() porque now() é não-imutável
-- e PostgreSQL não permite funções voláteis em partial indexes.
-- O filtro expires_at > now() permanece APENAS nas queries e na RPC.
CREATE INDEX IF NOT EXISTS idx_pmo_memory_cache_pmo_id
    ON pmo_memory_cache(pmo_id);
CREATE INDEX IF NOT EXISTS idx_pmo_memory_cache_pmo_expires
    ON pmo_memory_cache(pmo_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmo_memory_cache_score
    ON pmo_memory_cache(pmo_id, importance_score DESC);
-- Índice HNSW parcial para linhas com embedding (IS NOT NULL é imutável — OK)
CREATE INDEX IF NOT EXISTS idx_pmo_memory_cache_embedding
    ON pmo_memory_cache USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
-- Índice para job de retry com proteção contra poison pills (retry_count < 3)
CREATE INDEX IF NOT EXISTS idx_pmo_memory_cache_embedding_missing
    ON pmo_memory_cache(created_at)
    WHERE embedding_missing = true AND retry_count < 3;
-- Dedup por conteúdo: evita salvar o mesmo fragmento repetido para o mesmo pmo
CREATE UNIQUE INDEX IF NOT EXISTS uq_pmo_memory_cache_content
    ON pmo_memory_cache(pmo_id, content_hash);

COMMENT ON INDEX idx_pmo_memory_cache_pmo_expires IS
    'Sem cláusula WHERE now(): filtro de validade fica exclusivamente nas queries/RPC.';

ALTER TABLE pmo_memory_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON pmo_memory_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "owner_read" ON pmo_memory_cache
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

COMMENT ON COLUMN pmo_memory_cache.embedding_missing IS
    'true quando GetEmbedding falhou no momento da escrita. Elegível para retry em background.';
