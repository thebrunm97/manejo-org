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
