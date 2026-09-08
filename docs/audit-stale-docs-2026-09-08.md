# Auditoria de Documentação Desatualizada — 2026-09-08

Auditoria de rastreio de documentação desatualizada no repo `manejo-org-app-clean`.
Escopo: `docs/`, `pmo-bot-go/docs/`, `pmo-frontend/docs/`, `wiki/`, raiz, `deploy/`.
Excluídos: `node_modules`, `.git`, `.agent/skills/`, `.agent/agents/`, `venv`, worktrees, `evolution-go-source`, `docs/raw/`, `docs/archive/`, `pmo-frontend/docs/archive/specs-implementadas/`.

Nenhum arquivo foi modificado. Este relatório é o único entregável.

---

## Resumo

- **Tipo 1 (link quebrado / arquivo referenciado não existe):** 24 ocorrências
- **Tipo 2 (claim tecnicamente falsa / código diverge da doc):** 14 ocorrências
- **Tipo 3 (doc órfã — não linkada por DOCUMENTATION-INDEX.md nem wiki-index.md):** 7 ocorrências
- **Tipo 4 (plano/pesquisa completado mas não arquivado):** 17 ocorrências
- **Divergências entre docs (item 5 do escopo):** 3 ocorrências
- **DT-XX referenciando débito já resolvido/removido (item 6 do escopo):** 1 ocorrência

> Nota de método: cada item abaixo foi **verificado** contra o código/sistema de arquivos
> (glob/grep), não apenas lido. Achados de subagentes que não se confirmaram na
> re-verificação foram descartados (ex.: supostas referências quebradas a `.agent/rules/*.md`,
> que existem, e a `secret-scan.yml`, `design-system/manejoorg-changelog/`, `thoughts/`, que existem).

---

## Tipo 1 — Link quebrado / arquivo ou caminho referenciado não existe

| Arquivo | Evidência (trecho + caminho/linha atual) | Sugestão |
|---|---|---|
| `DOCUMENTATION-INDEX.md` | Linka `docs/specs/whatsapp_client_plan.md` (linha 50) — arquivo **não existe** (ausente do glob de `docs/specs/`) | Remover a linha ou apontar para a doc real do cliente WhatsApp |
| `DOCUMENTATION-INDEX.md` | Linka `docs/specs/wppconnect_session.md` (linha 51) — arquivo **não existe** | Remover a linha |
| `DOCUMENTATION-INDEX.md` | Lista `PLAN-whatsapp-ux-buttons` (linha 87) — arquivo **não existe** em nenhum lugar do repo | Remover da lista de planos |
| `docs/specs/README.md` | Tabela lista `WHATSAPP_INTEGRATION.md`, `SUPABASE_SCHEMA.md`, `COMPONENTS_GUIDE.md`, `FORM_VALIDATION.md`, `API_ENDPOINTS.md`, `AI_PROMPTS.md` — **nenhum existe** em `docs/` | Remover as linhas ou criar os arquivos |
| `pmo-bot-go/docs/plans/PLAN-e2e-cicd.md` | Referencia `.github/workflows/e2e-tests-backend.yml` — arquivo **não existe**; o workflow real é `backend-e2e.yml` | Corrigir o nome do workflow |
| `pmo-bot-go/docs/plans/rag-cache-plan.md` | Referencia `cmd/knowledge_loader/main.go` — **não existe**; e `internal/llm/schema/{converter,validator}.go` — **não existem** (só `generator.go`) | Corrigir/remover refs |
| `pmo-bot-go/docs/PLAN-rag-ingestion-unification.md` | Referencia `cmd/ingestor/main.go` — **não existe** (o ingestor foi removido, resto `cmd/reindex`). O `scripts/rag_ingest.py` **existe** (a doc cita ambos como mortos; só o cmd morreu) | Atualizar o status: `scripts/rag_ingest.py` vive, `cmd/ingestor` não |
| `pmo-bot-go/docs/plans/WHATSAPP_REFACTOR_PLAN.md` | Referencia `internal/whatsapp/` e `internal/adapter/wppconnect/` — **nenhum package existe**; canal real é `internal/adapter/evolution/` | Reescrever refs para `adapter/evolution` |
| `pmo-bot-go/docs/PLAN-router-aplus.md` | Referencia `internal/llm/schema/{builder,converter,validator}.go` — **não existem**; e mantém nomes `AgroAssistant`/`FuncAgro`, ausentes do código | Corrigir refs; atualizar para a arquitetura atual |
| `pmo-bot-go/docs/PLAN-latency-tracing.md` | Referencia `scratch/benchmark_os_local.js` — **não existe** | Remover/corrigir ref |
| `pmo-bot-go/docs/PLAN-mutation-hardening.md` | Referencia `internal/mcp/specialized_handlers.go` — **não existe**; o arquivo é `internal/state/specialized_handlers.go` | Corrigir o path |
| `docs/PLAN-supabase-rpc-error.md` | Cita `20260401000000_multi_modalidade.sql` (linha 10) — migration **não existe** em `supabase/migrations/` | Corrigir o nome da migration |
| `docs/PLAN-adubacao-milho.md` | Cita `supabase/migrations/20260525_expand_agronomic_engine.sql` (linha 22) — real é `20260525120000_expand_agronomic_engine.sql` | Corrigir o timestamp |
| `docs/live-chat-monitor.md` | Cita `20260610_evolve_messages_table.sql` (linha 9) — real é `20260610120000_evolve_messages_table.sql` | Corrigir o timestamp |
| `docs/architecture/adr/010-multitenancy-por-organizacao.md` | Referencia migration `20260124192000_harden_rls_strategies.sql` (linha 44) — **não existe** | Corrigir/remover ref |
| `docs/architecture/adr/007-pdf-extraction-pymupdf.md` | Referencia `chunk_verify.txt` (como `../../../chunk_verify.txt`, linha ~182) — **arquivo não encontrado** | Corrigir/remover ref |
| `docs/plans/PLAN-onboarding-integration.md` | Referencia `askorth_reference.md` — **não existe** em lugar nenhum; e `src/lib/supabase.ts` — **não existe** | Corrigir/remover refs |
| `docs/plans/PLAN-rpi-integration.md` | Referencia `.agent/rules/GEMINI.md`, `.agent/skills/brainstorming/SKILL.md`, `.agent/skills/intelligent-routing/SKILL.md`, `.agent/workflows/orchestrate.md` — **nenhum existe** (a árvore `.agent/skills/` foi reorganizada) | Corrigir refs ou dar a doc como histórico |
| `docs/plans/PLAN-adr-011-chat-abstraction.md` | Comandos citam `python .agent/skills/database-design/scripts/schema_validator.py` e `python .agent/skills/frontend-design/scripts/ux_audit.py` — **não existem** | Corrigir/remover comandos |
| `docs/backend/compliance.md` | Referencia `internal/compliance/blacklist.go` — **não existe**; a blacklist vive em `internal/supabase/client.go` (campos `blacklistCache`, linhas ~29, 435-457) | Corrigir para o path real |
| `docs/specs/business_rules.md` | Referencia `internal/compliance/blacklist.go` — **não existe** (mesma correção do item acima) | Corrigir para `internal/supabase/client.go` |
| `docs/backend/fsm.md` | Referencia `internal/mcp/loopguard.go` — **não existe**; `LoopGuard` está definido em `internal/mcp/server.go:33` | Corrigir o path |
| `docs/backend/weather.md` | Referencia `cmd/tester/weather/main.go` — **não existe** (só `cmd/tester/arena/main.go`) | Corrigir/remover ref |
| `docs/specs/task_judge.md` | Referencia `internal/knowledge/judge_service.go` — **não existe**; o avaliador vive em `internal/knowledge/evaluator.go` | Corrigir o path |
| `pmo-bot-go/docs/state.md` | Linka `dt126-otp-loop.md` relativo a `pmo-bot-go/docs/` — só existe na **raiz** do repo | Corrigir path do link |
| `pmo-bot-go/docs/MULTITENANCY.md` | Linka `architecture/adr/010-multitenancy-por-organizacao.md` relativo a `pmo-bot-go/docs/` — o arquivo real é `docs/architecture/adr/010-...md` na raiz | Corrigir path do link |

---

## Tipo 2 — Claim tecnicamente falsa (código diverge do que a doc afirma)

| Arquivo | Evidência (trecho + caminho/linha atual) | Sugestão |
|---|---|---|
| `docs/CHECKPOINT-feature-multicanal.md` | Linha 171 marca `internal/adapter/wppconnect/adapter.go` como ✅ — **o package `wppconnect` não existe**. Linha 246 afirma "MessageSender — interface removida" — `MessageSender` **ainda está definido** em `pmo-bot-go/internal/ports/whatsapp.go:8` | Corrigir as duas afirmações |
| `docs/specs/overview.md` | Descreve backend **Python/Flask** (`pmo_bot/webhook.py`, `pmo_bot/modules/`) e modelo primário `llama-3.3-70b-versatile` com WPPConnect (`localhost:21465`, sessão `NERDWHATS_AMERICA`) — tudo migrado para **Go** (`pmo-bot-go/`), **Gemini/OpenRouter** e **Evolution API**; `pmo_bot/` não existe | Reescrita ou marcação como histórico |
| `docs/specs/README.md` | Descreve "Backend (Python/Flask)" com `pmo_bot/models/`, `pmo_bot/services/`, importações `from services.notification_service import ...` — tudo obsoleto (backend é Go) | Atualizar ou marcar como histórico |
| `docs/specs/conventions.md` | Árvore e convenções de `pmo_bot/` Python, `requirements.txt`, "206 testes implementados" em testes `.py` — obsoleto (Go, `go.mod`) | Atualizar para o padrão Go real |
| `docs/specs/integration_contracts.md` | Documenta integração com **WPPConnect** (`localhost:21465`, `NERDWHATS_AMERICA`) e exemplos de código Python (Groq `client.chat.completions`) — ambos obsoletos; sistema usa Evolution API e Go | Atualizar contrato |
| `docs/specs/PMO_DATA_STRUCTURE.md` | Bug #001 referencia `backend/sincronizar_secao_8.py` e `frontend/src/pages/PmoFormPage.jsx` — backend Python não existe; `PmoFormPage.jsx` virou `.tsx` | Corrigir refs |
| `wiki/concepts/rag-e-base-de-conhecimento.md` | Linha 20 descreve **Rerank como fase 5 do pipeline de produção**; `pmo-bot-go/docs/debitos_tecnicos.md` **DT-71** afirma explicitamente que "o rerank Cohere está implementado mas **só é exercitado pelo binário de arena; produção nunca passa por ele**" | Resolver a divergência (promover rerank ou remover a fase 5 da wiki) |
| `wiki/components/pmo-bot-go.md` | Linha 47 lista binários `server`, `ingestor`, `reindex`... — **`cmd/ingestor` não existe** (Os reais: `check_all_tools`, `evaluate`, `loadtest`, `loadtest_piper`, `pricing-refresh`, `reindex`, `server`, `tester`, `test_audio`, `test_gemini_api`, `test_openrouter`, `test_schema`) | Corrigir lista de binários |
| `wiki/components/supabase-postgres.md` | Linha 10: "`supabase/migrations/` **~60 migrations**" — o diretório contém **98** arquivos `.sql` | Atualizar a contagem |
| `pmo-frontend/docs/ROADMAP.md` | "Migração total de MUI para Tailwind (**Em andamento**)" — MUI não aparece mais em `dependencies` (só `@base-ui/react`); a migração está efetivamente completa | Marcar como concluída |
| `pmo-frontend/docs/context.md` | Referencia `src/pages/DashboardPage_MUI.jsx` e `src/components/Common/TabelaDinamica_MUI.jsx` — **não existem**; os arquivos atuais são `src/pages/DashboardPage.tsx` e `src/components/PmoForm/TabelaDinamica.tsx` | Corrigir paths |
| `pmo-frontend/docs/architecture_audit.md` | Referencia `TabelaDinamica_MUI.jsx/tsx` e `FastTextField` como existentes — **nenhum existe** (grep 0 hits); recomendações de criar `<SafeSelect/>`/`<AppTextField/>`/hook `useCadernoRegistro` — **nunca implementados** | Corrigir claims / marcar recomendações como não executadas |
| `pmo-frontend/docs/magic_strings_audit.md` | Afirma que `ActivityType` enum "não existe" e recomenda criá-lo — o enum **já existe** em `src/types/CadernoTypes.ts:7` (PLANTIO, MANEJO, COLHEITA, VENDA, COMPOSTAGEM, OUTRO, INSUMO, CANCELADO); recomenda também criar `src/constants/units.ts` — nunca criado (constantes vivem em `useUnitSelection.ts`) | Atualizar status da auditoria |
| `docs/concepts/rpi-optimizations.md` | Cita arquivo `src/pages/DashboardPage_MUI.tsx` — **não existe** (o atual é `DashboardPage.tsx` sem sufixo `_MUI`); checklist valida "✅" itens que apontam para arquivo inexistente | Corrigir nome/status |
| `docs/frontend/offline.md` | Cita hooks `useSync` e `useCadernoSync` — o hook real é `useSyncEngine` (`src/hooks/offline/useSyncEngine.ts`); `useCadernoSync` **não existe** | Corrigir nomes |
| `docs/concepts/offline-sync.md` | Idem: cita `useSync` e `useCadernoSync` como hooks de sync — `useCadernoSync` **não existe**; sync real via `useSyncEngine` | Corrigir nomes |
| `docs/frontend/pages.md` | Lista `DiarioDeCampo` como página `/caderno` (é componente `src/components/DiarioDeCampo.tsx`); faz referência a "React 18" (repo usa React 19.1); não lista páginas reais existentes (`FinanceiroPage`, `FarmHubPage`, `MuralDemandas`, `OnboardingPage`, `PropertyProfilePage`, `PublicTraceabilityPage`, `PmoParaImpressao`, `DesignLab`, `AuthCallback`) | Atualizar mapa de páginas |
| `docs/backend/fsm.md` | Afirma LoopGuard "excede **5 iterações**" com "mesma ferramenta 2 vezes" — o código usa `NewLoopGuard(2)` (`fsm.go:527`) e `NewLoopGuard(3)` (`handler.go:536`), limites variam; nenhum é 5 | Corrigir os valores |
| `docs/backend/agents.md` | Cita `GetPromptForIntent` como método em `gemini/client.go` (método real é `prompt.ForIntent` — só o teste ainda usa o nome antigo) + relembra `internal/compliance/blacklist.go` inexistente | Corrigir nomes |
| `docs/database/CURRENT_SCHEMA_VISUALIZATION.md` | Diagrama não reflete as muitas migrations posteriores (não lista `message_queue`/`rag_*`/ledger etc.); pode induzir a schema errado | Regenerar a partir do schema vivo |
| `docs/research_audit.md` | Linha 53 aponta `match_farm_documents` como RPC RAG principal — ela existe mas foi **superada** por `match_documents_with_context(_1024)`, que é o que o código chama (`client.go:1083`) | Atualizar para a RPC real |
| `docs/architecture/overview.md` | Diagrama/camadas citam "**WPPConnect Gateway**" e "React 18" — o fluxo real usa **Evolution API** (ver `data-flow.md`) e React 19 | Alinhar com `data-flow.md` |

---

## Tipo 3 — Doc órfã (não linkada por DOCUMENTATION-INDEX.md nem wiki-index.md)

| Arquivo | Evidência | Sugestão |
|---|---|---|
| `docs/checkpoint-2026-09-06.md` | Criado em 06/09; **não consta** no DOCUMENTATION-INDEX.md (gerado em 06/09) nem na wiki-index | Adicionar ao índice ou arquivar |
| `docs/branch-inventory-2026-09-06.md` | **Não consta** em nenhum dos dois índices | Adicionar ao índice ou arquivar |
| `docs/CHECKPOINT-feature-multicanal.md` | **Não consta** nos índices (só `FEATURE-multicanal.md` e `PLAN-feature-multicanal.md` estão linkados) | Linkar ou arquivar (ver também Tipo 2: contém claims falsos) |
| `docs/PLAN-feature-multicanal.md` | **Não consta** nos índices (a feature em si, `FEATURE-multicanal.md`, está linkada) | Linkar se ainda relevante |
| `docs/concepts/webhook-auth-evolution.md` | **Não consta** nos índices (a lista de concepts/ do índice tem só `offline-sync`, `prd-agrovivo`, `rpi-optimizations`) | Adicionar ao índice |
| `pmo-bot-go/docs/RUNBOOK-ai-memory-setup.md` | **Não consta** no DOCUMENTATION-INDEX.md (só `RUNBOOK-envio-manual-whatsapp.md` está) nem na wiki-index | Adicionar ao índice |
| `pmo-bot-go/docs/PLAN-sprint-pre-viagem-2026-09-08.md` | **Não consta** nos índices — provável por ser do dia de hoje (índice é de 06/09) | Adicionar ao índice quando concluído |
| (demais) | Raiz: `dt126-otp-loop.md`, `session-ses_f904.md`, `new-in-devtools-152.md`, `CLAUDE.md` também não constam — mas são logs/sessões ou duplicam AGENTS.md; incluir por completude | Registrar como fora do índice intencionalmente ou linkar |

---

## Tipo 4 — Plano/pesquisa completado mas não arquivado nem com status final

| Arquivo | Evidência | Sugestão |
|---|---|---|
| `docs/PLAN-bge-m3-migration.md` | Migration `sql/migration_1024` + `GetEmbedding` dual-route (`internal/supabase/client.go:228`) + `cmd/reindex/main.go` **implementados**; doc ainda termina em "Open Questions" sem status | Arquivar/`status: concluído` |
| `docs/PLAN-adubacao-milho.md` | Migration `20260525120000_expand_agronomic_engine.sql` **existe e aplica** o conteúdo planejado (Milho Grão/Silagem, wildcard em `calcular_balanco_nutricional`) | Arquivar |
| `docs/PLAN-contextual-windowing.md` | `match_documents_with_context` + `MatchFarmDocumentsContext` **implementados**; doc sem status final | Arquivar |
| `docs/PLAN-fsm-agentic-loop.md` | `ConsultarLeiOrganica_RAG` (`tools_registry.go:151`) e `handleConsultarLeiOrganica` (`tools_rag.go:227`) **existem**; doc sem atualização de status | Arquivar |
| `docs/PLAN.md` | Infra do judge (`rag_run_judgments`, `AutomatedEvaluator`, `cmd/evaluate`) **tudo existe**; doc termina em "User Approval Required" | Arquivar |
| `docs/plans/PLAN-rag-tabela-fix.md` | Todos os checkboxes marcados `[x]` e validação completa (Opção B/UNION ALL aplicada, teste WhatsApp ok) | Arquivar |
| `docs/plans/PLAN-fase-2-financeiro.md` | `20260607_fase2_ledger_rateio.sql` + tool `registrar_compra_insumo` + `financeiroTypes.ts` + `useTransacoes.ts` + `TransacoesTable.tsx` **todos existem** | Arquivar |
| `docs/plans/PLAN-compra-form-sync.md` | `useRecordFormState.ts`, `useRecordValidation.ts`, `useManualRecordSave.ts`, `ManualRecordDialog.tsx`, `ComprasForm.tsx` **todos existem** | Arquivar |
| `docs/plans/GUARDRAILS_PLAN.md` | `business.go`/`business_test.go` + `BusinessEvaluator` injetado em `handler.go`/`orchestrator.go`/`handlers_manejo.go`/`handlers_financeiro.go` + `limites_seguranca` consultada em `client.go:2215` | Arquivar |
| `docs/plans/FINANCIAL_READINESS_AUDIT.md` | Itens de "O que refatorar" implementados (`rpc_registrar_transacao_com_rateio` existe; `Alocacoes` está no `AcaoEstruturada`) | Arquivar |
| `docs/plans/FINANCIAL_MODULE_PLAN.md` | Fases 01/02 (fundação de dados + cérebro financeiro) implementadas — migration ledger + RPC + `TransacaoFinanceira` | Arquivar (revisar se Fases 03/04 seguem abertas) |
| `docs/plans/deterministic-audit-backend.md` | `internal/supabase/audit.go` + `RawPayloadID` em `ports/channel.go:78` + `UpdateRawPayloadStatus` usado nos pipelines — tudo implementado | Arquivar |
| `docs/plans/PLAN_NER_EXECUTION.md` | `AcaoEstruturada` (`llm/types.go:373`), `Entities []AcaoEstruturada` em `UnifiedIntentResult`, `dispatchEntity` (`fsm.go:724`) — implementado | Arquivar |
| `docs/plans/PLAN_PHASE_3_NER.md` | Mesmo alvo do NER implementado (ver acima) | Arquivar |
| `docs/plans/timeout-time-finance-fix.md` | `20260606_fix_registrar_colheita.sql` existe + ajustes de timeout aplicados | Arquivar |
| `docs/PLAN-supabase-rpc-error.md` | O fix proposto (`20260607_fase2_ledger_rateio.sql`) existe e o fluxo está implementado | Arquivar (corrigir antes o nome da migration no corpo — ver Tipo 1) |
| `pmo-bot-go/docs/PLAN-dt18-frontend-write-migration.md` | Trabalho documentado como completo pelos próprios débitos (DT-18 concluído em 2026-09-05) | Arquivar |
| `pmo-bot-go/docs/plans/PLAN.md` | Marcado como completo/histórico pelo próprio conteúdo (referencia `llm-wiki.md`) | Arquivar/mover se ainda não estiver em archive |

---

## Divergências entre docs sobre o mesmo assunto (item 5 do escopo)

| Docs conflitantes | Divergência | Ação sugerida |
|---|---|---|
| `wiki/concepts/rag-e-base-de-conhecimento.md:20` **vs** `pmo-bot-go/docs/debitos_tecnicos.md` DT-71 | Wiki diz que Rerank é fase **5 do pipeline de produção**; o débito oficial diz que "produção **nunca passa por ele**" (só o binário de arena usa) | Não decidir qual está certa; abrir rodada para reconciliar ou promover o rerank (DT-71/DT-72) |
| `docs/PLAN-fase-2-financeiro.md` **vs** `docs/plans/PLAN-fase-2-financeiro.md` | **Dois arquivos com o mesmo nome/conteúdo** em pastas diferentes (raiz de `docs/` e `docs/plans/`) — risco de os dois divergirem silenciosamente | Dedicar um como canônico e arquivar o outro |
| `docs/research/RESEARCH_STRUCTURED_OUTPUT.md` **vs** `pmo-bot-go/docs/research/RESEARCH_STRUCTURED_OUTPUT.md` | **Duplicata do mesmo documento** em duas árvores de docs | Consolidar em um local e linkar o outro |
| `docs/architecture/overview.md` **vs** `docs/architecture/data-flow.md` | overview cita **WPPConnect Gateway**; data-flow cita **Evolution API** — contradição sobre o mesmo componente | Alinhar |

---

## DT-XX referenciados que já não estão como citados no board (item 6 do escopo)

| Arquivo | DT citado | Estado no board (`pmo-bot-go/docs/debitos_tecnicos.md`) | Sugestão |
|---|---|---|---|
| `docs/audit-bigpickle-2026-09-05.md` (linha ~393) | Diz que os achados "ainda **não** receberam ID" — mas o próprio `docs/audit-defesa-profunda-2026-09-06.md` e o board registram os mesmos achados como **DT-106..DT-118** e o DT-71/DT-72 já existiam | Débitos existem e estão catalogados | Atualizar a nota de triagem do relatório |
| `docs/branch-inventory-2026-09-06.md` (linha 317) | DT-44 descrito como "**aberto no board** (corrigir validando DV)" | **DT-44 está marcado como Resolvido em 2026-09-06** (validado DV, cherry-pick `7029433`/`3b0f5cc`/`e62dd9c`) | Atualizar o inventário |
| `docs/branch-inventory-2026-09-06.md` | `cmd/knowledge_loader` citado como ausente e commit `845a44c` "ABSORVIDO via DT-07" | DT-07 concluído em 2026-09-02 e `cmd/knowledge_loader` nunca existiu (removido) — consistente, mas a doc usa nomes de branches/histórico pré-filtro | Revisar se mantém valor após a poda do histórico (DT-124) |

> As demais referências DT-XX em doc (DT-127, DT-124, DT-125, DT-128, DT-18, DT-70, DT-62, DT-67,
> DT-93..DT-118, DT-109, DT-38, DT-45 etc.) foram conferidas contra o board e **continuam válidas**
> — estão registradas como A Fazer/Em Andamento/Concluído consistentemente com o que as docs citam.

---

## Observed details relevantes

- **Padrão recorrente:** links `file:///c:/Users/brunn/...` (usuário `brunn`, não `T-GAMER`) em
  `docs/PLAN-bge-m3-migration.md`, `docs/PLAN-adubacao-milho.md`, `docs/PLAN-limites-seguranca.md`,
  `docs/PLAN-fsm-agentic-loop.md`, `docs/PLAN-rag-threshold.md`, `docs/live-chat-monitor.md`,
  `docs/specs/ai_retry_plan.md`, `docs/plans/PLAN-fase-2-financeiro.md`,
  `docs/plans/PLAN-compra-form-sync.md` — path absoluto de outra máquina, quebrado aqui.
- **Cadeia `docs/specs/` é a mais degradada:** architecture do Flask antigo inteira (overview,
  README, conventions, integration_contracts). Candidata forte a arquivamento em bloco com
  ponteiro para `docs/architecture/` e `wiki/components/`.
- **`pmo-bot-go/docs/architecture/001-llm-agnostico-fallback.md` está VAZIO** (arquivo sem
  conteúdo) — referenciado de vários pontos como decisão arquitetural.
- Índices principais (`DOCUMENTATION-INDEX.md`, `wiki/wiki-index.md`) têm 3 links mortos
  reais (ver Tipo 1) e deixam de fora 7 docs existentes (ver Tipo 3).

---

*Gerado em 2026-09-08. Nenhum arquivo foi modificado por esta rodada.*