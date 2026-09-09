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

### F23 — Rotas `/lab` e `/teste-mapa` acessíveis em produção
- **Evidência:** `pmo-frontend/src/App.tsx:74,76`
- **Problema:** Páginas experimentais publicadas no bundle de produção sem gate de ambiente; `/lab` pode expor utilitários que quebram em prod.
- **Sugestão:** Bloquear por `import.meta.env.DEV` ou mover para build separado; nunca expor em produção sem guarda.

### F24 — `update_profile` aceita mapa arbitrário (escreve colunas indevidas)
- **Evidência:** `pmo-frontend/src/services/profileService.ts:94-95` — `supabase.from('profiles').update(patch)` com `patch` tipado como `Record<string, unknown>`
- **Problema:** Sem allowlist de colunas, um componente/site pode gravar qualquer coluna de `profiles` (ex.: sobrescrever `role`), contornando a proteção da RLS para escritas permitidas.
- **Sugestão:** Tipar com transform apenas dos campos editáveis (nome, telefone, avatar_url) e validar contra um conjunto fechado.

### F28 — `vitest run` coleta os specs do Playwright em `e2e/`, e 15 testes de componente falham por timeout de `waitFor`
- **Evidência:** `npx vitest run` (2026-09-09) — 25 de 52 arquivos "falham", mas 14 desses são `e2e/**/*.spec.ts` (compliance-multimodality, auth-regression, manual-record-dialog, etc.), que usam a API do Playwright, não a do vitest; o glob padrão do vitest não exclui `e2e/`. Cross-ref DT-129 (E2E sem secrets/ambiente configurado) — mesma família de débito de infraestrutura de teste, achado diferente.
- **Problema:** Além disso, 15 testes de verdade falham por `waitFor` expirando após ações como "abrir modal e adicionar item" ou "upload de arquivo": `Secao2`, `Secao3`, `Secao9`, `Secao10`, `Secao11`, `Secao13`, `Secao15`, `Secao18`, `Coordenadas`, `DadosCadastrais`. Confirmado que não é regressão do trabalho de segurança desta sessão (backend/RLS, nenhum arquivo de frontend tocado) nem do `resendConfirmation` em progresso em `AuthContext`/`AuthCoreContext` (mudança puramente aditiva, sem relação com essas telas) — padrão de falha pré-existente, ainda não investigado a fundo.
- **Sugestão:** Excluir `e2e/**` do `test.include` do vitest (`vite.config.ts`) pra parar de coletar specs do Playwright; investigar separadamente por que os 15 testes de componente estão dando timeout no `waitFor` (suspeita: mock de callback assíncrono não resolvendo, ou timeout padrão curto demais pra essas interações).

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

---

## 🟢 Concluído

### F13 — Sync offline cria PMO duplicado em retry (`useSyncEngine`)
**Concluído em:** 2026-09-09.

`create_pmo` (RPC, `supabase/migrations/20260818160000_create_pmo_mutation_rpcs.sql`) não tinha
chave de idempotência — o padrão "claim-then-delete" do `useSyncEngine.ts` (marca como `syncing`,
chama `createPmo`, só apaga da fila IndexedDB depois do sucesso) deixava uma janela real: se a
resposta se perdesse depois do servidor já ter criado o PMO, o próximo sync reenviava o mesmo
payload e criava um segundo PMO. Corrigido com o mesmo padrão de dedupe já usado em
`rpc_registrar_operacao_campo` e companhia (`20260816000000_add_idempotency_to_mutations.sql`):
coluna `idempotency_key` em `pmos` + índice único parcial em `(user_id, idempotency_key)`, e o
`create_pmo` devolve a linha já existente em vez de inserir de novo quando reconhece a chave.
`useSyncEngine.ts` passa o próprio `id` local (`offline_<timestamp>`, estável para o item enquanto
ele fica na fila) como `idempotency_key`, sem precisar gerar nada novo. `update_pmo` não recebeu o
mesmo tratamento — um retry de UPDATE só reaplica os mesmos campos sobre a mesma linha, sem risco
de duplicação, então a chave lá seria defesa sem um failure mode real por trás. Migration
`supabase/migrations/20260909120000_f13_pmo_create_idempotency.sql`, aplicada em staging
(`pmo-staging`) e produção (`pmo-inteligente`), coluna e índice confirmados via SQL direto nos
dois. Mecânica do índice único testada isoladamente numa tabela temporária em staging (rejeita
segunda linha com a mesma `(user_id, idempotency_key)`); não foi possível testar a RPC ponta a
ponta em staging por falta de usuários reais em `auth.users` lá (`count(*) = 0`), então a
verificação ficou em: `go`... não se aplica aqui, TS `tsc --noEmit` limpo + leitura de
`pg_proc.prosrc` confirmando que o código aplicado bate exatamente com o arquivo do repositório.

### F22 — Zero CSP e security headers no deploy
**Concluído em:** 2026-09-09.

O `vercel.json` mudou de papel desde que a infra migrou pra VPS (ver commit em andamento no mesmo
arquivo): hoje ele só redireciona todo o tráfego do domínio antigo da Vercel para
`https://manejo.fyto.io` (`"redirects": [{"source": "/(.*)", ...}]`). Quem serve o frontend de
verdade é `pmo-frontend/Caddyfile` (Docker, atrás do Caddy reverso da VPS — ver
`deploy/Caddyfile`), que já se descrevia como replicando o comportamento do `vercel.json` antigo
e nunca tinha ganhado os headers de segurança. Adicionados os dois lugares: no Caddyfile (onde
tem efeito real) e no `vercel.json` (defesa em profundidade, sem custo). CSP construída a partir
dos domínios que o app de fato chama (não uma allowlist genérica): Supabase do projeto de
produção (API/Realtime/Storage), o gateway do bot (`bot.fyto.io`), Google Fonts, tiles de
satélite (Google Tile API + OpenStreetMap) e o ingest do Sentry — mais `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e
`Permissions-Policy` (geolocalização liberada por ser usada no cadastro de talhão; câmera/mic
negados, o app web não usa nenhum dos dois). `style-src` precisou de `'unsafe-inline'` porque
React aplica estilo via atributo `style=""`, que a CSP trata como inline — sem nonce viável num
SPA estático servido por arquivo. Caddyfile validado com `caddy validate` (imagem oficial via
Docker); `vercel.json` validado como JSON bem formado.

### F1 — Injeção de sessão via token na URL (`OnboardingPage`)
**Concluído em:** 2026-09-09 (achado ao verificar o código antes de gerar um prompt de correção
pro BigPickle — a entrada abaixo estava desatualizada, o código real já tinha sido substituído).

O código descrito neste item (`OnboardingPage.tsx:41-61` interceptando `?token=` e chamando
`supabase.auth.setSession({ access_token: token, refresh_token: '' })`, com `console.log` do
token) **não existe mais no repositório**. O fluxo de magic link foi reescrito no commit
`4dc01f2` (07/09/2026, "feat(multicanal): liga ChannelSender/DeliveryManager e conserta
onboarding") para uma página dedicada, `pmo-frontend/src/pages/AuthCallback.tsx`: a URL carrega
só um `code` opaco (nunca o `access_token`/`refresh_token` cru), trocado por tokens reais via
`POST /api/v1/auth/exchange` no backend (`pmo-bot-go/internal/api/auth_pkce_test.go` confirma a
implementação), com `history.replaceState` limpando a URL depois e nenhum log do código/token —
só `console.error` da mensagem de erro em caso de falha. `supabaseClient.ts` já tem
`detectSessionInUrl: true`, exatamente a sugestão original deste item.

Nenhuma ação de código foi necessária — este registro só estava com o status desatualizado
(mesmo padrão já visto no DT-126 do backend: o código já tinha sido corrigido em outra sessão,
mas o documento de débito nunca foi atualizado para refletir isso).

