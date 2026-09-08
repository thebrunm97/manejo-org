# Inventário Profundo de Branches — 2026-09-06

- **Data:** 2026-09-06
- **Contexto:** levantamento solicitado após a poda do histórico git (DT-124) e o commit `34f943a`
  na branch ativa `fix/bigpickle-bugfix-loop`. **Nenhuma branches/tag foi alterada, deletada
  ou pushada nesta análise** — apenas leitura.
- **Referência de comparação:** `main` = `959603c` (último commit `feat: integração RabbitMQ,
  debouncer e melhorias UX/resiliência`, **2026-08-30**).
- **Método:** leitura via `git for-each-ref`, `git rev-list --left-right --count`, `git log`,
  `git merge-base --is-ancestor` e comparação SHA local × remota por nome. Worktrees verificadas
  com `git worktree list` + `git status --porcelain`.
- **Complemento 2026-09-06 (investigação de absorção):** seção 9 — cruzamento commit-a-commit dos
  10 ramos não-mergeados contra o tip `fix/bigpickle-bugfix-loop` (`34f943a`) via patch-id
  (`git show <c> | git patch-id --stable`) + inspeção do conteúdo (`git grep`/`git show`).
  Continuação pós-aplicação: `docs/checkpoint-2026-09-06.md`.

---

## 1. Resumo executivo

| Métrica | Valor |
|---|---|
| Branches locais | **51** |
| Branches remotas (`origin/*`) | **51** (espelho 1:1 de nomes) |
| Branches só-locais | 0 |
| Branches só-remotas | 0 |
| Branches com `upstream`/tracking configurado | **0** (nenhuma) |
| Branches cujo tip local **difere** do remoto de mesmo nome | **1** (`fix/bigpickle-bugfix-loop`, 4 commits à frente) |
| Branches ≠ `main` | 50 |
| → **Mergeadas em `main`** (ancestrais de `main`, candidatas a deleção segura) | **40** |
| → **Frente de `main`** (puras, sem divergência, 100% contidas) | **4** |
| → **Divergentes** de `main` (commits únicos dos dois lados) | **6** |
| Worktrees ativas | 4 (1 principal + 3 em `.claude/`) |
| Worktrees com **trabalho não commitado** | 3 (1, 1 e 28 arquivos) |
| Commits únicos somados das 10 branches não-mergeadas | **121** |

Leituras mais importantes:

1. **`fix/bigpickle-bugfix-loop` (a branch atual) carrega 54 commits acima de `main`** — não é
   uma branch pequena; concentra o trabalho recente do loop BigPickle (auditorias, DT-105..DT-125,
   correções de security, onboarding, memory cache, etc.). `main` parou em 2026-08-30.
2. **Nenhuma branch tem upstream configurado.** O push forçado do DT-124 (`--all --tags`) criou o
   espelho remoto, mas não configurou `branch.<nome>.remote/.merge`. Consequência prática: `git
   status`/`git branch -vv` não mostram ahead/behind em relação ao remoto; a única forma de saber é
   comparar SHAs por nome (feita aqui).
3. **As 3 branches `dt-*` divergentes formam uma família encadeada**: `dt-04/finalizacao` (4 commits)
   está contida em `dt-37/prompt-caching-finalize` (5 commits, = os 4 da dt-04 + 1); `dt-44` nasce do
   mesmo merge-base (`87c2e1e`). São o mesmo trabalho de refactor do DT-04 com ganchos por cima.
4. **As branches `claude/*` apontam para SHAs reescritos pelo `git filter-repo`** (DT-124) e vivem em
   worktrees do Claude Code; duas delas (`magical`, `modest`) são 100% frente de `main`, a terceira
   (`optimistic`) diverge e tem o worktree mais sujo (28 arquivos).
5. **Compatibilidade pós-filter-repo intacta:** como todas as branches foram reescritas, a análise de
   ancestralidade (merge-base/`is-ancestor`) continua válida e consistente; as tags reescritas no
   DT-124 não afetam este inventário.

---

## 2. Estado de cada uma das 51 branches

Legenda de estado (relativo a `main`):
- **MERGEADA** = tip é ancestral de `main` → tudo que a branch tem já foi integrado por outros
  caminhos (geralmente squash/merge linear do trabalho). Deleção local+remota é segura.
- **FRENTE** = `main` é ancestral da branch e a branch tem commits próprios adicionais → branch pura,
  trabalhou por cima do main atual; mesclar com nação direto, sem conflito estrutural esperado.
- **DIVERGENTE** = nem `main` é ancestral da branch nem vice-versa → há commits dos dois lados; a
  branch carrega trabalho não integrado que precisa de merge/rebased decisão.

Contagem para `Ahead`/`Behind`: `git rev-list --left-right --count main...<branch>`
→ `Ahead` = commits só no `main`, `Behind` = commits só na branch.

| Branch | Estado | Ahead | Behind | Últ. commit | Worktree |
|---|---|---|---|---|---|
| `archive/python-mvp` | MERGEADA | 387 | 0 | 2026-03-06 | |
| `bot-update` | MERGEADA | 240 | 0 | 2026-03-26 | |
| `dt-04/narrow-state-llmclient` | MERGEADA | 73 | 0 | 2026-08-23 | |
| `feat/agente-cooperativa` | MERGEADA | 189 | 0 | 2026-04-03 | |
| `feat/audio-strategy-adapter-pipeline` | MERGEADA | 81 | 0 | 2026-08-15 | |
| `feat/go-bot-stable` | MERGEADA | 399 | 0 | 2026-03-04 | |
| `feat/go-core-stable` | MERGEADA | 387 | 0 | 2026-03-06 | |
| `feat/llm-agnostic-phase1-prompts` | MERGEADA | 99 | 0 | 2026-07-21 | |
| `feat/maplibre-migration` | MERGEADA | 253 | 0 | 2026-03-26 | |
| `feat/mcp-agent-tools` | MERGEADA | 380 | 0 | 2026-03-06 | |
| `feat/mcp-declarative-infra` | MERGEADA | 234 | 0 | 2026-03-27 | |
| `feat/upgrade-bot` | MERGEADA | 236 | 0 | 2026-03-27 | |
| `feat/v0.13.0-compostagem` | MERGEADA | 305 | 0 | 2026-03-24 | |
| `feature/landing-page-refresh` | MERGEADA | 129 | 0 | 2026-06-09 | |
| `feature/latency-tracing` | MERGEADA | 114 | 0 | 2026-07-09 | |
| `feature/migracao-tailwind` | MERGEADA | 424 | 0 | 2026-02-20 | |
| `feature/onboarding-mockup` | MERGEADA | 5 | 0 | 2026-08-25 | |
| `feature/phase-3-testing` | MERGEADA | 92 | 0 | 2026-07-30 | |
| `feature/phase-4-multitenancy-audit` | MERGEADA | 87 | 0 | 2026-08-11 | |
| `feature/tailwind-migration-e-onboarding` | MERGEADA | 412 | 0 | 2026-02-25 | |
| `feature/tts-hybrid-architecture` | MERGEADA | 13 | 0 | 2026-08-24 | |
| `fix/audio-tts-llm-observabilidade` | MERGEADA | 59 | 0 | 2026-08-22 | |
| `fix/map-full-bleed-redesign` | MERGEADA | 276 | 0 | 2026-03-25 | |
| `fix-map` | MERGEADA | 243 | 0 | 2026-03-26 | |
| `laser-turnip` | MERGEADA | 94 | 0 | 2026-07-21 | |
| `qa/night-shift` | MERGEADA | 359 | 0 | 2026-03-09 | |
| `redesign` | MERGEADA | 207 | 0 | 2026-03-29 | |
| `refactor/dt-04-mcp-narrow-llm-interface` | MERGEADA | 73 | 0 | 2026-08-23 | |
| `refactor/evolution-branding-ui` | MERGEADA | 162 | 0 | 2026-04-17 | |
| `refactor/evolution-switch` | MERGEADA | 186 | 0 | 2026-04-06 | |
| `refactor/langchain-v1` | MERGEADA | 400 | 0 | 2026-02-27 | |
| `refactor/mcp-context-injection` | MERGEADA | 92 | 0 | 2026-07-30 | |
| `refactor/ponytail-core-cleanup` | MERGEADA | 92 | 0 | 2026-07-30 | |
| `refactor/ts-crusade` | MERGEADA | 372 | 0 | 2026-03-07 | |
| `tipografia` | MERGEADA | 206 | 0 | 2026-03-30 | |
| `worktree-agent-a23bb55a594af503b` | MERGEADA | 73 | 0 | 2026-08-23 | |
| `worktree-agent-a350a2bf226af7d6d` | MERGEADA | 73 | 0 | 2026-08-23 | |
| `worktree-agent-a72443ff9291a3f8a` | MERGEADA | 73 | 0 | 2026-08-23 | |
| `worktree-agent-a803817589bf8ce88` | MERGEADA | 74 | 0 | 2026-08-21 | |
| `worktree-agent-a96846b0546e9444d` | MERGEADA | 74 | 0 | 2026-08-21 | |
| `claude/magical-shamir-a00988` | FRENTE | 0 | 1 | 2026-09-01 | `magical-shamir-a00988` |
| `claude/modest-jang-88f9cb` | FRENTE | 0 | 2 | 2026-09-01 | `modest-jang-88f9cb` |
| `feature/gee-maplibre-integration` | FRENTE | 0 | 46 | 2026-09-03 | |
| `fix/bigpickle-bugfix-loop` | FRENTE | 0 | **54** | 2026-09-06 | (principal) ⭐ local ≠ remoto |
| `claude/optimistic-feynman-ce72b2` | DIVERGENTE | 74 | 3 | 2026-08-24 | `optimistic-feynman-ce72b2` |
| `dt-04/finalizacao` | DIVERGENTE | 64 | 4 | 2026-08-24 | |
| `dt-37/prompt-caching-finalize` | DIVERGENTE | 64 | 5 | 2026-08-24 | |
| `dt-44/pii-cpf-cnpj-validation` | DIVERGENTE | 64 | 1 | 2026-08-24 | |
| `fix/rag-async-worker-insert` | DIVERGENTE | 75 | 1 | 2026-08-21 | |
| `fix/rag-embedding-1024d-backfill` | DIVERGENTE | 86 | 4 | 2026-08-15 | |

---

## 3. As 6 branches DIVERGENTES em profundidade

Para cada: merge-base com `main`, commits **únicos da branch** (`main..branch`), e contexto.

### 3.1 `fix/rag-embedding-1024d-backfill`
- Merge-base com `main`: `1604d80` (anterior ao `main` atual) · último commit **2026-08-15**.
- 4 commits únicos:
  - `845a44c` `fix(rag): stop writing stale 3072d embeddings on document upload`
  - `b00041e` `docs(state): document RAG embedding bugfix and backfill`
  - `6abef78` `chore(cmd): reorganize standalone debug scripts into their own packages`
  - `182dca1` `docs(state): fix stale conclusion in item 4 contradicting item 5`
- **Leitura:** ramo antigo do problema de dimensão de embeddings (o pipeline 3072d vs 1024d que o
  DT-07 resolveu depois, em setembro). Parece **superado pelo trabalho do DT-07/farm_documents** —
  os 2 commits finais são só de docs/estados. Candidata a arquivar/descartar após conferir o DT-07,
  mas merece confirmação de que o `845a44c` já foi absorvido.

### 3.2 `fix/rag-async-worker-insert`
- Merge-base com `main`: `5aae784` · último commit **2026-08-21**.
- 1 commit único:
  - `053bf99` `fix: atualiza query do supabase com o nome correto da FK para evitar ambiguidade`
- **Leitura:** fix pontual de FK no insert assíncrono do RAG. Sem upstream, commits do mesmo trabalho
  podem ter entrado por outro caminho; vale conferir se a correção já vive em `main`/`bigpickle`.

### 3.3 `dt-04/finalizacao`
- Merge-base com `main`: `87c2e1e` · último commit **2026-08-24**.
- 4 commits únicos:
  - `1437b3a` `refactor(state): remove type assertions para llm.LLMProvider (DT-04)`
  - `25e81b7` `refactor(queue): estreita llm.LLMProvider nos workers (DT-04)`
  - `bc8186c` `refactor(webhook): estreita LLMClient para state.LLMClient (DT-04)`
  - `3ac21ec` `refactor(main): substitui llm.LLMProvider por composto aiProvider (DT-04)`
- **Leitura:** o refactor de estreitamento do `llm.LLMProvider` (tema recorrente do DT-04). Esses
  4 commits **estão contidos em `dt-37`** (ver 3.4) — ou seja, a `dt-04` é um subconjunto da `dt-37`.

### 3.4 `dt-37/prompt-caching-finalize`
- Merge-base com `main`: `87c2e1e` (mesmo da `dt-04`) · último commit **2026-08-24**.
- 5 commits únicos:
  - 1437b3a, 25e81b7, bc8186c, 3ac21ec (os 4 da `dt-04`, confirmados como ancestrais desta branch)
  - `adbe7fe` `feat(gemini): injeta cache_control top-level na OpenRouter (DT-37)`
- **Leitura:** a `dt-37` = `dt-04/finalizacao` + 1 (o cache_control). É o "topo" da família DT-04.

### 3.5 `dt-44/pii-cpf-cnpj-validation`
- Merge-base com `main`: `87c2e1e` (mesma família) · último commit **2026-08-24**.
- 1 commit único:
  - `7029433` `fix(guardrails): valida digito verificador antes de redigir CPF/CNPJ (DT-44)`
- **Leitura:** fix de guardrail PII. Nasce do mesmo ponto que a família DT-04, mas é trabalho
  independente (1 commit). Verificar se já foi absorvido no loop BigPickle (o guardrail vive em
  `internal/guardrails/`).

### 3.6 `claude/optimistic-feynman-ce72b2`
- Merge-base com `main`: `1ff9c74` (mais antigo — a branch "pulou" por cima de muito main) ·
  último commit **2026-08-24**.
- 3 commits únicos:
  - `b91e5eb` `feat(security): adiciona gate de segredos com gitleaks (hook + CI)`
  - `7921918` `fix(security): forca EOL LF nos git hooks`
  - `749d0db` `docs(security): registra calibragem contra a branch feature/onboarding-mockup`
- **Leitura:** é o nascimento do gate de gitleaks (que hoje existe como `.gitleaks.toml` + workflow
  `secret-scan.yml`). A funcionalidade já está integrada em `main`/CWD; a branch ficou parada e o
  **worktree `optimistic-feynman-ce72b2` está com 28 arquivos de trabalho não commitado** — o mais
  sujo do repositório. Precisa de decisão explícita antes de qualquer coisa (não tocar).

---

## 4. As 4 branches FRENTE de `main` em profundidade

100% contidas em cima do `main` atual (merge-base = `main` = `959603c`), ou seja, mesclá-las é
fast-forward puro.

### 4.1 `fix/bigpickle-bugfix-loop` ⭐ (branch atual)
- **57 commits** acima de `main` (eram 54; +3 na ação de 2026-09-06 — ver seção 9.4), último
  **2026-09-06**. É a branch que concentra o trabalho da auditoria BigPickle/Defesa Profunda:
  DT-105..DT-125, correções de segurança, onboarding/PKCE, memory cache, poda do histórico git
  (DT-124), remoção do Azure, absorção dos fixes das branches divergentes (DT-44/DT-67/seed — seção 9.4).
  **Tip local `e62dd9c` ≠ remoto `0349682`** — 4 commits não enviados (Azure + 3 da seção 9.4). Nenhuma
  outra branch tem local ≠ remoto.

### 4.2 `feature/gee-maplibre-integration`
- **46 commits** acima de `main`, último **2026-09-03**. Mistura trabalho antigo de mapa (março-abril:
  Earth Engine, NDVI, painel de camadas, `/teste-mapa`) com commits recentes de docs/auditoria
  (DT-02..DT-69, junho-setembro, incl. `4cdc5c0` DT-07). Mesmo sendo classificada como "frente",
  seu conteúdo é estranho a um objetivo único — parece ter absorvido commits de outras linhas no
  meio do caminho. Candidata a revisão: o que resta dela que não entrou no `bigpickle`?

### 4.3 `claude/modest-jang-88f9cb` (worktree)
- **2 commits** acima de `main`:
  - `32d7a22` `fix(queue): corrige deduplicação de message_queue por msg_id (DT-67)`
  - `79e1cdb` `docs: registra aplicação da migration DT-67 em produção e staging`
- **Leitura:** fechamento do DT-67. Worktree com **1 arquivo sujo** não commitado.

### 4.4 `claude/magical-shamir-a00988` (worktree, detached)
- **1 commit** acima de `main`:
  - `61d049a` `fix: corrige seed.sql quebrado e testes real-Postgres apos NOT NULL em organizacoes.slug`
- Worktree em **detached HEAD** (aponta para `61d049a`), **1 arquivo sujo**. Fix de seed/testes.

---

## 5. As 40 branches MERGEADAS (deleção segura?)

Tip ancestral de `main` → já integradas por outros caminhos. Lista completa (últimos commits
mais recentes primeiro):

`feature/onboarding-mockup` (08-25) · `feature/tts-hybrid-architecture` (08-24) ·
`dt-04/narrow-state-llmclient` (08-23) · `refactor/dt-04-mcp-narrow-llm-interface` (08-23) ·
`worktree-agent-a23bb55a594af503b` (08-23) · `worktree-agent-a350a2bf226af7d6d` (08-23) ·
`worktree-agent-a72443ff9291a3f8a` (08-23) · `worktree-agent-a803817589bf8ce88` (08-21) ·
`worktree-agent-a96846b0546e9444d` (08-21) · `fix/audio-tts-llm-observabilidade` (08-22) ·
`feat/audio-strategy-adapter-pipeline` (08-15) · `feature/phase-4-multitenancy-audit` (08-11) ·
`feature/phase-3-testing` (07-30) · `refactor/mcp-context-injection` (07-30) ·
`refactor/ponytail-core-cleanup` (07-30) · `feat/llm-agnostic-phase1-prompts` (07-21) ·
`laser-turnip` (07-21) · `feature/latency-tracing` (07-09) · `feature/landing-page-refresh` (06-09) ·
`refactor/evolution-branding-ui` (04-17) · `refactor/evolution-switch` (04-06) ·
`feat/agente-cooperativa` (04-03) · `tipografia` (03-30) · `redesign` (03-29) ·
`feat/mcp-declarative-infra` (03-27) · `feat/upgrade-bot` (03-27) · `feat/maplibre-migration` (03-26) ·
`fix-map` (03-26) · `bot-update` (03-26) · `fix/map-full-bleed-redesign` (03-25) ·
`feat/v0.13.0-compostagem` (03-24) · `refactor/ts-crusade` (03-07) · `archive/python-mvp` (03-06) ·
`feat/go-core-stable` (03-06) · `feat/mcp-agent-tools` (03-06) · `feat/go-bot-stable` (03-04) ·
`qa/night-shift` (03-09) · `refactor/langchain-v1` (02-27) ·
`feature/tailwind-migration-e-onboarding` (02-25) · `feature/migracao-tailwind` (02-20).

Atenção: várias são de março e carregam nomes de épocas (python-mvp, migracao-tailwind, ts-crusade);
antes de qualquer deleção, validar que nenhum commit "fantasma" único delas faz falta (aqui o
`--left-right` deu Behind=0 para todas, então o conteúdo está em `main`). Deleção = limpeza de 40
refs local + 40 refs remote, sem perda de conteúdo.

---

## 6. Remoto (`origin` = https://github.com/thebrunm97/manejo-org)

- **51 branches remotas**, todas com par local de mesmo nome (espelho perfeito criado/wconfirmado no
  force-push `--all` do DT-124).
- **Único local ≠ remoto: `fix/bigpickle-bugfix-loop`** (`34f943a` local vs `0349682` remoto — o commit
  de hoje ainda não foi enviado; tudo o mais está em sincronia).
- **Nenhuma `branch.<nome>.remote/.merge` configurada** — tracking inexistente (ver seção 1).
  Recomendação de higiene futura: configurar upstream por branch (ou ao menos para `main` e a de trabalho)
  para recuperar o ahead/behind no `git status`.
- Origem pública (repo aberto); o histórico está 100% limpo de segredos desde o DT-124.

---

## 7. Worktrees e trabalho não commitado

| Worktree | Branch/HEAD | Estado |
|---|---|---|
| raiz (atual) | `fix/bigpickle-bugfix-loop` @ `34f943a` | 47+ arquivos modificados + untracked do WIP (não medidos aqui; estado de trabalho normal da sessão) |
| `.claude/worktrees/magical-shamir-a00988` | detached, `61d049a` | **1 arquivo modificado** |
| `.claude/worktrees/modest-jang-88f9cb` | `claude/modest-jang-88f9cb` @ `79e1cdb` | **1 arquivo modificado** |
| `.claude/worktrees/optimistic-feynman-ce72b2` | `claude/optimistic-feynman-ce72b2` @ `749d0db` | **28 arquivos modificados** — mais sujo de todos |

Atenção: as 3 worktrees do Claude Code continuam apontando para SHAs reescritos pelo DT-124 —
funcionam, mas não têm pares de "estado remoto" distintos do resto.

---

## 8. Riscos e recomendações (sem ação executada)

1. **Deleção segura imediata:** 40 branches MERGEADAS (local + remota) — `git branch -d` +
   `git push origin --delete`. Sem perda de conteúdo.
2. **Família dt-04/dt-37/dt-44:** decidir se o refactor do DT-04 (estreitamento do `llm.LLMProvider`)
   e o `cache_control` do DT-37 e o guardrail PII do DT-44 **já foram absorvidos** no loop BigPickle
   (que partiu do `main` de 08-30, acima do merge-base 87c2e1e). Se sim → descartar; se não → cherry-pick.
   Sugestão: conferir se `internal/state`/`internal/gemini` na branch atual já tem `aiProvider`/
   `cache_control`/dígito verificador de CPF-CNPJ.
3. **fix/rag-*:** verificar se a FK correta (`053bf99`) e o stop de embeddings 3072d (`845a44c`)
   já entraram; ambos parecem superados pelo DT-07.
4. **feature/gee-maplibre-integration (46 commits):** conteúdo híbrido (mapa antigo + docs recentes);
   revisar o que falta dela e comparar com o trabalho de mapa já no `bigpickle`.
5. **`claude/optimistic-feynman-ce72b2`:** worktree com 28 arquivos — **não tocar** sem backing up
   o estado; é onde mora o trabalho não commitado mais volumoso.
6. **Tracking:** configurar upstream das branches vivas para recuperar o sinal ahead/behind do git.

---

## 9. Matriz de absorção (investigação commit-a-commit, 2026-09-06)

Método: `git show <commit> | git patch-id --stable` para cada commit único dos 10 ramos
não-mergeados × patch-id de todos os commits `main..fix/bigpickle-bugfix-loop` (54 no-merges);
onde o patch-id não bateu (re-implementação via outra rota), confirmou-se por inspeção do conteúdo
no tip. Referência: tip `34f943a`, `main = 959603c`.

### 9.1 Tabela de veredito por commit único

| Commit | Ramo | Evidência no tip (`34f943a`) | Veredito |
|---|---|---|---|
| `845a44c` stop 3072d no upload | rag-1024d | `webhook/handler.go:770,808` já usa `GetEmbedding`+`UpsertFarmDocumentChunks`; `cmd/knowledge_loader` **ausente** do `cmd/` | **ABSORVIDO** (via DT-07 `4cdc5c0`) |
| `6abef78` cmd → pacotes | rag-1024d | `cmd/` já contém `check_all_tools/`, `test_gemini_api/`, `test_schema/` | **ABSORVIDO** |
| `b00041e`, `182dca1` (docs) | rag-1024d | docs de estado | descartáveis (docs) |
| `053bf99` FK + onda mudanças | rag-async | `client.go:407` (`idempotency_key`), `:682-693` (`p_payload`), `:406` (`quantidade_assumida`), `:412` (`data_plantio_recomendada`); testes `mutation_drafts_`/`idempotency_real_postgres_test.go` presentes | **ABSORVIDO** (re-commitado na forma adaptada; patch-id não bateu por contexto) |
| `1437b3a` removes type assertions | dt-04 | `specialized_handlers.go:111,166` **ainda** têm `llmClient.(llm.LLMProvider)` | NÃO absorvido — **decidido não fazer** (DT-04 reformulado, debitos:125) |
| `25e81b7` workers narrow | dt-04 | `ai_worker.go`/`media_worker.go` já não referenciam `llm.LLMProvider` | **ABSORVIDO** |
| `bc8186c` webhook narrow | dt-04 | `webhook/handler.go:48` **ainda** `LLMClient llm.LLMProvider` | NÃO absorvido — decisão DT-04 |
| `3ac21ec` composto `aiProvider` | dt-04 | `main.go:164` **ainda** `var llmProvider llm.LLMProvider` | NÃO absorvido — decisão DT-04 |
| `adbe7fe` cache_control OpenRouter | dt-37 | `internal/gemini/client.go` sem `cache_control` | NÃO absorvido — DT-37 consolidado: "sem ação segura até telemetria real" (debitos) |
| `7029433` DV CPF/CNPJ | dt-44 | `filter_pii.go` sem validação de dígito; board **DT-44 em aberto** ("corrigir validando o DV antes de redigir") | **NÃO ABSORVIDO — A APLICAR** [nota: DT-44 foi resolvido ainda em 2026-09-06 via cherry-pick `7029433`→`3b0f5cc`+`e62dd9c`, ver seção 9.4 abaixo e `pmo-bot-go/docs/debitos_tecnicos.md`] |
| `61d049a` seed.sql + testes slug | magical | seed.sql do tip **ainda** `INSERT INTO profiles (id, user_id, full_name, role)` → `supabase db reset` quebrado; testes sem `slug` | **NÃO ABSORVIDO — A APLICAR** |
| `32d7a22` dedupe msg_id | modest | `queue/manager.go` Enqueue **ainda sem** `?on_conflict=msg_id` → dedup nunca dispara (índice `20260901115000`/DT-22 existe) | **NÃO ABSORVIDO — A APLICAR** (1 linha + migração redundante a pular) |
| `79e1cdb` docs DT-67 | modest | board DT-67 do tip não registra achado msg_id | docs — cobrir junto com `32d7a22` |
| `b91e5eb`+`7921918`+`749d0db` gitleaks/LF | optimistic | `.githooks/pre-commit`, `.github/workflows/secret-scan.yml`, `.gitleaks.toml`, `package.json` (`scan:secrets*`) já presentes | **ABSORVIDO** |
| 46 commits | gee-maplibre | todos os 46 já ancestrais da `bigpickle` (folded mapa-março + docs-setembro presentes em `main..bigpickle`) | **ABSORVIDO** |

### 9.2 O que resta de valor real (3 fixes pendentes, todos pequenos e cherry-pickáveis)

1. **`7029433` (dt-44)** — valida dígito verificador de CPF/CNPJ antes de redigir em
   `internal/guardrails/filter_pii.go` (+2 suítes de teste). O DT-44 está **aberto no board** e o bug
   corrompe códigos legítimos de lote/NF. Cherry-pick direto esperado sem conflito (arquivo não mudou
   no tip).
2. **`61d049a` (magical)** — corrige `supabase/seed.sql` (insert em `auth.users` + perfil com
   `nome`/`role`) e adiciona `slug` nos POSTs dos 2 testes real-Postgres. Cherry-pick pode **conflitar**
   nos testes (o tip mudou esses arquivos após a onda de mutações); o `seed.sql` deve aplicar limpo.
3. **`32d7a22` (modest)** — 1 linha em `queue/manager.go` (`?on_conflict=msg_id`). A migração
   `20260901120000...` do commit é redundante (o tip já versiona o índice em `20260901115000`/DT-22) →
   **aplicar só a linha do `manager.go`** e registrar o achado no DT-67.

`adbe7fe` (cache_control) segue **não aplicável hoje**: o board consolidou o DT-37 sem corte seguro e o
commit também reescreve o board antigo (79 linhas de diff em `debitos_tecnicos.md`) → conflita com o
estado atual do documento.

### 9.3 Estado pós-ação sugerido

Se os 3 fixes de 9.2 entrarem no `bigpickle` (na ordem 7029433 → 61d049a → 32d7a22), as 10 branches
não-mergeadas restantes ficam **todas absorvidas de fato** e passam a ser apenas lixo de refs:
`dt-04/finalizacao`, `dt-37/*`, `dt-44/*` (após aplicar), `fix/rag-async-worker-insert`,
`fix/rag-embedding-1024d-backfill`, `claude/optimistic-feynman-ce72b2`, `claude/magical-shamir-a00988`,
`claude/modest-jang-88f9cb` e `feature/gee-maplibre-integration` → deleção local+remota segura.
Ressalvas: checar os 28 arquivos sujos do worktree `optimistic` antes de deletar a ref, e os 1+1
modificados de `magical`/`modest`.

### 9.4 ⚙️ AÇÃO: 3 fixes aplicados na `fix/bigpickle-bugfix-loop` (2026-09-06)

Autorizada pelo usuário ("sim"), aplicados na ordem recomendada. Estado final do top da branch:

| Commit | Fonte | Conteúdo |
|---|---|---|
| `3b0f5cc` | cherry-pick `7029433` (dt-44) | DT-44: validação de dígito verificador CPF/CNPJ em `filter_pii.go` |
| `0420ff0` | cherry-pick `61d049a` (magical) | seed.sql corrigido + `slug` nos POSTs dos 2 testes real-Postgres |
| `e62dd9c` | manual | DT-67 `?on_conflict=msg_id` no `manager.go` + ajuste da regex de telefone (`filter_pii.go`) + `sensitivity_test.go` + Item (5) do DT-67 no board |

Sabores do DT-44 não aplicados (decisão do board, **não cherry-picks**):
- `1437b3a`/`bc8186c`/`3ac21ec` (dt-04): DT-04 reformulado = decidido não fazer.
- `adbe7fe` (dt-37/cache_control): não aplicável hoje.

Ajuste necessário do cherry-pick `7029433` (ver 9.4.1): sem ele a suíte ficaria vermelha. O top da
branch agora está **4 commits à frente do remoto** (`34f943a` → `3b0f5cc` → `0420ff0` → `e62dd9c`),
`main..bigpickle` = 57 commits.

#### 9.4.1 Regressão de teste induzida pelo cherry-pick `7029433` e correção

O commit `7029433` valida o dígito verificador do CPF/CNPJ **antes** de redigir. Isso quebrou 2 testes
do `internal/guardrails` (baseline `34f943a` passava):

1. **`TestPIIScrubber_RedactsPhone`** — o caso `"tel 11999998888"` deixou de gerar violação. Inspeção
   revelou que a **regex de telefone nunca casava o DDD compacto** (`11999998888`): o padrão exigia um
   `\b` entre o DDD opcional e o número. O teste só passava antes porque o **falso-positivo do CPF** (sem
   validação de DV) redigia a sequência de 11 dígitos — exatamente o bug que o DT-44 elimina.
2. **`TestClassifySpeechSensitivity_Motivo`** — `"Meu CPF e 123.456.789-00"` deixou de ser
   `identificador_direto` porque `123.456.789-00` tem DV inválido (não passa em `isValidCPF`).

Correção (parte do `e62dd9c`):
- `filter_pii.go` — regex de telefone ajustada para `(?:\+?55\s?|\b|\()(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b`:
  âncora/`(` antes do DDD opcional (nunca no meio), consumindo o DDD compacto e o `(` do formato
  `(11)`; o final ainda exige limite de palavra, então não re-casa dentro de lotes/CNPJ longos
  (`TestRedactPII`, `TestHasPII`, `TestPIIScrubber_FalsePositives` seguem verdes).
- `sensitivity_test.go` — caso `identificador_direto` trocado por CPF **válido** (`529.982.247-25`);
  adicionado `{"O lote DT391787418354", false, "nao_sensivel"}` refletindo que DV inválido deixa de
  ser considerado PII (semântica do DT-44).

**Verificação final:** `go build`, `go vet` e `go test ./...` (suíte completa, incluindo `tests/` de
~64s) — **tudo verde**.

---

## 10. Dados brutos de referência

- `main` = `959603c1f9a3136d11f0059a011cd177d1f16259`
- Merge-bases confirmados:
  - `dt-04/finalizacao`, `dt-37/*`, `dt-44/*` → `87c2e1ed25e0b11a98c0c1671f7b432185ab603b`
  - `claude/optimistic-feynman-ce72b2` → `1ff9c74f1322e9a8cafbf1b41b2ce3f8ab5c37b0`
  - `fix/rag-async-worker-insert` → `5aae7844e80ea07aaf38df35cbedba86b6304075`
  - `fix/rag-embedding-1024d-backfill` → `1604d80c652526c1edf1249fce52db482fcaceb6`
  - `claude/magical-shamir-a00988`, `claude/modest-jang-88f9cb`,
    `feature/gee-maplibre-integration`, `fix/bigpickle-bugfix-loop` → `959603c…` (= `main` tip)
- Total de commits únicos das 10 não-mergeadas: `1+2+46+54+3+4+5+1+1+4 = 121`.