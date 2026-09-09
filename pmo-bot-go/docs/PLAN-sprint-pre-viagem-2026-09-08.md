# Plano de Sprint Pré-Viagem — 2 dias (escrito em 2026-09-08)

> Documento de continuidade entre sessões. Lê-se em 5 minutos, evita
> refazer triagem já feita. Fonte de verdade de cada item continua sendo
> [`debitos_tecnicos.md`](debitos_tecnicos.md) — este plano só sequencia e
> prioriza o que já está lá. Ao fechar um item, **atualize o
> `debitos_tecnicos.md` também** (mover para Concluído com data e
> observação), não só marque o checkbox aqui.

**Prazo:** ~2 dias até o responsável ficar inacessível (viagem).
**Objetivo:** eliminar os riscos de segurança **exploráveis agora, em
produção real, por qualquer usuário anônimo/autenticado** — não é
possível nem é a meta fechar os 65 itens abertos em "A Fazer".

---

## Estado no momento em que este plano foi escrito

- `main` com o pipeline de `Deploy to Production` **verde ponta a ponta**
  pela primeira vez (DT-30 fechado hoje) — `Verify Schema Parity` e
  `Deploy Migrations to Production` passando, sem `--include-all`.
- Merge de `feature-multicanal` (62 commits) concluído e no `main` —
  trouxe a auditoria de RLS/RPC inteira (DT-93 a DT-127) que só existia
  naquela branch e nunca tinha sido triada contra o `main`.
- Secrets de CI configurados: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.
- `conversations`/`channel_links` (base do multicanal) existem em
  produção de verdade agora (não existiam até hoje, apesar do histórico
  de migrations dizer o contrário — ver DT-30 em Concluído para a causa).

**Antes de continuar, confira que isso ainda é verdade** (branches divergem rápido neste projeto — já causou retrabalho duplicado hoje, ver Armadilhas abaixo):

```bash
git log --oneline -1 main
gh run list --limit 3 --workflow="Deploy to Production"
git branch --all --contains main  # confirma se surgiu alguma branch nova não mergeada
```

---

## Critério de corte — o que ENTRA neste sprint

**Entra:** RPCs `SECURITY DEFINER`/RLS realmente chamáveis por `anon` ou
qualquer `authenticated` sem checagem de dono hoje; bugs de dados que
corrompem cadastro/rastreabilidade; auth sem rate-limit/expiração;
infra com credencial exposta.

**NÃO entra (fica documentado, mas represado até depois da viagem):**
performance/custo (DT-34, DT-86, DT-87), código legado (DT-13, DT-40,
DT-90), decisão de produto pendente (DT-08), LGPD completo (DT-42 —
diretrizes já existem em `LGPD_GUIDELINES.md`, mas fechar de vez é
trabalho de dias, não de horas; ver escopo mínimo no Dia 2), e todo o
lote 🟡Média/🔵Baixa (43 itens) — a menos que sobre tempo no Dia 2.

---

## Dia 1 — Blindagem de RPCs e RLS (o bloco mais perigoso)

### Lote A — RPCs `SECURITY DEFINER` abertas a `PUBLIC`/`anon` (~2-3h)

Mesmo padrão de correção nos quatro: `REVOKE EXECUTE ... FROM PUBLIC, anon`
+ `GRANT EXECUTE ... TO authenticated` (ou `service_role`, se só o bot
deve chamar) + adicionar `auth.uid()`/checagem de posse dentro do corpo
onde ainda não existe. Fazer numa **única migration nova**
(`supabase/migrations/<timestamp>_fix_dt93_96_open_rpcs.sql`), testar
localmente antes de tocar produção.

| ID | O quê | Arquivo(s) |
|---|---|---|
| DT-93 | `save_pmo_memory_cache`/`match_pmo_memory_cache` sem `auth.uid()`, `EXECUTE` a `PUBLIC` | `supabase/migrations/20260905153000_b_create_pmo_memory_cache_rpc.sql` |
| DT-94 | `create_or_supersede_mutation_draft`/`commit_mutation_draft` sem checagem de dono | ver `mutation_drafts`, migrations de idempotência (DT-09/16) |
| DT-95 | RPCs de Knowledge Ops + `upsert_arena_models` abertas | `supabase/migrations/20260721180000_knowledge_ops_panel.sql`, `20260723120000_update_rag_arena_models_sync.sql:14` |
| DT-96 | `get_knowledge_role()` cai pro `user_metadata` (editável pelo próprio usuário) → escalada de privilégio | `supabase/migrations/20260721180000_knowledge_ops_panel.sql:14-21` |

**Verificação obrigatória antes de aplicar em produção** (mesma lição do
DT-70 desta sessão — bug em migration só aparece testando de verdade):
```sql
-- Ligado como anon, todas devem retornar "permission denied"
SET ROLE anon;
SELECT public.save_pmo_memory_cache(...);
SELECT public.commit_mutation_draft(...);
RESET ROLE;
```
Depois de aplicar: rodar `supabase db diff --linked` local antes do push
(evita repetir o ciclo de 6 rounds de CI que essa sessão levou pra fechar
o DT-30 — teste local primeiro, sempre).

### Lote B — RLS/storage sem dono (~1-2h)

| ID | O quê | Arquivo(s) | Cuidado |
|---|---|---|---|
| DT-106 | `user_memory_profiles` sem RLS + `match_user_memory` `EXECUTE` público | `pmo-bot-go/migrations/008_create_user_memory.sql`, `009_match_user_memory_rpc.sql` | ⚡ **Confirmar antes se essas migrations do harness (`pmo-bot-go/migrations/`, não `supabase/migrations/`) estão realmente aplicadas em produção** — mesmo padrão de aplicação parcial já visto no DT-22/DT-70. Rodar a query de introspecção (`information_schema.columns`/`pg_policies`) contra produção via MCP do Supabase antes de escrever a correção, não assumir pelo arquivo. |
| DT-107 | Policies `USING (true)` do harness (`guardrail_events`, `hitl_pending`) — mesma ressalva ⚡ acima | `pmo-bot-go/migrations/005_guardrail_events.sql:163-167`, `006_hitl_pending.sql:145-149` |
| DT-108 | Bucket `avatars` sem policy de dono | `pmo-frontend/supabase/migrations/20260328_add...` |
| DT-111 | Bucket `comprovantes` mesmo padrão | `pmo-frontend/src/services/storageBucketService.ts:49` |

### Lote C — Auth/abuso (~2h)

| ID | O quê | Arquivo(s) |
|---|---|---|
| DT-109 | `CONECTAR <código>` sem brute-force/dedupe/expiração | `internal/supabase/quota.go:172-218`, `fsm.go:235` |
| DT-126 | Bug de loop no vínculo via OTP — **já investigado e escopado**, ver [`dt126-otp-loop.md`](../../dt126-otp-loop.md) na raiz do repo (não versionado ainda — mover pra dentro de `docs/` e commitar junto da correção). Tasks prontas: criar `UpdateProfilePhone` em `internal/supabase/client.go`, chamar logo após `LinkPhoneToUser` em `internal/state/onboarding.go`. |

---

## Dia 2 — Hardening de app + integridade de dados + infra

### Lote D — Go app resiliency (~1h, baixo risco, mudança pequena)

| ID | O quê | Arquivo(s) |
|---|---|---|
| DT-79 | Rate limiting fail-**open** sem `REDIS_URL` — trocar para fail-**closed** ou abortar boot em produção | `cmd/server/main.go:565-569`, exigir `REDIS_URL` no `docker-compose.prod.yml` |
| DT-80 | `http.Server` sem `ReadHeaderTimeout`/`ReadTimeout`/`WriteTimeout`/`IdleTimeout` | `cmd/server/main.go:759-762` |

### Lote E — Integridade de dados no onboarding/RPCs (~2-3h)

| ID | O quê | Arquivo(s) |
|---|---|---|
| DT-74 | `complete_onboarding` sem idempotência — duplica propriedade/talhão em retry | `supabase/migrations/20260830_create_complete_onboarding_rpc.sql:44-46` |
| DT-75 | Modalidade desconhecida vira `CONVENCIONAL` silenciosamente | mesmo arquivo, `:32-33` |
| DT-77 | `update_log_treinamento` aceita `modelo_ia`/`validado`/`json_corrigido` do caller sem validação server-side | `supabase/migrations/20260903110000_create_dt18_remaining_mutation_rpcs.sql` |
| DT-88 | Fallback de lookup por telefone via `ilike` últimos 8 dígitos pode entregar dado ao produtor errado | `internal/supabase/client.go:613-620` |

### Lote F — Infra (fazer por último — precisa da VPS ao vivo, maior risco operacional)

| ID | O quê | Cuidado |
|---|---|---|
| DT-122 | RabbitMQ com credenciais hardcoded (`admin/admin_password`) + portas `5672`/`15672` publicadas em `0.0.0.0` no `docker-compose.prod.yml` | Rotacionar credencial **e** trocar `ports:` para bind `127.0.0.1` (ou remover, rede interna já resolve) exige SSH na VPS + restart dos containers com a stack real do produtor rodando — fazer com o responsável por perto, não de madrugada sozinho. Senha nova via variável de ambiente segura, nunca colada em terminal (lição do DT-01). |

### Escopo mínimo de LGPD (DT-42), se sobrar tempo

Não dá para fechar de vez em 2 dias. Se sobrar tempo do Dia 2, priorizar
só o item que bloqueia dado sensível saindo pro LLM: finalizar a
pseudonimização em `internal/guardrails/filter_pii.go` antes da injeção
no prompt (item 3 do "Próximos Passos (Código)" já escrito no
`debitos_tecnicos.md`). TTLs e `certification_records`/
`plot_geometry_versions` ficam para depois — não bloqueiam segurança
imediata, são conformidade de retenção.

---

## Explicitamente fora deste sprint (retomar depois da viagem)

- Todo o lote 🟡Média/🔵Baixa restante (DT-71/72/73, DT-78, DT-81, DT-83
  a DT-87, DT-89 a DT-92, DT-97 a DT-105, DT-110, DT-112 a DT-125, DT-127,
  DT-128, DT-129).
- DT-08 (decisão de produto — não é bug).
- DT-58/DT-37/DT-64 (Em Andamento — continuam no ritmo que estavam).

---

## Armadilhas encontradas na sessão de 2026-09-08 (não repetir)

1. **Branches divergem em silêncio e ninguém percebe.** `main` e
   `feature-multicanal` passaram 9 dias sem merge, cada uma fechando
   débitos que a outra não tinha — inclusive **o mesmo bug do gitlink
   `mcp/` foi corrigido duas vezes, de forma independente**, porque a
   correção de uma branch nunca chegou na outra. **Antes de investigar
   qualquer débito "aberto", confira se ele já não foi fechado numa
   branch não mergeada** (`git log --all --oneline --grep="DT-XX"`).
2. **O histórico de migrations pode mentir.** `supabase migration list`/
   `list_migrations` dizem que uma versão foi aplicada, mas isso não
   garante que o DDL realmente rodou — confirme sempre contra o schema
   real (`information_schema.columns`/`tables`, `pg_policies`) via SQL
   direto, não só pela listagem de versões. Foi assim que se achou a
   migration fantasma do DT-30.
3. **Teste `db diff --linked` localmente antes de cada push que toca
   `supabase/migrations/`.** Um replay do zero pega bugs (policy
   duplicada, tipo de coluna errado, coluna referenciada mas nunca
   criada) que só aparecem quando a migration roda numa ordem/estado
   diferente do que existe hoje em produção — e cada rodada de CI leva
   ~2-5 min só pra reportar o próximo erro.
4. **`git add` todo arquivo editado antes de comitar — sempre rodar
   `git status`/`git diff --cached --stat` logo antes do commit.** Uma
   correção ficou esquecida no working tree nesta sessão porque só um
   dos dois arquivos editados foi staged, e o push seguinte repetiu o
   mesmo erro de CI que já tinha sido "corrigido" localmente.
5. **CI da Supabase precisa de DOIS secrets, não um.**
   `SUPABASE_ACCESS_TOKEN` (autentica a CLI) **e**
   `SUPABASE_DB_PASSWORD` (autentica a conexão Postgres) — não existe
   como fugir da senha do banco usando só o token.
6. **`--include-all` no `db push` é só para destravar um catch-up
   pontual.** Remover na sequência (commit separado), senão a CLI para
   de recusar migrations fora de ordem no futuro — perdendo justamente a
   trava de segurança que pegou o bug do DT-30.

---

## Checklist de progresso

Marcar aqui **e** mover a entrada correspondente para 🟢 Concluído em
`debitos_tecnicos.md` com data + observação, no mesmo padrão dos itens
já fechados.

**Dia 1**
- [x] DT-93 — RPC `save_pmo_memory_cache`/`match_pmo_memory_cache` (2026-09-09, mergeado em `main`, reverificado contra Postgres local)
- [x] DT-94 — RPC `create_or_supersede_mutation_draft`/`commit_mutation_draft` (2026-09-09, idem)
- [x] DT-95 — RPCs Knowledge Ops / `upsert_arena_models` (2026-09-09, idem)
- [x] DT-96 — `get_knowledge_role()` privilege escalation (2026-09-09, idem)
- [x] DT-106 — confirmado: tabela/RPC nunca existiram; reescopado para "ferramenta LLM registrada que sempre falha" + recall morto removido (2026-09-09, decisão de produto pendente sobre reconstruir vs. aposentar a ferramenta, ver DT-106 em A Fazer)
- [x] DT-107 — confirmado ao vivo em produção (não era mais condicional) e fechado (2026-09-09, mergeado em `main`)
- [x] DT-108 — bucket `avatars` sem dono (2026-09-09, mergeado em `main`; branch também corrigida no GitHub via `push --force-with-lease` — ver DT-108 em Concluído)
- [x] DT-111 — bucket `comprovantes` sem dono (2026-09-09, mergeado em `main`; fechou junto o `anexos-pmos`)
- [x] DT-109 — `CONECTAR` sem brute-force/expiração (2026-09-09, mergeado em `main`; achado colateral: o pareamento estava funcionalmente quebrado, ver DT-109 em Concluído)
- [x] DT-126 — loop no vínculo via OTP (fechado em 2026-09-08, commit `2fa2398`)

**Dia 2**
- [x] DT-79 — rate limiting fail-open sem `REDIS_URL` (2026-09-09, mergeado em `main`)
- [x] DT-80 — `http.Server` sem timeouts (2026-09-09, mesma branch do DT-79)
- [x] DT-74 — `complete_onboarding` sem idempotência (2026-09-09, mergeado em `main`)
- [x] DT-75 — modalidade desconhecida vira `CONVENCIONAL` (2026-09-09, mesma migration do DT-74)
- [x] DT-77 — `update_log_treinamento` sem validação server-side (2026-09-09, mergeado em `main`)
- [x] DT-88 — fallback de telefone por `ilike` últimos 8 dígitos (2026-09-09, mergeado em `main`)
- [ ] DT-122 — RabbitMQ credenciais + portas públicas (fazer com o responsável por perto)
- [ ] LGPD (DT-42) — escopo mínimo, se sobrar tempo
