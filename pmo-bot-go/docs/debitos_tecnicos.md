# 🗂️ Débitos Técnicos & Pendências — pmo-bot-go

> Documento formal de acompanhamento, consolidado a partir de `state.md` e `estado_tarefa.md`.
> Última atualização: **2026-08-17**

---

## Como usar este documento

- Cada item tem um **ID** único (`DT-XX`) para referência em commits, PRs e mensagens (`git commit -m "DT-01: rotaciona service_role key"`).
- Status possível: `🔴 A Fazer` · `🟡 Em Andamento` · `🟢 Concluído` · `⚪ Bloqueado/Decisão Pendente`
- Ao mover um item de coluna, atualize também a seção **Histórico** no final do arquivo.
- Este arquivo substitui o rastreio informal que vinha sendo feito via `state.md` / `estado_tarefa.md` — mantenha-o como fonte única de verdade para débitos.

---

## 🔴 A Fazer

| ID | Item | Categoria | Prioridade | Arquivo(s) |
|----|------|-----------|------------|------------|
| DT-01 | Rotacionar `service_role` key do Supabase (crítico pois a tabela `mutation_drafts` depende de service_role e trafega dados sensíveis). **Nota da Sessão**: Durante a Fase 2.2, o `SUPABASE_ACCESS_TOKEN` também foi exposto em texto plano e revogado. Adotar o hábito para toda a equipe de NUNCA colar segredos em comandos visíveis no terminal (usar prompts interativos ou variáveis lidas com input mascarado). | Segurança | 🔥 Alta | `.env` / Supabase Dashboard |
| DT-02 | Remover ou marcar como `deprecated` o método `InsertFarmDocument` (órfão, grava só na coluna legada 3072d/Gemini) | Código Legado | Média | `internal/supabase/client.go` |
| DT-03 | Corrigir filename hardcoded (`"audio.ogg"`) no pipeline legado de áudio | Código Legado | Média | `internal/state/fsm.go`, `media_worker.go` |
| DT-04 | Descomissionar interface legada `llm.LLMProvider` (FSM) em favor de `ports.LLMProvider` | Código Legado | Média | `internal/state/`, `internal/llm/` |
| DT-05 | Atualizar/padronizar `GEMINI_MODEL` e demais model IDs no `.env` com base no Model Shootout (`deepseek-v4-flash`, `hy3-preview`) | RAG/Modelos | Média | `.env` |
| DT-06 | Remover diretório `scratch/` e node_modules do laboratório de embeddings offline (Transformers.js) | Limpeza | Baixa | `scratch/` |
| DT-13 | Suporte opcional a Botões Interativos da Evolution API para confirmação de rascunhos HITL (fallback automático para texto livre) | UX / Webhook | Baixa | `internal/adapter/evolution/`, `internal/webhook/` |
| DT-18 | **ÉPICO**: Migrar escrita direta do `pmo-frontend` para RPCs `SECURITY DEFINER` antes de aplicar REVOKE global de grants. Auditoria confirmou que `pmo-frontend` grava direto em tabelas via SDK do Supabase usando anon/authenticated (arquivos: `cadernoService.ts`, `propriedadeService.ts`, `talhaoService.ts`, `pmoService.ts`, `TabelaDinamica.tsx`, `VegetalImportDialog.tsx`, `Secao9.tsx`). A migração `20260816030000_revoke_broad_grants.sql.pending` está pronta mas NÃO deve ser aplicada até essa migração ser concluída, ou ela quebra essas gravações. | Segurança/Frontend | 🔥 Alta | `pmo-frontend/src/...` |
| DT-19 | Investigar drift histórico de migrações anteriores à Fase 2.2. O `supabase migration list --linked` revelou pares com nomes dessincronizados entre local e remoto (datas 20260525, 20260526, 20260609, 20260610). Não bloqueou o deploy, mas indica que o projeto já tinha histórico de renomeação. Investigar se é apenas dessincronia de nome ou se representa schema realmente divergente entre ambientes. | Manutenção/DB | Média | `supabase/migrations/` |
| DT-21 | **Separação de Ambientes (Staging vs Prod)**: Atualmente, Staging e Produção compartilham o mesmo projeto Supabase (`hejewayflbuemnffrhae`). Criar um segundo projeto dedicado a Staging e utilizar `supabase link` / branching model para isolar testes de alterações críticas (ex: correções de segurança e RLS) antes de impactar dados reais. | DevOps | Média | Supabase Dashboard |
| DT-22 | **Schema Drift Crítico (Local vs Prod)**: O ambiente remoto (Staging/Prod) possuía alterações não versionadas em migrations locais: (1) colunas extras em `profiles`, (2) FK nativa para `pmos`, (3) RLS recursivo infinito na policy de Admin e (4) coluna `canteiro_id` + FK ausentes em `caderno_campo_canteiros`. A falta de paridade quebrou testes locais. Criadas migrations corretivas (finais `212500`, `213000` e `214500`) de forma estritamente idempotente para reestabelecer o rastreio oficial sem quebrar Prod. | Manutenção/DB | 🔥 Alta | `supabase/migrations/` |


## ⚪ Bloqueado / Decisão Pendente

| ID | Item | Decisão Necessária | Opções |
|----|------|---------------------|--------|
| DT-07 | Futuro do `rag_ingest.py` (Docling) | Aposentar em favor do `cmd/ingestor` (Go) ou manter como pré-processador isolado? | (a) Migrar tudo para Go / (b) Manter híbrido |
| DT-08 | Política de acesso ao painel Knowledge Ops | Reabrir para produtores ou manter restrito ao admin? | (a) Abrir para produtores / (b) Restrito a admin |

## 🟡 Em Andamento

*(nenhum item no momento)*

## 🟢 Concluído

| ID | Item | Concluído em | Observações |
|----|------|---------------|-------------|
| DT-00 | Fase 2.1 — Idempotência e migrações no PostgreSQL Staging | 2026-08-16 | Validada com testes unitários e de integração real |
| DT-09 | Two-Phase Commit com tabela `mutation_drafts` no PostgreSQL e TTL de 45min | 2026-08-17 | Fase 2.2 deployada em staging com sucesso (2026-08-16). As 3 migrações (000000, 010000, 020000) confirmadas idênticas entre local e remoto via `supabase migration list --linked`. |
| DT-10 | Tool única polimórfica `propose_batch_mutations(operations: [...])` | 2026-08-17 | Unio discriminada por `type` (`caderno_campo`, `compra_insumo`, `transacoes_com_rateio`, `cotas_produtores`) |
| DT-11 | Normalização determinística de respostas de confirmação HITL por palavras-chave | 2026-08-17 | `ClassifyHITLResponse` antes de chamada a LLM com fallback robusto |
| DT-12 | Substituição atômica via `create_or_supersede_mutation_draft` e terminalidade de rascunhos com erro | 2026-08-17 | Prevenção de race condition sob `FOR UPDATE` e índice único parcial `idx_mutation_drafts_one_pending` |
| DT-20 | Hotfix IDOR Crítico: `setup_initial_profile` mitigado | 2026-08-17 | Vulnerabilidade de sequestro fechada (Staging). Nota: Auditoria manual de baixo volume (N=6), sem cruzamento sistemático de created_at/duplicidade — aceitável devido à volumetria, mas não é garantia formal. |

---

## 🎯 Próxima Frente Ativa

**Fase 3 — Refinamento do RAG, Rotação de Segredos e Polimento Operacional:**
1. Executar rotação da `service_role` key do Supabase (`DT-01`).
2. Limpeza de código legado (`DT-02`, `DT-03`, `DT-04`, `DT-06`).
3. Decisão sobre `rag_ingest.py` e consolidação definitiva no pipeline Go (`DT-07`).

---

## 📜 Histórico de Mudanças

| Data | Alteração |
|------|-----------|
| 2026-08-16 | Documento criado a partir da consolidação de `state.md` + `estado_tarefa.md` |
| 2026-08-16 | Adicionadas decisões arquiteturais da Fase 2.2 (mutation_drafts/HITL) — DT-09 a DT-12 |
| 2026-08-17 | Concluída Fase 2.2 (DT-09 a DT-12): Migração SQL, RPCs atômicas, tool `propose_batch_mutations`, interceptor webhook HITL e 100% dos testes de concorrência e integração |

---

## Notas de Manutenção

- Ao resolver um item, mova-o para **🟢 Concluído**, registre a data e apague a linha correspondente das colunas anteriores.
- Itens novos entram sempre em **🔴 A Fazer** com um novo `DT-ID` sequencial.
- Revisar este documento a cada marco de fase para evitar que volte a virar rastreio informal espalhado por múltiplos arquivos.
