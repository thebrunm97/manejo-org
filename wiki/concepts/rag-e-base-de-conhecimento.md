# RAG e base de conhecimento

O agente agronômico não pode inventar recomendação. Toda resposta técnica
deve ser ancorada em documento real: legislação de
[[certificacao-organica]], material da Embrapa, ou documentos da própria
fazenda.

## Pipeline

1. **Ingestão** — PDF enviado via `POST /knowledge/upload`
   (`pmo-bot-go/internal/knowledge/handler.go`), ou pelo PWA em
   `pmo-frontend/src/services/ragService.ts`. Extração com `ledongthuc/pdf`.
2. **Chunking** — `pmo-bot-go/internal/chunking/`.
3. **Embedding** — vetores gravados com `pgvector`, com cache em
   `internal/adapter/embedcache/`.
4. **Busca** — RPC única que faz `UNION ALL` entre `farm_documents`
   (documentos da fazenda) e `knowledge_chunks` (corpus geral)
   — `supabase/migrations/20260526120000_unify_rag_rpc_union_all.sql`.
   Dimensão atual: 1024 (`20260720163000_match_documents_1024.sql`).
5. **Rerank** — `pmo-bot-go/internal/llm/reranker.go`.

## Avaliação

O projeto trata qualidade de RAG como problema mensurável, não como
impressão: tabelas `rag_experiments`, `rag_experiment_runs`,
`rag_evaluations`, `rag_arena_models`, `rag_judge_runs`, `rag_feedback` e
`rag_query_logs`, com painel de Knowledge Ops
(`20260721180000_knowledge_ops_panel.sql`) e o binário
`pmo-bot-go/cmd/evaluate/`.

Relacionado: [[roteador-de-agentes-ia]], [[compliance-de-insumos]].

## Fontes

- `docs/PLAN-knowledge-ops.md`, `docs/PLAN-bge-m3-migration.md`,
  `docs/PLAN-rag-threshold.md`
- `docs/knowledge_base/` — corpus regulatório
