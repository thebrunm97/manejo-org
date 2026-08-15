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
     - `tencent/hy3-preview`: Passou com sucesso (O mecanismo de FAIL-OPEN atuou graciosamente quando a avaliação do Meta-RAG falhou por timeout).
     - `deepseek/deepseek-v4-flash`: Passou com sucesso.
     - `moonshotai/kimi-k2.6`: Falhou devido a um timeout extremo da API na geração da resposta base.

4. **Laboratório de Embeddings (Open-Source vs Gemini)**
   - Construímos um script 100% offline em NodeJS (`scratch/benchmark_os_local.js`) utilizando `Transformers.js`.
   - Testámos os modelos `Xenova/all-MiniLM-L6-v2` (Inglês) e `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (Multilingue) - ambos com 384 dimensões.
   - **Conclusão Crítica:** Ambos os modelos open-source falharam redondamente ao dar match preciso em palavras-chave importantes no idioma Português (ex: "glifosato"). Comprovámos empiricamente que a decisão de manter os vetores originais do `gemini-embedding-2` (3072 dimensões) no Supabase é de facto a melhor e mais segura arquitetura para o projeto.

5. **Correção do Bug de Embedding no RAG (Vetores 1024d BGE-M3 vs 3072d Gemini)**
   - **Causa raiz identificada:** a migração de embeddings de Gemini (3072d) para BGE-M3 (1024d) — já validada anteriormente com um benchmark de 50 perguntas (BGE-M3: 86% hit-rate top-1 / 92% top-3; Gemini: 78% top-1 / 98% top-3, decisão pró-BGE-M3 pelo ganho no top-1 e eliminação de vendor lock-in) — ficou **incompleta em produção**: a busca (RPC `match_documents_with_context_1024`) já apontava para a coluna nova, mas o caminho de escrita em `internal/webhook/handler.go` (upload de PDF via WhatsApp) continuava gerando e gravando vetores antigos de 3072d via `InsertFarmDocument`. Resultado: **todo documento enviado pelo usuário desde a migração ficava invisível para o RAG**, silenciosamente, sem erro visível.
   - **Correção aplicada:** `handler.go` agora usa `SupabaseClient.GetEmbedding` (BGE-M3 via OpenRouter) e `UpsertFarmDocumentChunks`, o mesmo caminho já usado por `cmd/ingestor`. O worker pool foi refatorado para fan-in batch (uma única chamada de upsert por documento, em vez de uma por chunk), com falhas parciais não abortando o documento inteiro e progresso reportado de forma incremental.
   - **Backfill:** os 17 registros pré-existentes com `embedding_1024 IS NULL` foram reindexados via `cmd/reindex/main.go` e a busca via RPC foi verificada como funcional após a correção.
   - **Código morto removido:** `cmd/knowledge_loader/main.go` (utilitário de ingestão legado, sem uso em CI/pipeline, ainda escrevendo na coluna 3072d antiga) foi excluído.
   - **Pendências em aberto:**
     - `internal/supabase/client.go`'s `InsertFarmDocument` continua existindo e só popula a coluna 3072d antiga — não há mais nenhum caminho de produção ativo chamando-o (confirmado via grep), mas o método em si não foi removido nem marcado como deprecated no código.
     - A `service_role` key do Supabase foi exposta em texto plano múltiplas vezes durante a investigação (comandos de terminal). Rotação da chave foi conscientemente adiada — registrar aqui como decisão aceita, não esquecida.
---

## 🚀 Próximos Passos (Próxima Sessão):

1. **Limpeza do Laboratório Local:**
   - Remover a diretoria `scratch/` e os pacotes npm, pois o teste de embeddings foi concluído com sucesso.

2. **Agentic Loop (Fase 2: Ferramentas de Mutação):**
   - Agora que o RAG (Read-Only) está perfeitamente estável com o loop de Tool Calling, o próximo grande passo é introduzir as ferramentas de Escrita na Base de Dados (ex: criar fazendas, registar colheitas).
   - *Iniciado:* Criação da ferramenta de **Escrita em Lote (Batch Writing)** para registo de múltiplas operações numa única requisição.

3. **Otimização de Latência e UX:**
   - *Concluído:* Implementado o indicador de "digitando..." (Chat Presence) integrado à Evolution API, que mascara ativamente a latência das ferramentas de LLM e RAG.
