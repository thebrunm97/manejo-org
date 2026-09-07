# Technical Debt & Backlog

> Os débitos do backend Go vivem em `pmo-bot-go/docs/debitos_tecnicos.md` (IDs `DT-XX`), que
> se declara fonte única de verdade para aquele serviço — itens novos do bot entram lá, não aqui.
> Este arquivo guarda pendências de frontend e itens globais ainda não absorvidos por aquele registro.
>
> **Auditoria BigPickle (2026-09-05):** 18 itens adicionados abaixo (F1–F20 excl. F7/F16 descartados).
> Rastreio original: `docs/audit-bigpickle-2026-09-05.md`.
>
> **Auditoria Defesa Profunda (2026-09-06):** 7 itens adicionados abaixo (F21–F27).
> Rastreio original: `docs/audit-defesa-profunda-2026-09-06.md`.

---

## 🔴 Alta Prioridade

### F1 — Injeção de sessão via token na URL (`OnboardingPage`)
- **Evidência:** `pmo-frontend/src/pages/OnboardingPage.tsx:41-61`
- **Problema:** Intercepta `?token=` e chama `supabase.auth.setSession({ access_token: token, refresh_token: '' })`. O token transita na query string (vaza em logs de proxy e referrer) e é logado em `console.log:47`. A limpeza com `history.replaceState` remove do endereço mas não previne o vazamento durante o trânsito.
- **Sugestão:** Migrar magic link para PKCE nativo do Supabase Auth (`detectSessionInUrl`); remover interceptação manual.

### F13 — Sync offline cria PMO duplicado em retry (`useSyncEngine`)
- **Evidência:** `pmo-frontend/src/hooks/offline/useSyncEngine.ts:89-101`
- **Problema:** `createPmo(payload)` não usa chave de idempotência; `localDb.delete(item.id)` ocorre _depois_ do create. Se o create grava no Supabase mas o delete da fila falha (IndexedDB), o próximo sync cria outro PMO.
- **Sugestão:** Gerar `idempotency_key` antes de enfileirar e passá-la na RPC; ou gravar o `id` do servidor de volta no item de fila e usar upsert.

### F17 — Session Replay Sentry sem gate de ambiente ou consentimento LGPD
- **Evidência:** `pmo-frontend/src/main.tsx:20-21` — `replaysOnErrorSampleRate: 1.0`
- **Problema:** 100% dos erros gravam a sessão inteira (rrweb), incluindo dados sensíveis do caderno de campo, sem opt-in do produtor e sem desabilitação em produção.
- **Sugestão:** Desligar replay fora de staging; exigir consentimento; mascarar campos sensíveis com `maskAllText`/seletores.

---

## 🟡 Média Prioridade

### F2 — ESLint não analisa nenhum arquivo TS/TSX
- **Evidência:** `pmo-frontend/eslint.config.js` — globs apenas `**/*.{js,jsx}`
- **Problema:** `npm run lint` é no-op para ~281 arquivos `.ts/.tsx`. Qualidade depende exclusivamente de revisão manual.
- **Sugestão:** Adicionar `**/*.{ts,tsx}` com `typescript-eslint` e rodar no CI.

### F8 — Boot quebra com página branca quando env vars estão ausentes
- **Evidência:** `pmo-frontend/src/supabaseClient.ts:17` — `throw new Error(...)` em tempo de import de módulo
- **Problema:** Sem `ErrorBoundary` que capture erro de módulo, o app não monta e exibe tela branca.
- **Sugestão:** Inicialização lazy com tela de erro explicativa, ou cliente nulo com bloqueio por tela própria.

### F9 — Rota `/mural` registrada duas vezes no mesmo `<Routes>`
- **Evidência:** `pmo-frontend/src/App.tsx:164` e `App.tsx:240`
- **Problema:** Um `<Route path="/mural">` fora do `ModalityGuard` e outro dentro — código duplicado, divergência futura garantida.
- **Sugestão:** Manter apenas uma definição (fora do guard, se a rota é pública dentro do layout).

### F12 — `fetchPmoById` usa `select('*')` puxando coluna `form_data` (JSONB pesado)
- **Evidência:** `pmo-frontend/src/services/pmoService.ts:142`
- **Problema:** `form_data` pode conter megabytes de JSON; a função `fetchDashboardPmoDetails` já existe e exclui `form_data` propositalmente. O problema é que `fetchPmoById` é chamado em contextos que precisam apenas de metadados.
- **Sugestão:** Auditar chamadores de `fetchPmoById` e substituir por `fetchDashboardPmoDetails` onde `form_data` não é necessário.

### F14 — Backoff exponencial sem teto no sync offline
- **Evidência:** `pmo-frontend/src/hooks/offline/useSyncEngine.ts:62` — `Math.pow(2, item.retries) * 1000` sem `Math.min`
- **Problema:** Com muitas falhas, o delay cresce indefinidamente. Item pode ficar em espera por horas/dias.
- **Sugestão:** `Math.min(Math.pow(2, r) * 1000, 5 * 60 * 1000)` + jitter.

### F20 — Verificar dependências incompletas em `useRecordValidation` (callers)
- **Evidência:** `pmo-frontend/src/hooks/manual-record/useRecordValidation.ts` — as funções de validação _em si_ são puras, mas o hook consumidor (provavelmente `ManualRecordDialog.tsx`) pode ter deps incompletas nos `useCallback` que chamam `setErrors`.
- **Problema:** Re-renders podem dessincronizar estado de erro durante submissão.
- **Sugestão:** Auditar `ManualRecordDialog.tsx` e callers com `eslint-plugin-react-hooks`.

### F21 — Código de vínculo (`CONECTAR`) gerado com `Math.random()` no frontend
- **Evidência:** `pmo-frontend/src/services/whatsappService.ts:12-19`
- **Problema:** Geração de código de vínculo de dispositivo com `Math.random()` (não-criptográfico) espelhada no frontend; a decisão de segurança do fluxo vive no Go (DT-109) — o frontend não deve gerar nem confiar em códigos.
- **Sugestão:** Remover geração local; consumir apenas o status/expiração devolvidos pelo backend (DT-109) e refrigerar a UI de `CONECTAR`.
- **Cross-ref:** DT-109 (`pmo-bot-go/internal/supabase/quota.go:172-218`).

### F22 — Zero CSP e security headers no deploy (Vercel)
- **Evidência:** `pmo-frontend/vercel.json:8-27` — apenas headers de `Cache-Control`
- **Problema:** Sem Content-Security-Policy, `X-Frame-Options`, `Referrer-Policy` etc.; qualquer XSS exfiltra sem barreira e a app pode ser emoldada (clickjacking).
- **Sugestão:** Adicionar CSP (`default-src 'self'` + allowlist Google Maps/Sentry/Vercel), `frame-ancestors 'none'`, `referrer-policy: no-referrer`.

### F23 — Rotas `/lab` e `/teste-mapa` acessíveis em produção
- **Evidência:** `pmo-frontend/src/App.tsx:74,76`
- **Problema:** Páginas experimentais publicadas no bundle de produção sem gate de ambiente; `/lab` pode expor utilitários que quebram em prod.
- **Sugestão:** Bloquear por `import.meta.env.DEV` ou mover para build separado; nunca expor em produção sem guarda.

### F24 — `update_profile` aceita mapa arbitrário (escreve colunas indevidas)
- **Evidência:** `pmo-frontend/src/services/profileService.ts:94-95` — `supabase.from('profiles').update(patch)` com `patch` tipado como `Record<string, unknown>`
- **Problema:** Sem allowlist de colunas, um componente/site pode gravar qualquer coluna de `profiles` (ex.: sobrescrever `role`), contornando a proteção da RLS para escritas permitidas.
- **Sugestão:** Tipar com transform apenas dos campos editáveis (nome, telefone, avatar_url) e validar contra um conjunto fechado.

---

## 🟢 Baixa Prioridade / Higiene

### F3 — `setupFiles` do Vitest aponta para `.js` inexistente
- **Evidência:** `pmo-frontend/vite.config.ts:85` → `./src/setupTests.js`; arquivo existe como `.ts`
- **Sugestão:** Corrigir para `./src/setupTests.ts`.

### F4 — PWA precacheia `robots.txt` e `apple-touch-icon.png` ausentes
- **Evidência:** `pmo-frontend/vite.config.ts:52`; `Test-Path` = False para ambos (e para `favicon.ico`)
- **Sugestão:** Criar os assets ou removê-los de `includeAssets`.

### F5 — Artefatos de build `dev-dist/` commitados no git
- **Evidência:** `git ls-files pmo-frontend/dev-dist` — 5 arquivos Workbox rastreados
- **Sugestão:** Adicionar `pmo-frontend/dev-dist/` ao `.gitignore`; `git rm -r --cached pmo-frontend/dev-dist`.

### F6 — Módulo `src/api.ts` morto apontando para Django localhost
- **Evidência:** `pmo-frontend/src/api.ts:10` — `baseURL: 'http://127.0.0.1:8000/api'`; zero imports no repo
- **Sugestão:** Remover o arquivo com commit dedicado.

### F10 — Rotas `/pmo/novo` e `/pmo/:pmoId/editar` sem `DebugErrorBoundary`
- **Evidência:** `pmo-frontend/src/App.tsx:197-206` — rotas irmãs têm boundary, essas não
- **Sugestão:** Envolver com o mesmo boundary das demais rotas PMO.

### F11 — UUID gerado com `Math.random()` (polyfill não-criptográfico)
- **Evidência:** `pmo-frontend/src/services/pmoService.ts:83-87` — polyfill manual de UUIDv4
- **Contexto:** Comentário explica "mesmo sem HTTPS/crypto" — é um fallback intencional, mas `crypto.randomUUID()` está disponível em todos os alvos modernos.
- **Sugestão:** `crypto.randomUUID()` com fallback apenas para ambientes sem `crypto` (raro).

### F15 — Token Mapbox fake hardcoded em URL de imagem
- **Evidência:** `pmo-frontend/src/pages/PropertyProfilePage.tsx:610` — `access_token=pk_test_...`
- **Sugestão:** Mover para `VITE_MAPBOX_TOKEN`.

### F18 — `console.log` ativos em produção, alguns expondo dados sensíveis
- **Evidência:** `OnboardingPage.tsx:47` (loga token), `Secao8.tsx`, `BotSuggestionsPanel.tsx`, `GeneralLogTable.tsx`, `useSyncEngine.ts`, `supabaseClient.ts`
- **Sugestão:** Remover ou condicionar a `import.meta.env.DEV`; nunca logar tokens sem sanitização.

### F19 — Paginação persistida não reseta ao trocar de PMO
- **Evidência:** `paginationStore.ts` (Zustand persist) — `page` mantida por chave sem reset ao trocar `pmo_id`
- **Problema:** Trocar de PMO pode aterrissar em página vazia ou fora do intervalo.
- **Sugestão:** Resetar `page` em `useEffect` keyed por `pmoId`.

### F25 — URLs previsíveis via `getPublicUrl` (avatars, comprovantes, anexos)
- **Evidência:** `pmo-frontend/src/services/profileService.ts:129` (avatars), `dashboardService.ts:224,231` (comprovantes), `storageBucketService.ts:49` (anexos-pmos)
- **Problema:** Buckets públicos com paths determinísticos — quem conhece a URL baixa o arquivo sem sessão. Mesma classe do `audios_audit`, tratada via signed URL policy (DT-105).
- **Sugestão:** Buckets privados + signed URLs com expiração curta (padrão `audios_audit`), revisando posse.
- **Cross-ref:** DT-108 (`avatars`), DT-111 (`comprovantes`).

### F26 — Chave da Google Maps embarcada no bundle de produção
- **Evidência:** `pmo-frontend/src/services/googleTilesSession.ts:81-82` e `useSatelliteMapStyle.ts:44`
- **Problema:** A API key de tiles satélite vai no bundle entregue ao navegador (rastreável em `Source`/`sources.json`), sujeita a abuso de quota/serviço pago.
- **Sugestão:** Restrição de domínio (`http referer`) na configuração do Google Cloud para o domínio de produção; caso já exista, documentar a mitigação.
- **Cross-ref:** F15 (mesmo padrão de chave Mapbox hardcoded).

### F27 — Lote gerado com `Math.random()` em `traceabilityService`
- **Evidência:** `pmo-frontend/src/services/traceabilityService.ts:20-21`
- **Problema:** UUID/v1 do lote gerado com `Math.random()` (não-criptográfico) — mesmo padrão do polyfill de F11 (`pmoService.ts:83-87`).
- **Sugestão:** `crypto.randomUUID()` (note: `shareDados`/rastro público pode mudar o formato; validar com os registros existentes).

---

## 📌 Backlog Produto

### [PMO Knowledge Ops] RAG Específico do Usuário Final
**Data:** 21/07/2026 | **Status:** 📌 Pendente

A atual infraestrutura de ingestão (`/api/v1/admin/knowledge/ingest`) foi construída exclusivamente para o Admin Global. A antiga página (`/admin/conhecimento`) foi deletada pois era "código zumbi".

**O que precisa ser construído:**
1. **Novo Endpoint (Go):** `/api/v1/user/knowledge/ingest` — extrai `pmo_id` do JWT, aplica cotas (Free vs Pro).
2. **Nova Tela (Frontend):** `/propriedade?tab=knowledge` — upload de cartilhas pessoais, análises de solo; exibe só `ingestion_jobs` do próprio `pmo_id`.

**Objetivo:** similarity search usa documentos globais (Admin) **+** documentos do PMO do usuário.

