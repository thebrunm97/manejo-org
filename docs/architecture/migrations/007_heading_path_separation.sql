-- ============================================================
-- Migration: Fase 1 — Separação de heading_path do content
-- Aplicar no Supabase Dashboard > SQL Editor
-- Data: 2026-07-23
-- ============================================================

-- Adiciona coluna heading_path para persistir o caminho estrutural
-- separado do content (texto limpo para o prompt do LLM).
-- Esta coluna é omitempty no JSON — não quebra upserts existentes.
ALTER TABLE farm_documents 
ADD COLUMN IF NOT EXISTS heading_path TEXT;

-- Confirma que a mudança foi aplicada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'farm_documents'
  AND column_name IN ('content', 'heading_path', 'chunk_hash', 'embedding_1024')
ORDER BY column_name;


-- ============================================================
-- [FRENTE 4 — NÃO EXECUTAR AINDA]
-- Proposta de migração para retrieval híbrido semântico+léxico
-- Executar apenas APÓS Fase 1 e OCR estarem empiricamente fechados
-- ============================================================

-- PASSO 1: Coluna tsvector gerada automaticamente sobre content limpo
-- (depende de 'content' já ser o texto limpo, o que a migration acima garante)
--
-- ALTER TABLE farm_documents
-- ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR
-- GENERATED ALWAYS AS (to_tsvector('portuguese', COALESCE(content, ''))) STORED;
--
-- PASSO 2: Índice GIN para busca léxica eficiente
--
-- CREATE INDEX IF NOT EXISTS idx_farm_documents_content_tsv
-- ON farm_documents USING GIN(content_tsv);
--
-- PASSO 3: RPC de fusão RRF (k=60) — ver proposta completa no walkthrough
