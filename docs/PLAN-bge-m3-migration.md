# [Migração Atômica para BGE-M3 (1024d) com Estratégia Dual-Route]

O objetivo deste plano é migrar de forma atômica e segura a tabela `documentos_embeddings` de uma dimensionalidade de 3072d (Gemini) para 1024d (BGE-M3). Implementaremos também uma arquitetura de vetorização baseada em roteamento (Dual-Route) dependente do contexto do utilizador ou do ambiente.

## User Review Required

> [!WARNING]
> Verifique se as variáveis de ambiente necessárias (como a chave de API e URL do OpenRouter) estão devidamente configuradas e disponíveis no ambiente de produção. Valide também os limites diários de consumo para o `baai/bge-m3` na sua conta OpenRouter.

## Open Questions

> [!IMPORTANT]
> 1. O script de reindexação deve apagar os vetores de 3072d imediatamente após o processamento bem sucedido (no próprio script) ou devemos manter a coluna temporariamente e removê-la num deploy/script SQL posterior para possibilitar rollback rápido?
> 2. O timeout para a requisição inicial do Ollama precisa ser expandido para evitar falhas durante o cold-start do carregamento do modelo na VRAM?

## Proposed Changes

### Database Migration

#### [NEW] [migration_1024.sql](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/sql/migration_1024.sql)
- Adicionar o script SQL para efetuar as mudanças no esquema.
- Incluir a estrutura `ALTER TABLE` para a criação da coluna `embedding_1024 vector(1024)`.
- Adicionar comentários no script detalhando o plano e o script futuro para a remoção (`DROP`) da coluna `embedding` (3072d).

### Backend Refactoring

#### [MODIFY] [client.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/supabase/client.go)
- **Estruturas de Dados:** Atualizar o mapeamento (`struct Documento`) para incluir os campos de ambos os vetores (`embedding` e `embedding_1024`).
- **Arquitetura Dual-Route:** Criar o método abstrato `GetEmbedding(text string, contextType string) ([]float32, error)` para lidar com os dois cenários:
  - `contextType == "BASE_CONHECIMENTO"` -> Chama a API local do Ollama (`http://localhost:11434/api/embeddings`).
  - `contextType == "PRODUCAO"` -> Chama a API cloud do OpenRouter (`https://openrouter.ai/api/v1/embeddings`) utilizando o modelo `baai/bge-m3`.
- **Tratamento de Erros:** Assegurar que os erros de conexão são capturados corretamente, devolvendo o fallback apropriado ou um erro gracioso caso o modelo esteja indisponível.

### Re-indexação Automática

#### [NEW] [main.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/cmd/reindex/main.go)
- **Batching Robusto:** Recuperar e processar os registos a partir da tabela com limites de `LIMIT/OFFSET` definidos em 50 para poupar memória e conexões.
- **Idempotência Garantida:** Incluir a cláusula de pesquisa `WHERE embedding_1024 IS NULL` para garantir que as re-execuções ignoram documentos já migrados.
- **Segurança Dimensional:** Aplicar a verificação de integridade rigorosa através de `if len(vector) != 1024` antes de submeter o batch num `UPDATE`.
- **Rate Limiting:** Adicionar `time.Sleep(200 * time.Millisecond)` entre cada submissão de lote para evitar timeouts de APIs e locks na base de dados.
- **Log de Progresso:** Emitir output amigável na consola para cada linha/batch processado.

## Verification Plan

### Manual Verification
- Aplicar o script `sql/migration_1024.sql` na base de dados (desenvolvimento/local).
- Compilar e executar `cmd/reindex/main.go`. Validar a consola à procura de erros de limite (Rate Limit).
- Executar a verificação na base de dados para averiguar as contagens:
  ```sql
  -- Verificar que o reindex foi conclusivo
  SELECT count(*) FROM documentos_embeddings WHERE embedding_1024 IS NOT NULL;
  ```
- Correr os testes unitários do backend focados na funcionalidade dual-route e confirmar chamadas bem sucedidas em cada contexto.
