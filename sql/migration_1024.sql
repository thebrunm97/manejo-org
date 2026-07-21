-- sql/migration_1024.sql
-- Adiciona a coluna embedding_1024 na tabela farm_documents para armazenar vetores do modelo BGE-M3 (1024d)
ALTER TABLE farm_documents ADD COLUMN embedding_1024 vector(1024);

-- NOTA ESTRATÉGICA (ROLLBACK):
-- A coluna antiga `embedding` (3072d - Gemini) será mantida temporariamente para possibilitar rollback 
-- em caso de anomalias com o novo modelo. 
-- Após validação da performance e acurácia do BGE-M3 em produção,
-- execute o seguinte comando num deploy futuro para libertar espaço no banco de dados:
-- ALTER TABLE farm_documents DROP COLUMN embedding;
