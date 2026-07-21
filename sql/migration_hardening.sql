-- migration_hardening.sql
-- Adiciona um índice composto para acelerar as buscas do PostgREST durante a expansão de janelas.
-- Este índice otimiza os filtros gte/lte no chunk_index e a ordenação sequencial do PostgREST para um mesmo source_document_id.

CREATE INDEX IF NOT EXISTS idx_farm_documents_doc_chunk ON farm_documents (source_document_id, chunk_index);
