# Plano de Implementação: Knowledge Ops Panel

> **Status:** Fase de Planejamento (Revisado)
> **Autor:** Especialista Frontend & Arquiteto de Software
> **Objetivo:** Evoluir a aba atual de "Base de Conhecimento" para um painel operacional completo (Knowledge Ops Panel), garantindo segurança na publicação de regras (Draft -> Approved -> Live), ingestão assíncrona com Go Worker, controle de acesso (RBAC + RLS) e observabilidade diagnóstica do RAG.

---

## 1. Visão Geral da Arquitetura

O projeto será dividido em 4 módulos funcionais no frontend (React), suportados por processamento assíncrono em Go e tabelas de governança no Supabase.

1. **Documents (Upload e Indexação):** Submissão de PDFs (e Markdown) para pipeline assíncrono em Go.
2. **Rules (Governança e Versionamento):** Edição assistida, sistema de diff e controle de estado de publicação separando o "documento bruto" da "versão publicada".
3. **Playground (Sandbox):** Testes de inferência com RAG em ambiente isolado antes de impactar os usuários reais.
4. **Telemetry (Observabilidade):** Métricas que diagnosticam sinais operacionais do RAG (taxa de no-answer, top chunks recuperados, latência fragmentada).

---

## 2. Estrutura de Banco de Dados e Segurança (Supabase)

A base atual será expandida para suportar versionamento rigoroso e filas de ingestão, utilizando Row-Level Security (RLS) baseada em Custom Claims no JWT.

### 2.1. Controle de Acesso (RBAC + RLS)
- Papéis injetados via Auth Hook (Custom Claims):
  - `knowledge_editor`: cria e edita drafts.
  - `knowledge_reviewer`: aprova/reprova.
  - `knowledge_publisher`: publica live e faz rollback.
  - `knowledge_observer`: leitura de telemetria e documentos.

### 2.2. Schema de Tabelas

- **`knowledge_documents`**: O artefato bruto.
  - `id`, `title`, `source_type` (PDF, Markdown), `storage_path`, `mime_type`, `metadata` (cultura, praga, etc.), `current_live_version_id`, `created_by`, `created_at`.
- **`knowledge_versions`**: Revisões publicáveis e auditáveis.
  - `id`, `document_id`, `content`, `content_format`, `version_number`, `status` (draft, approved, live, archived), `supersedes_version_id`, `created_by`, `approved_by`, `published_by`, `created_at`, `approved_at`, `published_at`.
- **`ingestion_jobs`**: Fila de tarefas para o worker Go.
  - `id`, `document_id`, `version_id` (opcional), `status` (pending, extracting, chunking, embedding, indexed, failed), `step`, `progress_pct`, `attempt_count`, `error_log`, `worker_id`, `started_at`, `finished_at`.
- **`rag_query_logs`**: Rastreio e diagnóstico.
  - `id`, `query_hash`, `session_id`, `route`, `retrieval_k`, `retrieved_chunk_ids`, `prompt_version`, `knowledge_version_ids`, `answer_status`, `fallback_used`, `latency_ms_total`, `latency_ms_retrieval`, `latency_ms_generation`.
- **`rag_feedback`**: Voto humano.
  - `id`, `log_id`, `is_positive`, `feedback_type`, `comment`, `reviewed_by`, `review_status`.

---

## 3. Contratos da API e Worker (Go Backend)

A ingestão pesada será processada por um **Worker Pool em Go**, consumindo a tabela `ingestion_jobs` (polling com locking transacional `SELECT FOR UPDATE`).

### 3.1. Rota HTTP: Enfileiramento de Ingestão
- `POST /api/v1/admin/knowledge/ingest`
  - **Payload:** `{ "storage_path": "...", "source_type": "PDF", "metadata": {...} }`
  - **Retorno:** `{ "job_id": "uuid", "document_id": "uuid", "status": "pending" }`
  - **Lógica:** Cria o `knowledge_documents` e registra um `ingestion_jobs` pendente.

### 3.2. Worker Loop (Go)
- Um loop em background na mesma infra do bot Go que consome `ingestion_jobs WHERE status = 'pending'`.
- Processa OCR, extração de texto, chunking, cálculos vetoriais via LLM Embeddings e salva em `knowledge_versions` como `draft`.

### 3.3. Rota HTTP: Mudança de Estado (RLS enforced)
- `POST /api/v1/admin/knowledge/versions/:id/transition`
  - **Payload:** `{ "target_status": "approved|live|archived" }`
  - **Lógica:** Backend e RLS garantem que a transição obedeça os papéis do JWT. Ao mudar para `live`, atualiza o `current_live_version_id` no documento pai e aplica Hot-Reload na memória RAG do Bot.

---

## 4. Estrutura do Frontend (React / Slate / Tailwind)

A atual aba `KnowledgeBaseTab.tsx` será o container modular deste painel.

- **`KnowledgeOpsLayout`**: Container com *Tabs* para sub-módulos.
- **`DocumentsPanel`**: Tabela principal de acervo bruto e upload (drag-and-drop para Storage).
- **`RulesEditorPanel`**: Visualização e edição do conteúdo de versões. Editor Markdown com preview, Diff lado-a-lado contra versão Live, e controles de Aprovação/Publicação.
- **`PlaygroundPanel`**: Input de perguntas apontando opcionalmente para a base *Live* ou incluindo versões *Draft/Approved*.
- **`TelemetryDashboard`**: Recharts exibindo sinais operacionais (*No-Answer rate*, *Fallback rate*, desmembramento de *Latência*, e *Top Chunks* recuperados).

---

## 5. Fase 1: Break-down de Tickets (Implementação Imediata)

A **Fase 1** constrói a base operacional (Banco, Worker e Upload):

- [ ] **Ticket 1.1 - Migrations (Supabase):** 
      Criar tabela de papéis/roles, tabela `knowledge_documents`, `knowledge_versions`, `ingestion_jobs` e configurar as RLS Policies baseadas em JWT Custom Claims para as transições (`draft` -> `approved` -> `live`).
- [ ] **Ticket 1.2 - Frontend Storage & Upload (React):** 
      Criar o componente `DocumentsPanel.tsx` substituindo o arquivo antigo. Implementar upload de PDF/Markdown diretamente para Supabase Storage.
- [ ] **Ticket 1.3 - Contrato de API de Ingestão (Go):** 
      Criar rota HTTP `/api/v1/admin/knowledge/ingest` no backend Go para receber o aviso de upload e registrar a entrada na tabela `ingestion_jobs`.
- [ ] **Ticket 1.4 - Go Worker Pool Básico (Go):** 
      Implementar goroutine de background no bot que faça polling na `ingestion_jobs`, faça download do arquivo do storage, converta para texto (simples no MVP), gere uma `knowledge_version` como `draft` e marque o job como `indexed` (ou `failed`).
- [ ] **Ticket 1.5 - UI de Status e Listagem (React):** 
      Exibir a lista de documentos em `DocumentsPanel.tsx` e o progresso/status visual do seu *job* de ingestão e a versão atual.

---

## 6. Fase 2: Playground Arena & Benchmarking

Implementação de um ambiente de simulação concorrente (Multi-Model Arena) para avaliar a qualidade de recuperação e geração.

- [x] **Arena Concorrente:** Permitir seleção múltipla de modelos configurados via banco (via OpenRouter e provedores locais).
- [x] **Benchmarking no Banco:** Tabelas `rag_experiments` para salvar o estado da recuperação, e `rag_experiment_runs` para persistir o output de cada LLM, medindo custo, tokens (`tokens_used_prompt`, `tokens_used_completion`), status de sucesso/timeout, e `latency_ms`.
- [x] **Tratamento de Tolerância a Falhas:** Configuração de `WaitGroups`/`errgroup` no Go para disparo em paralelo e coleta de outputs unificados com timeout isolado por requisição.
- [x] **UI de Comparação:** Exibição side-by-side no painel (PlaygroundPanel), indicando provedores, tempo e visualização do Chunk scoring (contexto recuperado com métrica de similaridade).

---

## 7. Fase 2.5: LLM-as-a-Judge (Juiz Implacável)

Implementação de uma pipeline de avaliação automatizada operando de forma assíncrona ("opportunistic execution") baseada em RAG Assessment (RAGAS).

- [x] **Avaliação de Dimensões:** Prompt engenhado para julgar 3 pilares vitais:
  - *Faithfulness (Fidelidade ao Contexto):* Avalia se há alucinação baseada nas cartilhas ("unsupported claims").
  - *Answer Relevance:* Mede quão bem a resposta responde a pergunta (detectando respostas evasivas "missing points").
  - *Confidence Score:* Uma probabilidade final sintética de assertividade.
- [x] **Structured Outputs:** Uso rigoroso de JSON Schemas do LLM Juiz (ex: GPT-4o) forçando um JSON contendo `verdict` (pass, warning, fail) e `reasoning_short`.
- [x] **Async Hook:** O backend Go, imediatamente após salvar um "run" de LLM no banco, dispara uma goroutine que insere uma "Evaluation" pendente e invoca a API do Juiz para preencher o veredito sem travar o cliente web.
- [x] **Observabilidade e Correções Finais:** Correção do mapeamento de JSON Tags (`experiment_id`, `latency_ms`, `error_type`, `tokens_used_prompt`) do Supabase para garantir inserção sadia nos relacionamentos UUID e evitar dados nulos. Exibição desses Vereditos (Scores e Alertas) diretamente abaixo do resultado do LLM testado no React Frontend.
