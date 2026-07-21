-- Adiciona as colunas de metadados do chunking avançado
ALTER TABLE farm_documents ADD COLUMN IF NOT EXISTS chunk_hash VARCHAR(64) UNIQUE;
ALTER TABLE farm_documents ADD COLUMN IF NOT EXISTS chunk_index INTEGER;
ALTER TABLE farm_documents ADD COLUMN IF NOT EXISTS source_document_id VARCHAR(255);

-- Cria o índice de hash para UPSERT (ON CONFLICT) rápido, se já não existir pelo UNIQUE constraint
-- O constraint UNIQUE já cria implicitamente o índice, mas documentamos a intenção.
-- CREATE UNIQUE INDEX idx_chunk_hash ON farm_documents(chunk_hash);
