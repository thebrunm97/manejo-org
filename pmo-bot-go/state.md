# Estado Atual do Projeto (PMO Bot)

## 🎯 O que Concluímos até agora:

1. **Agentic Loop (Fase 1: Read-Only Tool Calling)**
   - Abandonámos o fluxo rígido de FSM (Máquina de Estados) no Orquestrador (`internal/state/orchestrator.go`).
   - Implementámos um ciclo autónomo (`for` com limite de turnos) capaz de interpretar chamadas de ferramentas (`ToolCalls`) e devolver os resultados ao LLM de forma dinâmica.
   - Adicionámos o "Bypass" para a intenção de `CHAT`, economizando iterações quando o utilizador apenas quer conversar.

2. **Ferramenta de RAG (`ConsultarLeiOrganica_RAG`)**
   - Ferramenta registada e conectada aos vetores reais de 3072 dimensões (Gemini) armazenados no Supabase.
   - Adicionámos validações rigorosas (Fallback) para evitar *panics* caso o LLM envie argumentos malformados na Tool Call.

3. **Arena de Modelos (Shootout)**
   - Construímos um teste automatizado (`benchmark_shootout_test.go`) para validar o Agentic Loop com vários modelos via OpenRouter.
   - **Resultados:** 
     - `tencent/hy3-preview`: Passou com sucesso.
     - `deepseek/deepseek-v4-flash`: Passou com sucesso.
     - `moonshotai/kimi-k2.6`: Falhou devido a um timeout extremo da API na geração da resposta base.

4. **Laboratório de Embeddings (Open-Source vs Gemini)**
   - Construímos um script 100% offline em NodeJS (`scratch/benchmark_os_local.js`) utilizando `Transformers.js`.
   - Validamos e migramos para o BGE-M3 (1024d), com 86% top-1 hit rate e eliminação de vendor lock-in.

5. **Refactoring do Pipeline de Áudio (MIME Type & Fallbacks)**
   - Extração e propagação ponta-a-ponta do `audioMimeType` a partir dos adapters de WhatsApp até o LLM e Groq.
   - Fallbacks duplos implementados (`LLMProviderAdapter` e `ProcessAudioMessage`).

6. **Correção do Bug de Embedding no RAG (Vetores 1024d BGE-M3 vs 3072d Gemini)**
   - Pipeline de escrita e busca unificado no BGE-M3 (1024d).
   - Fan-in batch com upsert atômico de chunks no `handler.go`.
   - Backfill e reindexação completa dos registros legados via `cmd/reindex/main.go`.

7. **Idempotência no PostgreSQL Staging (Fase 2.1 - DT-00)**
   - Criadas 4 RPCs idempotentes (`rpc_registrar_operacao_campo`, `rpc_registrar_compra_insumo`, `rpc_registrar_transacao_com_rateio`, `rpc_registrar_cota_produtor`).
   - Deduplicação atômica suportada por índices únicos parciais (`WHERE idempotency_key IS NOT NULL`).

8. **Agentic Loop & Batch Mutations com Two-Phase Commit HITL (Fase 2.2 - DT-09 a DT-12)**
   - **Two-Phase Commit:** Criada tabela `public.mutation_drafts` com status (`pending`, `approved`, `rejected`, `superseded`, `failed`, `expired`), TTL de 45 minutos e índice único parcial `idx_mutation_drafts_one_pending` para `(from_phone, pmo_id)`.
   - **Tool Polimórfica:** Registrada `propose_batch_mutations(operations: [...])` suportando mutações agrupadas de caderno de campo, compra de insumo, transações com rateio e cotas de produtores.
   - **RPCs Atômicas Concorrentes:**
     - `create_or_supersede_mutation_draft`: Trava via `SELECT ... FOR UPDATE`, marca rascunho anterior como `superseded` e cria novo atomicamente.
     - `commit_mutation_draft`: Trava via `SELECT ... FOR UPDATE`, valida multi-tenancy e TTL, itera sobre operações derivando chaves de idempotência (`<draft_id>-op-<idx>`), despacha para as 4 RPCs da Fase 2.1 e captura falhas em subtransação `BEGIN ... EXCEPTION` persistindo `status = 'failed'` + `error_detail` de forma terminal.
   - **Webhook & HITL Interceptor:**
     - Normalização determinística por palavras-chave (`ClassifyHITLResponse`) antes de qualquer chamada LLM.
     - Mensagens claras para rascunhos expirados, rejeitados, falhas parciais ou confirmações bem-sucedidas.
   - **Validação Automatizada:** Testes unitários e de integração real no PostgreSQL (`mutation_drafts_real_postgres_test.go`) cobrindo concorrência real com goroutines simultâneas e integridade transacional (100% PASS).

---

## 🚀 Próximos Passos & Gestão de Débitos:

1. **Próxima Frente Ativa (Fase 3):**
   - Rotação da `service_role` key do Supabase (`DT-01`).
   - Limpeza e descomissionamento de interfaces legadas (`DT-02`, `DT-03`, `DT-04`, `DT-06`).
   - Consolidação do pipeline de ingestão Docling Go (`DT-07`).

2. **📋 Débitos Técnicos & Pendências:**
   - O rastreio formal de dívidas técnicas e pendências é centralizado no board: [docs/debitos_tecnicos.md](file:///c:/Users/T-GAMER/Documents/DEV/manejo-org-app-clean/pmo-bot-go/docs/debitos_tecnicos.md).
