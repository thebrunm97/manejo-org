---
globs: ["**/*.sql", "**/supabase/**", "**/migrations/**"]
---

# Regras para Supabase / PostgreSQL

## Referências Obrigatórias
Antes de modificar o banco de dados, consultar:
- **Schema completo:** [schema.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/database/schema.md)
- **RPCs documentadas:** [rpcs.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/database/rpcs.md)
- **Arquitetura Fat Database:** [ADR-002](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/architecture/adr/002-fat-database.md)

## Regras de Design (Fat Database — ADR-002)
- **Toda operação que toca múltiplas tabelas** DEVE ser uma RPC atômica.
- **Nunca fazer múltiplos INSERT/UPDATE sequenciais** do backend.
- **RPCs novas:** DEVEM ser documentadas em [rpcs.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/database/rpcs.md) com: nome, parâmetros, retorno e exemplo SQL.
- **Novas tabelas:** DEVEM ter Row Level Security (RLS) policies.
- **Nomenclatura:** snake_case para tabelas e funções.
- **Primary Keys:** usar `uuid` (não serial/int).

## Regras de Busca Vetorial (RAG)
- **Embeddings:** usam extensão pgvector.
- **Busca semântica:** via RPC `match_farm_documents` com distância de cosseno.
- **Tabela knowledge_chunks:** armazena fragmentos com coluna `embedding` vector.

## Regras de Auditoria
- **Toda operação de IA** deve ser logada em `logs_processamento`.
- **Campos obrigatórios no log:** `profile_id`, `modelo`, `tokens_in`, `tokens_out`.
- **Caderno de Campo:** Registros são documentos de compliance — NUNCA deletar.

## Regras de Segurança
- **Chaves de API NUNCA no SQL.** Usar variáveis de ambiente.
- **RLS:** deve garantir que usuários só acessam dados do seu próprio PMO.
- **Service role key:** é APENAS para o backend. Frontend usa anon key.

## Aplicando migration direto em produção (MCP) — não criar drift
O `apply_migration` do MCP registra a migration em
`supabase_migrations.schema_migrations` com o **timestamp da hora em que
rodou**, não com a versão do arquivo. Foi isso que quebrou o pipeline
`Deploy to Production` de 2026-09-08 a 2026-09-30 (histórico do repo ≠
produção; sincronizado em 2026-09-30). Ao aplicar via MCP:
1. Depois do `apply_migration`, renomeie o arquivo local para a versão que
   produção registrou (`list_migrations`) — **ou** rode o SQL com
   `execute_sql` e insira a linha em `schema_migrations` com a versão do
   arquivo.
2. Nunca aplique em produção uma migration de "reconciliação" (que faz
   `DROP TABLE` para bancos novos): só registre em `schema_migrations`.
3. Confira: `md5(string_agg(version, ',' order by version))` em produção
   tem que bater com a lista de arquivos de `supabase/migrations/`.
