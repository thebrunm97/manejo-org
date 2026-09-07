# Auditoria de Defesa Profunda — 2026-09-06

- **Data:** 2026-09-06
- **Escopo:** terceira onda de auditoria — (1) Supabase Storage/Realtime/Views e **migrations do harness** (`pmo-bot-go/migrations/`, nunca auditadas), (2) segurança do frontend (`pmo-frontend/`), (3) concorrência/input do backend Go (`pmo-bot-go/internal/`). Complementa `docs/audit-supabase-rls-2026-09-05.md` (RLS das migrations canônicas).
- **Método:** revisão por leitura de código dirigida; cada item confirmado em `arquivo:linha` antes de ser registrado. Nenhum item foi inventado. Achados que dependem do estado ao vivo do banco estão marcados como **⚡ condicional: confirmar ao vivo** (padrão do DT-70/DT-22: policies e dados criados fora de banda já existiram em produção sem nunca passar pelo repo).
- **Resultado:** 1 vulnerabilidade **Crítica** (⚡ condicional), 3 **Altas**, 5 **Médias**, 6 **Baixas** no rastreio do Go (DT-106..DT-118) e 7 itens de frontend (F21..F27 em `TECHNICAL_DEBT.md`).

---

## 1. Resumo executivo

| Severidade | Qtd | Tema dominante |
|------------|-----|----------------|
| 🟢/🔴 Crítica | 1 | Subsistema de memória do usuário (`user_memory_profiles` + `match_user_memory`) sem governança nenhuma — ⚡ depende de estar aplicado ao vivo |
| 🟠 Alta | 3 | Policies `USING (true)` do harness, bucket `avatars` sem dono, `CONECTAR` sem brute-force/expiry |
| 🟡 Média | 5 | Views do harness sem `security_invoker`, bucket `comprovantes` sem governança, zero CSP, rotas `/lab`·`/teste-mapa` públicas, `sessionMu` sem eviction |
| 🟢 Baixa | 6 + 7 | Goroutines fire-and-forget, async compression sem throttle, URLs sem escape, prompt por CWD, dup no plantio, bucket em runtime (Go) · Math.random, mapa arbitrário, URLs previsíveis, key de Maps no bundle, lote Math.random (frontend) |

Padrão que se repete: **`pmo-bot-go/migrations/` definem um schema paralelo do harness com governança frouxa** (RLS ausente ou `USING (true)`, views sem `security_invoker`), desviante do schema canônico de `supabase/migrations/` — a mesma classe de causa-raiz dos DT-22/DT-70. As policies canônicas já são admin-scoped; o risco é a aplicação parcial/dupla dessas migrations reabrir as exposições.

---

## 2. Como ler cada item

```
[Severidade] ID — Título
Evidência   : arquivo:linha
Problema    : o que está errado
Impacto     : o que pode acontecer
Sugestão    : correção sugerida
```

Severidades:

- **Crítica** — explorável ao vivo sem a função pretendida (anon lê/escreve dado de outro tenant).
- **Alta** — ator autenticado acessa dados fora do seu tenant, ou exposição/sequestro determinístico com a aplicação das migrations do harness.
- **Média** — risco latente sob condição (migration não aplicada) ou anti-pattern que permite escalação futura.
- **Baixa** — higiene, robustez, consistência.

---

## 3. Críticas (1) — ⚡ condicional

### C1 **Subsistema de memória do usuário sem governança: `user_memory_profiles` sem RLS + `match_user_memory` com EXECUTE público e `pmo_id` do chamador.**
- **Evidência:** `pmo-bot-go/migrations/008_create_user_memory.sql:5-14` — `CREATE TABLE user_memory_profiles (pmo_id, phone_number, fact, category, embedding)` **sem** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em lugar nenhum do repositório (grep confirmado, inclui `supabase/migrations/`). `pmo-bot-go/migrations/009_match_user_memory_rpc.sql:1-28` — função sem `REVOKE ALL`/`GRANT` (default do Postgres: `EXECUTE TO PUBLIC`, inclui `anon`), sem `auth.uid()` e sem checagem de posse; corpo filtra por `WHERE ump.pmo_id = match_pmo_id` com o UUID fornecido pelo chamador.
- **Impacto:** se a tabela existir no banco, qualquer anônimo lê `fact`/`category` (perfil de memória) de qualquer PMO via REST direto e via `match_user_memory` com um `pmo_id` arbitrário. É a mesma classe do DT-93, mas sem nem `SECURITY DEFINER` para restringir.
- **⚡ Condicional (dupla):** (a) `008` tem `REFERENCES pmo(id)` — tabela `pmo` inexistente em todas as migrations do repo, o que sugere que o subsistema **nunca chegou a ser aplicado** no banco real; (b) a função não é `SECURITY DEFINER`, então a exploração depende do estado de grants da tabela (que, sem RLS, tendem ao padrão Supabase = SELECT para `anon`/`authenticated`). **Confirmar ao vivo** (`pg_tables`/`relrowsecurity`, `has_function_privilege`) antes de corrigir ou de descartar.
- **Sugestão:** se a tabela existir, migration de bootstrap: `ENABLE ROW LEVEL SECURITY` + policy `auth.uid() = pmo.user_id` + `REVOKE ALL ON FUNCTION` + `GRANT EXECUTE TO service_role` (padrão DT-18/DT-93). Se não existir, remover `008`/`009` do repositório para não deixar uma bomba versionada.

---

## 4. Altas (3)

### A1 **Policies `USING (true)` do harness em `guardrail_events` e `hitl_pending` — leitura cross-tenant se aplicadas ao vivo.**
- **Evidência:** `pmo-bot-go/migrations/005_guardrail_events.sql:163-167` — `CREATE POLICY "admin_read_guardrail_events" ... TO authenticated USING (true)`; `pmo-bot-go/migrations/006_hitl_pending.sql:145-149` — idem `"admin_read_hitl"`. O nome diz "admin", o corpo libera para **qualquer autenticado**.
- **Impacto:** se essas migrations rodaram no banco (precedente real DT-70: policies permissivas existiam em produção sem migration correspondente), qualquer usuário logado lê eventos de guardrail (telefones + `violations` com texto truncado de PII) e `hitl_pending.tool_args` — o **payload completo para reexecutar mutações** (compra de insumo, operação de campo, financeiro) de todos os PMOs.
- **Contexto que mitiga no repo:** o schema canônico (`supabase/migrations/20260402120000_create_operational_tables.sql:309-311,331-333`) já define policies admin-scoped (`profiles.role = 'admin'`) para as mesmas tabelas. O risco é a **aplicação parcial do kernel** reabrir a exposição — mesma root cause de DT-22/DT-70.
- **Sugestão:** conferir ao vivo `pg_policies` dessas duas tabelas e remover qualquer policy permissiva; padronizar o kernel com a policy canônica (`EXISTS (profiles.role='admin')`) para o caso de ser reaplicado.

### A2 **Bucket `avatars`: público + upload/update/delete sem checagem de dono.**
- **Evidência:** `pmo-frontend/supabase/migrations/20260328_add_avatar_to_profiles.sql:5-7` (bucket `public = true`), `:20-25` (INSERT valida só `bucket_id` + `auth.role()='authenticated'`), `:28-33` e `:36-41` (UPDATE/DELETE idem — nada de `owner = auth.uid()`).
- **Impacto:** qualquer usuário autenticado pode **sobrescrever ou apagar o avatar de qualquer produtor** (identidade falsificada na plataforma) e, por ser bucket público, enumerar URLs. Não há limite de MIME/tamanho além do default do Supabase.
- **Sugestão:** `storage.objects` polices escopadas por `owner = auth.uid()` (incluindo `WITH CHECK` no INSERT com `auth.uid() = (SELECT owner ...)`), bucket privado com signed URLs só para leitura do dono, e limite de size/MIME.

### A3 **Fluxo `CONECTAR <código>`: força bruta sem limite, sem expiração, lookup não-atômico.**
- **Evidência:** `pmo-bot-go/internal/supabase/quota.go:172-218` (`LinkDeviceToWeb`) — busca `profiles?codigo_vinculo=eq.<code>` sem throttle nem contagem de tentativas, sem validação de expiração, PATCH read-modify-write não-atômico (`:194-204`). Origem do código: `pmo-frontend/src/services/whatsappService.ts:12-19` — `Math.random()` (36⁶ ≈ 2,2 mil combinações), não-criptográfico.
- **Impacto:** atacante com o número do produtor pode **sequestrar o vínculo WhatsApp→conta** (revinculando o telefone dele à conta da vítima) por tentativa-exaustão; o próprio `whatsappService` confirma a fraqueza do espaço de chaves.
- **Sugestão:** código criptográfico (6 bytes aleatórios via `crypto.randomBytes`) com TTL explícito; rate-limit por telefone/IP por tentativa (backoff); validação de formato antes do lookup; atualização como transação com `WHERE codigo_vinculo = $1` para eliminar a janela read-modify-write. **1 item só** — a parte frontend é registrada como F21 para rastreio no `TECHNICAL_DEBT.md`.

---

## 5. Médias (5)

### M1 **6 views operacionais do harness sem `security_invoker` — padrão DT-62.**
- **Evidência:** `pmo-bot-go/migrations/004_message_queue.sql:62-79,88-98` (`message_queue_dead_letter`, `message_queue_monitor`), `005_guardrail_events.sql:85-101,110-124` (`guardrail_kpi_hourly`, `guardrail_recent_blocks`), `006_hitl_pending.sql:72-85,94-104` (`hitl_pending_view`, `hitl_audit_summary`). Nenhuma migration canônica referencia essas views nem seta `security_invoker` (grep confirmado).
- **Impacto:** se aplicadas, as views rodam com as permissões do criador e **bypassam RLS** das tabelas de origem — exatamente o defeito que expôs telefones/mensagens de todos os produtores a `anon` na `view_conversas_recentes` (DT-62).
- **Sugestão:** `ALTER VIEW ... SET (security_invoker = true)` + `REVOKE ALL ... FROM anon`; ou mover as views para o schema canônico já com a opção.

### M2 **Bucket `comprovantes` sem governança SQL algum.**
- **Evidência:** `pmo-frontend/src/services/dashboardService.ts:224,231` — upload e `getPublicUrl` direto no bucket `comprovantes` via client; nenhuma migration (nem `pmo-frontend/supabase/migrations/`, nem o kernel) cria o bucket ou define policies. Bucket público por default → nota de compra/comprovante acessível sem assinatura se a URL for conhecida.
- **Sugestão:** migration criando `comprovantes` como privado + signed URLs on-demand (padrão de `audioSigningService.ts`), owner-check nas policies.

### M3 **Zero CSP/security headers no Vercel; token em localStorage.**
- **Evidência:** `pmo-frontend/vercel.json:8-27` — só `Cache-Control` para sw/manifest; sem `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Impacto:** sem defesa em profundidade para o token em `localStorage` (F1/F17 já detalham os vetores); qualquer XSS futuro é trivial de explorar.
- **Sugestão:** headers globais no `vercel.json` (plano do projeto, `_headers` ou Vercel Firewall), CSP mínimo com `default-src 'self'` + origem do Supabase + API Go.

### M4 **Rotas `/lab` e `/teste-mapa` públicas sem guard.**
- **Evidência:** `pmo-frontend/src/App.tsx:74,76` — `<Route path="/lab" element={<DesignLab />} />` e `<Route path="/teste-mapa" .../>`. `DesignLab.tsx:77-83` dispara chamadas no primeiro uso.
- **Impacto:** telas de laboratório/mapa acessíveis a qualquer visitante sem troca de sessão; gasto de cota de IA por chamadas direcionadas (depende do que o `/lab` invoca).
- **Sugestão:** remover rotas em produção (dev-only) ou envolvê-las em guard de admin (mesmo padrão de `/admin`).

### M5 **`sessionMu sync.Map` sem eviction — vazamento de memória.**
- **Evidência:** `pmo-bot-go/internal/state/fsm.go:50-56` — `map[phone]*sync.Mutex` criado via `LoadOrStore` e **nunca removido**.
- **Impacto:** em produção com milhares de números distintos ao longo do tempo, o mapa cresce sem limite e retém mutex implícitos — push de memória pequeno por sessão, mas indefinido.
- **Sugestão:** eviction periódico (ticker varrendo chaves inativas) ou lock-striping fixo (array de N=`sync.Mutex`), que elimina o vazamento por construção.

---

## 6. Baixas (6) — rastreio DT-113..DT-118

### B1 **Goroutines fire-and-forget engolindo erros.**
- **Evidência:** `pmo-bot-go/internal/state/utils.go:90,148` e `pmo-bot-go/internal/webhook/handler.go:670,736` — `go func(){}` sem `recover`, sem espera por `sync.WaitGroup`/`errgroup`, sem logging estruturado do erro.
- **Sugestão:** `recover()` + `slog` do erro; onde o resultado importa, usar `errgroup` / `WaitGroup` com controle de shutdown.

### B2 **`TriggerAsyncCompression` não-rastreada e sem teto de concorrência.**
- **Evidência:** `pmo-bot-go/internal/history/manager.go:256-360` — goroutine por telefone acima do threshold, sem limite de quantas compressões rodam simultaneamente (LLM de sumarização pode estourar fila/CPU sob rajada de sessões longas).
- **Sugestão:** semáforo (capacidade 1-2) ou chave por telefone em preparação; `recover` obrigatório na goroutine.

### B3 **URLs interpoladas sem escape e `http://` cru (classe DT-89 em novos call sites).**
- **Evidência:** `pmo-bot-go/internal/supabase/quota.go:174,192` — `...codigo_vinculo=eq.%s` e `...id=eq.%s` sem `url.QueryEscape`; `pmo-bot-go/internal/weather/client.go:255` — `fmt.Sprintf("http://api.weatherapi.com/...&q=%s", location)` sem escape e em **HTTP puro**.
- **Sugestão:** `url.QueryEscape` ou `net/url.Values`; subir o legacy weather para HTTPS e validar entrada.

### B4 **Prompt do judge lido por caminho relativo ao CWD.**
- **Evidência:** `pmo-bot-go/internal/knowledge/evaluator.go:181` — `os.ReadFile("internal/knowledge/prompts/" + e.promptVersion + ".txt")`; quebra se o CWD do processo não for a raiz do módulo e torna o conteúdo do prompt dependente do ambiente.
- **Sugestão:** embutir via `go:embed` (padrão já usado em `internal/pricing`) com allowlist de versões.

### B5 **Janela de duplicação no reminder de plantio.**
- **Evidência:** `pmo-bot-go/internal/jobs/plantio.go:65-76` — envia a mensagem **antes** de `MarcarAlertaComoEnviado`; se a marcação falhar, a próxima janela (ticker 12h, `:18`) reenvia o mesmo alerta.
- **Sugestão:** marcar como "sending" antes do envio e confirmar pós-envio (compensação em falha), ou envio idempotente com chave do alerta.

### B6 **Bucket `audit-vault` sem garantia em migration — criado em runtime.**
- **Evidência:** `pmo-bot-go/internal/adapter/auditvault/adapter.go:70-76,100` — o contrato exige bucket privado, mas a criação depende de código/rotina runtime (relacionado à DT-105, que já aponta o bucket sem criação SQL).
- **Sugestão:** migration criando o bucket privado com policies de service-role; falha explícita no boot se ausente.

---

## 7. Itens de frontend — F21..F27 (ver `TECHNICAL_DEBT.md`)

- **F21** — código de vínculo WhatsApp com `Math.random()` (`whatsappService.ts:12-19`) → cross-ref **DT-109** (A3).
- **F22** — zero CSP/security headers no `vercel.json:8-27` → mesmo item M3.
- **F23** — rotas `/lab`·`/teste-mapa` públicas (`App.tsx:74,76`) → mesmo item M4.
- **F24** — `update_profile` com mapa arbitrário de colunas (`profileService.ts:94-95`, `propriedadeService.ts:63-64`) — confirmar allowlist server-side; reforça o DT-97.
- **F25** — `getPublicUrl` de buckets públicos com URL estável/previsível (`comprovantes`: `dashboardService.ts:231`; `avatars`: `profileService.ts:129`; `anexos-pmos`: `storageBucketService.ts:49`).
- **F26** — Google Maps tiles API key exposta no bundle (`googleTilesSession.ts:81-82`, `useSatelliteMapStyle.ts:44`).
- **F27** — código de lote de rastreabilidade com `Math.random()` curto (`traceabilityService.ts:20-21`) — colisões corrompem o QR rastreável.

---

## 8. Já cobertos em outros rastreios (não duplicar)

- **DT-105** — bucket `audios_audit` público (relação com B6).
- **DT-72** — `RerankDocuments` sem timeout/retry.
- **DT-89** — interpolação sem `QueryEscape` em `internal/supabase/client.go` (B3 são novos call sites).
- **F15** — token Mapbox fake hardcoded (`PropertyProfilePage.tsx:610`) — já registrado.
- **DT-62** — `view_conversas_recentes` (M1 é a mesma classe, outras views).

---

## 9. Ordem de ataque

1. **Confirmação ao vivo** (read-only) das condições ⚡: `pg_tables.relrowsecurity` e `pg_policies` de `user_memory_profiles`/`guardrail_events`/`hitl_pending`; `has_function_privilege('anon', 'match_user_memory')`; existência das views do harness.
2. **C1** — bootstrap de RLS + `REVOKE`/`GRANT` da `match_user_memory` (padrão DT-93/DT-65) — ou remoção das migrations órfãs `008`/`009`.
3. **A1** — garantir que as policies canônicas admin-scoped sejam as únicas ao vivo (remover quaisquer `USING (true)` do kernel).
4. **A2 + F25/F26** — bucket `avatars` privado com owner-check; `comprovantes`/`anexos-pmos` idem (M2/F25).
5. **A3/F21 + B3** — hardening do fluxo CONECTAR (código criptográfico, TTL, throttle, transação) + escapes de URL.
6. **M3/F22** — headers de segurança no Vercel.
7. **M5/B1/B2** — eviction do `sessionMu` + goroutines com `recover`.
8. **CI com `supabase test db` (DT-91)** para travar regressões de RLS/views.

---

## 10. Rastreio

- **DT-106..DT-118** registrados em `pmo-bot-go/docs/debitos_tecnicos.md` (C1→DT-106, A1→DT-107, A2→DT-108, A3→DT-109, M1→DT-110, M2→DT-111, M5→DT-112, B1→DT-113, B2→DT-114, B3→DT-115, B4→DT-116, B5→DT-117, B6→DT-118).
- **F21..F27** registrados em `TECHNICAL_DEBT.md` (seção 7).