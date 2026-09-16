# 📚 Índice Consolidado de Documentação — ManejoORG

Mapa central de todos os arquivos de documentação do projeto. Gerado em 06/09/2026.

> [!NOTE]
> Índice dos arquivos de documentação do projeto (exclui worktrees, `.claude`, `mcp`, `evolution-go-source`, `.agent`, `.wayfinder`, `venv` e códigos de terceiros).

---

## 🧭 Raiz do Repositório

| Documento | Conteúdo |
|---|---|
| [**README.md**](./README.md) | Visão geral do projeto e pontos de entrada. |
| [**CHANGELOG.md**](./CHANGELOG.md) | Histórico de mudanças do projeto. |
| [**TECHNICAL_DEBT.md**](./TECHNICAL_DEBT.md) | Registro de dívida técnica consolidada. |
| [**bigpickle-log.md**](./bigpickle-log.md) | Log de sessões/trabalhos do agente. |

---

## 🏗️ docs/ — Documentação Principal

### Arquitetura

| Documento | Conteúdo |
|---|---|
| [**ARCHITECTURE.md**](./docs/ARCHITECTURE.md) | Visão arquitetural geral da plataforma. |
| [**overview.md**](./docs/architecture/overview.md) | Princípios de design, tech stack e pilares. |
| [**data-flow.md**](./docs/architecture/data-flow.md) | Fluxos de dados: WhatsApp e Sync (diagramas). |
| [**international_data.md**](./docs/architecture/international_data.md) | Estratégia de dados internacionais/localização. |
| [**adr/README.md**](./docs/architecture/adr/README.md) | Registro de decisões arquiteturais (ADRs). |

**ADRs (Decisões Arquiteturais):**
`001-go-over-python`, `002-fat-database`, `003-offline-first`, `004-multi-llm`, `005-open-meteo-migration`, `006-pdf-extraction-engine`, `007-pdf-extraction-pymupdf`, `008-ponytail-orchestrator-cleanup`, `009-gateway-go-complementa-fat-database`, `010-multitenancy-por-organizacao`, `011-abstracao-de-canal-de-chat`

### Especificações (specs/)

| Documento | Conteúdo |
|---|---|
| [**README.md**](./docs/specs/README.md) | Índice das especificações (legado). |
| [**overview.md**](./docs/specs/overview.md) | Visão geral das especificações técnicas. |
| [**conventions.md**](./docs/specs/conventions.md) | Convenções de código e padrões. |
| [**business_rules.md**](./docs/specs/business_rules.md) | Regras de negócio do domínio. |
| [**frontend_navigation.md**](./docs/specs/frontend_navigation.md) | Navegação e rotas do frontend. |
| [**integration_contracts.md**](./docs/specs/integration_contracts.md) | Contratos de integração entre sistemas. |
| [**PMO_DATA_STRUCTURE.md**](./docs/specs/PMO_DATA_STRUCTURE.md) | Estrutura canônica do `form_data` (JSONB). |
| [**ai_retry_plan.md**](./docs/specs/ai_retry_plan.md) | Plano de retry para chamadas de IA. |
| [**task_judge.md**](./docs/specs/task_judge.md) | Especificação do avaliador de tarefas. |
| [**organic_inputs_research.md**](./docs/specs/organic_inputs_research.md) | Pesquisa de insumos orgânicos. |

### Backend / Database / Frontend

| Documento | Conteúdo |
|---|---|
| [**agents.md**](./docs/backend/agents.md) | Agentes de IA (Agronomist, DB Operator). |
| [**compliance.md**](./docs/backend/compliance.md) | Blacklist e validação para certificação orgânica. |
| [**fsm.md**](./docs/backend/fsm.md) | Finite State Machine e LoopGuard. |
| [**weather.md**](./docs/backend/weather.md) | Integração Open-Meteo, fallback e retries. |
| [**rpcs.md**](./docs/database/rpcs.md) | Funções Postgres (RPCs). |
| [**CURRENT_SCHEMA_VISUALIZATION.md**](./docs/database/CURRENT_SCHEMA_VISUALIZATION.md) | Visualização do schema atual da base. |
| [**pages.md**](./docs/frontend/pages.md) | Mapa de páginas e rotas do frontend. |
| [**offline.md**](./docs/frontend/offline.md) | Estratégia de IndexedDB e sync offline. |

### Deploy & Operação

| Documento | Conteúdo |
|---|---|
| [**docker.md**](./docs/deployment/docker.md) | Configuração de containers (WPPConnect etc.). |
| [**env_vars.md**](./docs/deployment/env_vars.md) | Centralização de variáveis de ambiente/segredos. |

### Guias (guides/)

| Documento | Conteúdo |
|---|---|
| [**onboarding.md**](./docs/guides/onboarding.md) | Primeiros passos para novos desenvolvedores. |
| [**new-agent.md**](./docs/guides/new-agent.md) | Como adicionar novos agentes de IA. |
| [**git-atomic-commits.md**](./docs/guides/git-atomic-commits.md) | Convenção de commits atômicos. |
| [**gpu-ocr-troubleshooting.md**](./docs/guides/gpu-ocr-troubleshooting.md) | Troubleshooting de OCR em GPU. |
| [**rag-ingestion-lessons-learned.md**](./docs/guides/rag-ingestion-lessons-learned.md) | Lições aprendidas na ingestão RAG. |
| [**supabase-mcp-fix.md**](./docs/guides/supabase-mcp-fix.md) | Correção do MCP Supabase. |

### Planos (PLAN-*.md e plans/)

- **docs/PLAN.md**
- `PLAN-adubacao-milho`, `PLAN-bge-m3-migration`, `PLAN-contextual-windowing`, `PLAN-evolution-license-fix`, `PLAN-f1-auth-pkce`, `PLAN-fase-2-financeiro`, `PLAN-fsm-agentic-loop`, `PLAN-hitl-judge-bugfix`, `PLAN-knowledge-ops`, `PLAN-limites-seguranca`, `PLAN-rag-threshold`, `PLAN-supabase-rpc-error`, `PLAN-training-logs-fix`
- **docs/plans/:** `FINANCIAL_MODULE_PLAN`, `FINANCIAL_READINESS_AUDIT`, `GUARDRAILS_PLAN`, `MULTI_MODALITY_HARDENING_PLAN`, `PLAN_NER_EXECUTION`, `PLAN_PHASE_3_NER`, `PLAN-adr-011-chat-abstraction`, `PLAN-compra-form-sync`, `PLAN-fase-2-financeiro`, `PLAN-onboarding-integration`, `PLAN-rag-tabela-fix`, `PLAN-rpi-integration`, `timeout-time-finance-fix`, `deterministic-audit-backend`
- **Checkpoints/inventário (06/09):** [`docs/checkpoint-2026-09-06.md`](./docs/checkpoint-2026-09-06.md), [`docs/branch-inventory-2026-09-06.md`](./docs/branch-inventory-2026-09-06.md), [`docs/CHECKPOINT-feature-multicanal.md`](./docs/CHECKPOINT-feature-multicanal.md), [`docs/PLAN-feature-multicanal.md`](./docs/PLAN-feature-multicanal.md)

### Auditorias / Pesquisas / Fontes Brutas

| Documento | Conteúdo |
|---|---|
| [**audit-bigpickle-2026-09-05.md**](./docs/audit-bigpickle-2026-09-05.md) | Auditoria do agente (05/09/2026). |
| [**audit-defesa-profunda-2026-09-06.md**](./docs/audit-defesa-profunda-2026-09-06.md) | Auditoria de defesa profunda (06/09/2026). |
| [**audit-supabase-rls-2026-09-05.md**](./docs/audit-supabase-rls-2026-09-05.md) | Auditoria de RLS Supabase (05/09/2026). |
| [**research_audit.md**](./docs/research_audit.md) | Relatório técnico de auditoria original. |
| [**research/RESEARCH_STRUCTURED_OUTPUT.md**](./docs/research/RESEARCH_STRUCTURED_OUTPUT.md) | Pesquisa de saída estruturada. |
| [**security/secret-scanning.md**](./docs/security/secret-scanning.md) | Varredura de segredos. |
| [**raw/**](./docs/raw/) | Fontes brutas: `RESEARCH_COOP_DASHBOARD`, `RESEARCH_FINANCEIRO`, `RESEARCH_PWA_OFFLINE`, `RESEARCH_RASTREABILIDADE`, `DOC-175_Embrapa_Guia_Pragas_Tomate_ingested` |

### Outros docs/

| Documento | Conteúdo |
|---|---|
| [**index.md**](./docs/index.md) | Wiki master catalog (ingest). |
| [**concepts/**](./docs/concepts/) | `offline-sync`, `prd-agrovivo`, `rpi-optimizations`, [`webhook-auth-evolution`](./docs/concepts/webhook-auth-evolution.md), [`growth-acquisition-strategy`](./docs/concepts/growth-acquisition-strategy.md). |
| [**interacao_ser_rio.md**](./docs/interacao_ser_rio.md) | Interação com o Ser/rio. |
| [**live-chat-monitor.md**](./docs/live-chat-monitor.md) | Monitor de chat ao vivo. |
| [**FEATURE-multicanal.md**](./docs/FEATURE-multicanal.md) | Feature multicanal (WhatsApp, Telegram e Chat Web/PWA). |
| [**walkthrough_field_ops.md**](./docs/walkthrough_field_ops.md) | Walkthrough de operações de campo. |
| [**correcao_timeout_supabase.md**](./docs/correcao_timeout_supabase.md) | Correção de timeout Supabase. |
| [**log.md**](./docs/log.md) | Log técnico/documentação. |
| [**function-calling.md.txt**](./docs/function-calling.md.txt) / [**image-understanding.md.txt**](./docs/image-understanding.md.txt) | Notas de capacidades LLM. |

---

## 🧠 wiki/ — Base de Conhecimento

| Área | Arquivos |
|---|---|
| [**wiki-index.md**](./wiki/wiki-index.md) | Índice mestre da wiki. |
| [**concepts/**](./wiki/concepts/) | `agricultura-organica`, `caderneta-de-campo`, `certificacao-organica`, `compliance-de-insumos`, `offline-first`, `plano-de-manejo-organico`, `producao-paralela`, `rag-e-base-de-conhecimento`, `rastreabilidade`, `spg-sistema-participativo-de-garantia` |
| [**entities/**](./wiki/entities/) | `canteiro`, `ciclo-de-cultivo`, `demanda-coletiva`, `lote-de-rastreabilidade`, `organizacao`, `pmo`, `produtor`, `propriedade`, `registro-de-caderno`, `talhao`, `transacao-financeira` |
| [**components/**](./wiki/components/) | `gateway-whatsapp`, `legado-python`, `mapa-e-geoprocessamento`, `motor-de-sincronizacao-offline`, `pmo-bot-go`, `pmo-frontend`, `roteador-de-agentes-ia`, `supabase-postgres` |
| [**.cartographer-notes/**](./wiki/.cartographer-notes/) | Notas do processo de mapagem. |

---

## 🤖 pmo-bot-go/docs/ — Backend Go

**Raiz:** [README.md](./pmo-bot-go/README.md), [CHANGELOG.md](./pmo-bot-go/CHANGELOG.md)

### Planejamento ativo
- [`docs/PLAN-sprint-pre-viagem-2026-09-08.md`](./pmo-bot-go/docs/PLAN-sprint-pre-viagem-2026-09-08.md) — sprint em andamento.

### Arquitetura & Auditoria
- `docs/AUDIT-REPORT.md`, `docs/MULTITENANCY.md`, `docs/state.md`, `docs/debitos_tecnicos.md`
- `docs/architecture/001-llm-agnostico-fallback.md`, `docs/architecture/MULTI_AGENT_ARCHITECTURE.md`

### Compliance & LGPD
- `docs/LGPD_GUIDELINES.md`, `docs/COFRE-EFEMERO-LGPD.md`

### Planos (planos/**
- `docs/plans/PLAN.md`, `docs/plans/PLAN-e2e-cicd.md`, `docs/plans/rag-cache-plan.md`, `docs/plans/WHATSAPP_REFACTOR_PLAN.md`
- `PLAN-audio-triage-audit`, `PLAN-dt18-frontend-write-migration`, `PLAN-latency-tracing`, `PLAN-message-buffer-coalescing`, `PLAN-multi-agent-mcp`, `PLAN-mutation-hardening`, `PLAN-onboarding-tipo-cadastro`, `PLAN-openrouter-prompt-caching`, `PLAN-rag-ingestion-unification`, `PLAN-redis-integration`, `PLAN-router-aplus`, `PLAN-supabase-mutations`, `PLAN-weather-ux`

### Pesquisas & Runbooks
- `docs/RESEARCH-proactive-agent-gap-analysis.md`, `docs/RESEARCH-vector-db-improvements.md`, `docs/RESEARCH_STRUCTURED_OUTPUT.md`, `docs/RESEARCH-proactive-agent-gap-analysis.md`
- `docs/RUNBOOK-envio-manual-whatsapp.md`, [`docs/RUNBOOK-ai-memory-setup.md`](./pmo-bot-go/docs/RUNBOOK-ai-memory-setup.md), `docs/SURVEY_MUTATION_TOOLS.md`, `docs/REF-groq-rate-limits.md`
- `docs/FEATURE-saf-spatial-engine.md`, `docs/HANDOFF-2026-08-22.md`, `docs/estado_tarefa.md`

**Outros:** `cmd/loadtest/README.md`, `thoughts/research/` (`memory_management`, `orchestrator_god_object`, `webhook_worker_pool`), `logs/*.txt`

---

## 🖥️ pmo-frontend/docs/ — Frontend Web

**Raiz:** [README.md](./pmo-frontend/README.md), [CHANGELOG.md](./pmo-frontend/CHANGELOG.md), [DESIGN_SYSTEM.md](./pmo-frontend/DESIGN_SYSTEM.md), [FRONTEND_TECH_DEBT.md](./pmo-frontend/FRONTEND_TECH_DEBT.md), [implementation_plan.md](./pmo-frontend/implementation_plan.md)

| Documento | Conteúdo |
|---|---|
| [**docs/README.md**](./pmo-frontend/docs/README.md) | Índice da documentação do frontend. |
| [**docs/context.md**](./pmo-frontend/docs/context.md) | Contexto do projeto. |
| [**docs/architecture_audit.md**](./pmo-frontend/docs/architecture_audit.md) | Auditoria de arquitetura. |
| [**docs/ROADMAP.md**](./pmo-frontend/docs/ROADMAP.md) | Roadmap do frontend. |
| [**docs/REFACTORING_SUMMARY.md**](./pmo-frontend/docs/REFACTORING_SUMMARY.md) | Resumo de refatorações. |
| [**docs/debitos_tecnicos.md**](./pmo-frontend/docs/debitos_tecnicos.md) | Dívida técnica do frontend. |
| [**docs/magic_strings_audit.md**](./pmo-frontend/docs/magic_strings_audit.md) | Auditoria de strings mágicas. |
| [**docs/specs/future_spike_in_app_bot.md**](./pmo-frontend/docs/specs/future_spike_in_app_bot.md) | Spike futuro de bot no app. |
| [**docs/archive/specs-implementadas/**](./pmo-frontend/docs/archive/specs-implementadas/) | Specs já implementadas (2026-01). |

---

## 🛠️ Componentes Auxiliares

| Documento | Conteúdo |
|---|---|
| [**tools/ponytail-mcp/README.md**](./tools/ponytail-mcp/README.md) | Orquestrador Ponytail (MCP). |
| [**deploy/load-test/README.md**](./deploy/load-test/README.md) | Testes de carga / deploy. |
| [**deploy/zarc/README.md**](./deploy/zarc/README.md) | Base local do ZARC (janela de plantio): build, atualização de safra, backup. |
| [**RAW/README.md**](./RAW/README.md) | Materiais brutos. |
| [**design-system/manejoorg-changelog/**](./design-system/manejoorg-changelog/) | Changelog do design system. |
| [**thoughts/plans/**](./thoughts/plans/) e [**thoughts/research/**](./thoughts/research/) | Planos e pesquisas em andamento. |

---

> [!TIP]
> Para ver o mapa principal de conhecimento do domínio (conceitos/entidades), comece por [`wiki/wiki-index.md`](./wiki/wiki-index.md). Para a visão técnica consolidada, comece por [`docs/README.md`](./docs/README.md).
