# Checkpoint de Sessão — 2026-09-06

- **Objetivo da sessão:** continuar a auditoria de segurança/higiene, investigar quais branches divergentes ainda têm trabalho não absorvido, e aplicar os fixes necessários — tudo como preparação para a **migração para VPS** (substituindo Azure).
- **Branch ativa:** `fix/bigpickle-bugfix-loop`
- **Commits adicionados nesta sessão:** `3b0f5cc` (DT-44), `0420ff0` (seed fix)
- **Top atual:** `0420ff0` (2 commits à frente do remoto `0349682`)

---

## 1. O que foi feito nesta sessão

### 1.1 Investigação de absorção de branches divergentes

Cruzamento commit-a-commit dos 10 ramos não-mergeados (6 divergentes + 4 frente) contra
o tip `fix/bigpickle-bugfix-loop` (`34f943a`), via `git show <c> | git patch-id --stable` +
inspeção de conteúdo (`git grep`/`git show`).

**Resultado:** relatório completo em `docs/branch-inventory-2026-09-06.md` (seção 9 — matriz
de absorção). Três commits precisavam ser aplicados; os demais já estavam no tip.

### 1.2 Fixes aplicados

| Commit original | Ramo | Fix | Status |
|---|---|---|---|
| `7029433` | `dt-44/pii-cpf-cnpj-validation` | Validação de dígito verificador antes de redigir CPF/CNPJ | **Commitado** como `3b0f5cc` |
| `61d049a` | `claude/magical-shamir-a00988` | seed.sql corrigido + slug nos testes real-Postgres | **Commitado** como `0420ff0` |
| `32d7a22` | `claude/modest-jang-88f9cb` | 1 linha: `?on_conflict=msg_id` em `manager.go` | **Uncommitted** no working tree |

### 1.3 Correções extras feitas durante aplicação

O cherry-pick do DT-44 (`7029433`) quebrou 2 testes que antes passavam por motivos
errados (o falso-positivo de CPF mascarava a falha de detecção de telefone). Correções
aplicadas para alinhar ao comportamento correto do DT-44:

| Arquivo | O que mudou |
|---|---|
| `filter_pii.go` | Regex de telefone reescrita: antiga não casava DDD compacto (`11999998888`);
nova inclui `(?:\+?55\s?\|\b\|\()` como prefixo, sem casar dentro de lotes/CNPJ |
| `sensitivity_test.go` | Espera atualizada: sequência inválida (`DT391787418354`) agora `nao_sensivel`,
CPF válido (`529.982.247-25`) mantém `identificador_direto` |
| `debitos_tecnicos.md` | Achado do msg_id registrado no DT-67 (Item 5) |

### 1.4 Verificação

- `go build ./...` — verde
- `go vet ./...` — verde
- `go test ./...` — suíte completa verde (incluindo `tests/` com 64s de integração)

### 1.5 Limpeza

- Worktree temporário (`baseline-wt`) removido
- Scripts de sondagem (`probe-absorbed.ps1`, `probe2.ps1`) removidos

---

## 2. Estado do working tree (uncommitted)

```
 M pmo-bot-go/docs/debitos_tecnicos.md          — registro DT-67 + (pré-WIP)
 M pmo-bot-go/internal/guardrails/filter_pii.go  — regex de telefone (fix DT-44)
 M pmo-bot-go/internal/guardrails/sensitivity_test.go — expectativa atualizada
 M pmo-bot-go/internal/queue/manager.go          — ?on_conflict=msg_id (DT-67)
```

Mais o WIP pré-existente (~45+ arquivos modificados da sessão anterior,
incluindo o loop BigPickle).

---

## 3. Commits recentes na branch

```
0420ff0 fix: corrige seed.sql quebrado e testes real-Postgres apos NOT NULL em organizacoes.slug
3b0f5cc fix(guardrails): valida digito verificador antes de redigir CPF/CNPJ (DT-44)
34f943a chore(infra): remove artefatos Azure (azure-infra) e registra DT-124/DT-125 no board
0349682 chore(git): remove binário seu-bot do versionamento e ignora executáveis sem extensão
5c13fe2 fix(security): corrige IDOR de RLS permissiva (DT-70) e reavalia escopo do DT-18
```

- **Local:** `0420ff0`
- **Remoto:** `0349682` (2 commits atrás)
- **Nenhuma `branch.<nome>.remote/.merge` configurada** (tracking inexistente)

---

## 4. Branches (resumo do inventário completo)

- **51 locais = 51 remotas** (espelho 1:1)
- **40 mergeadas** — candidatas a deleção segura
- **6 divergentes** — todas investigadas e vereditadas:
  - `dt-04`, `dt-37`, `rag-*`, `optimistic`, `gee` → **absorvidas** (cherry-picks aplicados
    ou trabalho contido no bigpickle). **Candidatas a deleção.**
- **4 frente** — `fix/bigpickle` (branch ativa), `gee` (absorvida), `magical` (aplicado),
  `modest` (aplicado). As 3 últimas **candidatas a deleção.**

---

## 5. Decision log

| Decisão | Status |
|---|---|
| Abandonar Azure | **Executado** — `azure-infra/` removido (commit `34f943a`), decision registada no Histórico |
| DT-04 (estreitar LLMProvider) | **Fechado no board** — decisão "não fazer" por custo; commits da branch `dt-04/finalizacao` são obsoletos |
| DT-37 (cache_control OpenRouter) | **Consolidado no board** — "sem ação segura até telemetria real"; `adbe7fe` não aplicável hoje |
| DT-44 (DV CPF/CNPJ) | **Aplicado** — `3b0f5cc`, regex + testes ajustados |
| Seed fix (`61d049a`) | **Aplicado** — `0420ff0` |
| DT-67 dedupe msg_id | **Aplicado** no working tree (1 linha em `manager.go`) |

---

## 6. Caminho para a migração VPS

Objetivo declarado: migrar deploy do Azure para VPS. Itens relevantes:

- **Infraestrutura existente:** `deploy/`, `docker-compose.prod.yml`, `.github/workflows/deploy_production.yml`
- **Dependências externas:** Supabase (Auth + DB + Edge Functions), Evolution API (WhatsApp),
  RabbitMQ (mensageria), Groq (STT/LLM barato), OpenRouter/Gemini (LLM principal),
  Flagsmith (feature flags), Google Earth Engine (NDVI/mapas)
- **O que foi removido:** `azure-infra/` (Bicep + compose Azure + parâmetros + README)
- **O que permanece:** Docker Compose prod configurado para `0.0.0.0` (RabbitMQ 5672/15672),
  Evolution Go escutando `:8080`+`:8082` (DT-125 registrado — expõe sem necessidade funcional)

### 6.1 Próximos passos (sugeridos)

1. Decidir sobre push dos 2 commits (`3b0f5cc`, `0420ff0`) + uncommitted changes
2. Deletar branches absorvidas/obsoletas (40 mergeadas + 6 divergentes verificadas)
3. Auditar `docker-compose.prod.yml` para VPS:
   - Quais serviços precisam ficar públicos (8080 Evolution? RabbitMQ 5672?)
   - Variáveis de ambiente necessárias por serviço
   - Persistência de dados (evolution-go WhatsApp sessions, RabbitMQ)
   - TLS/reverse proxy (nginx/caddy?)
4. Adaptar CI/CD (atualmente Azure DevOps) para push direto ao VPS via SSH/FTP
5. Validar em staging VPS antes de apontar domínio

---

## 7. Arquivos de referência

| Arquivo | Conteúdo |
|---|---|
| `docs/branch-inventory-2026-09-06.md` | Inventário profundo de branches + matriz de absorção (seção 9) |
| `pmo-bot-go/docs/debitos_tecnicos.md` | Board de DTs — DT-44 aplicado, DT-67 atualizado, DT-124/125 registrados |
| `docker-compose.prod.yml` | Compose de produção (a ser auditado para VPS) |
| `deploy/` | Scripts/pipelines de deploy atuais |
| `TECHNICAL_DEBT.md` | Lista de F-XX (front de auditoria anterior ao loop BigPickle) |
| Backup do histórico: `C:\Users\T-GAMER\AppData\Local\Temp\opencode\manejo-org-backup-20260906.git` (366 MB) |
| Snapshot WIP: `C:\Users\T-GAMER\AppData\Local\Temp\opencode\manejo-org-wip-20260906` |
