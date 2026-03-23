# 🔬 FRONTEND TECH DEBT — Relatório de Auditoria Arquitetural

**Projeto:** `pmo-frontend` (PWA Offline-First)  
**Auditor:** Antigravity · Arquiteto Frontend Sênior  
**Data:** 2026-03-20  
**Fase:** RESEARCH (RPI Framework) — Diagnóstico Apenas  

---

> [!CAUTION]
> Este relatório contém **problemas de severidade 🔴 ALTA** que implicam risco real de **perda de dados** e **vulnerabilidades de segurança**. Priorizar correção antes de novas features.

---

## Sumário Executivo

| Pilar | 🔴 Alta | 🟡 Média | Total |
|---|---|---|---|
| 1. Sincronização Offline | 4 | 2 | 6 |
| 2. Gestão de Estado / Performance | 2 | 4 | 6 |
| 3. Segurança / Autenticação | 2 | 2 | 4 |
| 4. Dívida Técnica / Acessibilidade | 1 | 5 | 6 |
| **TOTAL** | **9** | **13** | **22** |

---

## Pilar 1 — Sincronização Offline e Service Workers

### 🔴 SYNC-01: Sem Guarda `beforeunload` — Risco de Perda de Dados

- 📍 `src/hooks/offline/useSyncEngine.ts` (completo)
- 🐛 **Problema:** O sync engine é disparado apenas em `mount` e `online`. Se o utilizador fechar o browser/aba **enquanto a sincronização está a correr**, os itens que já foram lidos da fila mas ainda não foram enviados ao servidor são perdidos permanentemente — o item já foi consumido da IndexedDB mas a API nunca o recebeu.
- 🛠️ **Solução:**
  - Adicionar listener `beforeunload` que bloqueia fecho durante sync ativo.
  - Implementar padrão "claim-then-delete": marcar item como `syncing` antes de enviar, só deletar após confirmação do servidor. Em fallback, re-marcar como `pending` ao reabrir.

### 🔴 SYNC-02: `isSyncing` é Estado React — Stale Closure

- 📍 `src/hooks/offline/useSyncEngine.ts:19`
- 🐛 **Problema:** `isSyncing` é `useState`, usado como guard na L19 (`if (isSyncing) return`). Mas o `useCallback` na L18 captura o valor de `isSyncing` no momento da criação, e como `isSyncing` está no array de dependências do `useCallback` (L103), cada mudança de `isSyncing` cria uma nova referência de `syncPendingRecords`, que por sua vez re-executa o `useEffect` (L116), potencialmente causando syncs duplicados.
- 🛠️ **Solução:**
  - Usar `useRef` para a flag `isSyncing` (evita stale closure e re-renders desnecessários).
  - Manter `useState` separado apenas para exposição na UI se necessário.

### 🔴 SYNC-03: Sem Retry / Exponential Backoff

- 📍 `src/hooks/offline/useSyncEngine.ts:83-86`
- 🐛 **Problema:** Quando um item falha na sincronização (L83-86), o erro é logado e `failCount` incrementado, mas o item **permanece na fila sem qualquer incremento de `retries`**. Na próxima execução, será tentado novamente infinitamente sem delay, podendo causar rate-limiting no Supabase ou loops de erro.
- 🛠️ **Solução:**
  - Incrementar `item.retries` a cada falha e persisti-lo no IndexedDB.
  - Implementar backoff exponencial (`2^retries * baseDelay`).
  - Dead-letter queue: mover para store `failed-sync` após `maxRetries` (ex: 5) e notificar utilizador.

### 🔴 SYNC-04: Sem Sync Periódico / Visibilitychange

- 📍 `src/hooks/offline/useSyncEngine.ts:106-116`
- 🐛 **Problema:** O sync só ocorre em `mount` e no evento `online`. Não há `setInterval` nem listener de `visibilitychange`. Se o utilizador ficar online mas mudar de aba, alterações ficam presas até à próxima navegação completa no app.
- 🛠️ **Solução:**
  - Adicionar `setInterval` (ex: cada 30s) que verifica se há itens pendentes.
  - Adicionar listener `visibilitychange` para sincronizar ao voltar a focar a aba.

### 🟡 SYNC-05: IDs Offline com Prefixo String — Conflito Potencial

- 📍 `src/hooks/offline/useCadernoOfflineLogic.ts:68`
- 🐛 **Problema:** O offline ID é `offline_${Date.now()}_${random}`. O sync engine (L56) usa `startsWith('offline_')` para determinar se deve fazer `INSERT` ou `UPDATE`. Se o relógio do dispositivo estiver errado ou se `Date.now()` colidir (pouco provável mas possível em saves rápidos), pode haver duplicação.
- 🛠️ **Solução:**
  - Usar `crypto.randomUUID()` com prefixo `local_` para IDs verdadeiramente únicos.
  - Após sync bem-sucedido, devolver o ID real do servidor e atualizar referências locais.

### 🟡 SYNC-06: Migração Legacy Sem Idempotência

- 📍 `src/hooks/offline/useSyncEngine.ts:26-41`
- 🐛 **Problema:** A migração de `CADERNO_STORE` para `SYNC_QUEUE_STORE` (L26-41) faz `set` + `delete` sequencialmente. Se o processo interromper entre o `set` e o `delete`, o item fica duplicado nas duas stores.
- 🛠️ **Solução:**
  - Usar transação IndexedDB atómica (`tx` com ambas as stores) para garantir atomicidade.

---

## Pilar 2 — Gestão de Estado e Re-renders (Performance)

### 🔴 PERF-01: AuthContext Monolítico — Re-render Cascade

- 📍 `src/context/AuthContext.tsx:224-228`
- 🐛 **Problema:** O contexto expõe **12 valores** num único `useMemo` com 12 dependências. Qualquer mudança em `authToken`, `isLoadingRole`, `profile`, `isAdmin`, etc. causa re-render de **TODA** a árvore de componentes que consome `useAuth()`. Componentes como `Sidebar.tsx`, `RouteGuard.tsx`, `PropertyMap.tsx`, `AdminRoute.tsx`, e muitos outros consomem `useAuth()` — cada token refresh (que ocorre silenciosamente) re-renderiza tudo.
- 🛠️ **Solução:**
  - Separar em múltiplos contextos: `AuthSessionContext` (token, user), `AuthProfileContext` (profile), `AuthRoleContext` (isAdmin).
  - Alternativamente, usar Zustand com selectores granulares: `useAuthStore(s => s.isAdmin)`.

### 🔴 PERF-02: `console.log` em Produção no AuthProvider

- 📍 `src/context/AuthContext.tsx:239`
- 🐛 **Problema:** `console.log('AuthProvider: Rendering Provider with value:', ...)` executa a **cada render** do Provider (ou seja, a cada mudança de qualquer uma das 12 deps do `useMemo`). Em produção, isto é ruído e overhead.
- 🛠️ **Solução:**
  - Envolver em `if (import.meta.env.DEV)` ou remover completamente.
  - Aplicar a mesma limpeza em `supabaseClient.ts:8,18`.

### 🟡 PERF-03: FarmMap — Leaflet Layer Not Memoized

- 📍 `src/components/Map/FarmMap.tsx:121-165`
- 🐛 **Problema:** O `talhoes.map(...)` dentro do `FeatureGroup` (L121) recria todos os `Polygon` components a cada render do `FarmMap`. Como `FarmMap` não é `React.memo` e recebe novos arrays de `talhoes` (referência nova a cada fetch), **todos os polígonos e os seus popups são destruídos e recriados** desnecessariamente.
- 🛠️ **Solução:**
  - Envolver `FarmMap` em `React.memo` com comparação profunda dos `talhoes`.
  - Extrair os `Polygon` para sub-componente memoizado.

### 🟡 PERF-04: FarmMap — `window.L` Global Side Effect

- 📍 `src/components/Map/FarmMap.tsx:5-7`
- 🐛 **Problema:** `(window as any).L = L;` é executado como side-effect de módulo (antes de qualquer render). Isto polui o namespace global e pode causar conflitos com outras bibliotecas ou instâncias de Leaflet.
- 🛠️ **Solução:**
  - Remover a injeção global se o `leaflet-draw-shim.js` puder importar L diretamente.
  - Se necessário, limitar ao scope do componente.

### 🟡 PERF-05: PropertyMap — Leaflet Layer Não Limpo no Unmount

- 📍 `src/components/PropertyMap/PropertyMap.tsx:50`
- 🐛 **Problema:** `pendingTalhao` mantém referência a `layer` do Leaflet (`{ layer: any, geometry: string, areaM2: number }`). Se o `PropertyMap` desmontar com `pendingTalhao` ainda preenchido, a referência à layer do Leaflet persiste em memória sem cleanup. Embora `MapContainer` do react-leaflet faça cleanup da instância do mapa, layers orphã do draw control podem ficar em memória.
- 🛠️ **Solução:**
  - Adicionar `useEffect` de cleanup que chama `pendingTalhao?.layer?.remove()` no unmount.

### 🟡 PERF-06: FieldDiaryTableV2 — Renderização Desktop + Mobile em Paralelo

- 📍 `src/components/FieldDiaryTableV2.tsx:439 + 535`
- 🐛 **Problema:** Ambas as versões (tabela desktop L439 e cards mobile L535) são renderizadas no DOM e depois escondidas via CSS (`hidden md:block` / `flex md:hidden`). Isto significa que **cada registro** é renderizado **duas vezes** no DOM, duplicando nós.
- 🛠️ **Solução:**
  - Usar `useIsMobile()` hook existente para renderizar condicionalmente apenas uma versão.
  - Alternativamente, render no server-side `hidden` está ok se os nós são lightweight, mas com `audio` elements (L489) isto pode ser problemático.

---

## Pilar 3 — Segurança e Autenticação (Frontend)

### 🔴 SEC-01: `user_id` Enviado pelo Frontend — RLS Bypass

- 📍 `src/components/PropertyMap/PropertyMap.tsx:172`
- 🐛 **Problema:** `user_id: user.id` é incluído no payload de criação de talhão na L172. Isto pressupõe que o **frontend** é a fonte de verdade para `user_id`. Se o backend/RLS não forçar `auth.uid()` como `user_id` na policy `INSERT`, um utilizador malicioso pode injetar outro `user_id` via DevTools e criar talhões em nome de outro utilizador.
- 🛠️ **Solução:**
  - **NUNCA** enviar `user_id` do frontend. Usar uma policy RLS do tipo:
    ```sql
    CREATE POLICY "insert_own" ON talhoes FOR INSERT
    WITH CHECK (user_id = auth.uid());
    ```
  - Ou usar trigger `BEFORE INSERT` para forçar `NEW.user_id = auth.uid()`.

### 🔴 SEC-02: AdminRoute Protegido Apenas por Frontend

- 📍 `src/routes/AdminRoute.tsx:25-27`
- 🐛 **Problema:** A verificação `isAdmin` vem de `supabase.rpc('is_admin')` (L80 do AuthContext), que é invocada uma única vez no login. Se o estado for manipulado via DevTools (`isAdmin = true`), o utilizador teria acesso visual ao painel admin. As chamadas de API subsequentes podem ou não ter RLS — depende da configuração do banco.
- 🛠️ **Solução:**
  - Garantir que **todas** as rotas de API admin estão protegidas por RLS ou funções `SECURITY DEFINER`.
  - Considerar invocar `is_admin()` como middleware em cada request sensível, não apenas no login.

### 🟡 SEC-03: Supabase Anon Key Exposta em Console

- 📍 `src/supabaseClient.ts:8,18`
- 🐛 **Problema:** `console.log('[SupabaseClient] Initializing...', { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey })` — embora não logue o valor da key (apenas `true/false`), o `console.log` em L18 confirma que o client foi criado com sucesso. A anon key em si está acessível no bundle (que é expectável para Supabase), mas os logs de diagnóstico devem ser removidos em produção.
- 🛠️ **Solução:**
  - Remover estes logs ou envolver em `import.meta.env.DEV`.

### 🟡 SEC-04: `select('*')` sem Filtro de Colunas

- 📍 `src/context/AuthContext.tsx:62`
- 📍 `src/services/cadernoService.ts:13`
- 🐛 **Problema:** `select('*')` no fetch de profiles (auth context L62) e caderno (service L13) traz **todas as colunas** da tabela, incluindo potenciais campos sensíveis ou pesados que o frontend não necessita. Aumenta payload e superfície de exposição.
- 🛠️ **Solução:**
  - Especificar colunas explícitas: `select('id, nome, email, avatar_url')`.

---

## Pilar 4 — Dívida Técnica e Acessibilidade

### 🔴 DEBT-01: `ManualRecordDialog.tsx` — God Component (1242 linhas)

- 📍 `src/components/Dashboard/ManualRecordDialog.tsx` (76 KB, 1242 linhas)
- 🐛 **Problema:** Este componente é um **monolito colosal** que contém:
  - 5 tabs completas (Plantio, Manejo, Colheita, Limpeza, Outro) com UI distinta para cada
  - Toda a lógica de payload building (L130-280)
  - Modais internas (justificativa de edição)
  - Lógica de validação inline
  - Dialogs de seleção de localização
  - **Impossível de testar unitariamente** — FFCI = 1 (Poor, Redesign)
- 🛠️ **Solução:**
  - Extrair cada tab content para componente próprio: `PlantioTabContent.tsx`, `ManejoTabContent.tsx`, etc.
  - Extrair payload building para `buildPayload(activeTab, draft)` utility function.
  - Extrair justification modal para componente separado.

### 🟡 DEBT-02: `TalhaoDetailsDrawer.tsx` — Drawer + 2 Modais + Lógica de Solo (730 linhas)

- 📍 `src/components/PropertyMap/TalhaoDetailsDrawer.tsx` (47 KB)
- 🐛 **Problema:** Contém lógica de formulário de solo (L139-228), lógica de criação em lote de canteiros (L95-136), "gauges" visuais (L458-544), e modais embedded. A prop `talhao` é tipada como `any` (L42).
- 🛠️ **Solução:**
  - Extrair `SoilHealthTab` e `StructureTab` como sub-componentes.
  - Tipar `talhao` corretamente com interface `Talhao` já existente.
  - Extrair batch creation modal.

### 🟡 DEBT-03: Ficheiros Duplicados `.js` / `.ts`

- 📍 `src/services/analiseService.js` + `src/services/analiseService.ts`
- 📍 `src/services/locationService.js` + `src/services/locationService.ts`
- 📍 `src/hooks/useDebounce.js` + `src/hooks/useDebounce.ts`
- 📍 `src/utils/deepMerge.js` + `src/utils/soilLogic.js`
- 🐛 **Problema:** Existem **6 ficheiros `.js`** ao lado dos seus equivalentes `.ts`. Dependendo da configuração do bundler, o ficheiro errado pode ser importado, causando bugs subtis de tipagem ou comportamento divergente.
- 🛠️ **Solução:**
  - Auditar cada par e eliminar o ficheiro `.js` legado.
  - Garantir que todos os imports apontam para `.ts`.

### 🟡 DEBT-04: `usePmoFormLogic.ts` — Hook Excessivamente Grande (21 KB)

- 📍 `src/hooks/pmo/usePmoFormLogic.ts` (21 KB)
- 🐛 **Problema:** Um único hook contem toda a lógica de formulário do PMO (18 secções). Likely contém state para dezenas de campos, handlers, validação, e merge-logic. Qualquer mudança num campo ou secção re-executa toda a lógica do hook.
- 🛠️ **Solução:**
  - Separar por responsabilidade: `usePmoStepper`, `usePmoSectionState(sectionId)`, `usePmoValidation`.

### 🟡 DEBT-05: `any` Types no IndexedDB Layer

- 📍 `src/utils/db.ts:22-27`
- 📍 `src/hooks/offline/useCadernoOfflineLogic.ts:66`
- 🐛 **Problema:** As stores `pending-pmos` e `pending-caderno` no `DBSchema` usam `value: any`. O `_saveLocal` na L66 recebe `payload: any`. Isto destrói type-safety e permite que dados malformados entrem na fila de sync, causando erros silenciosos.
- 🛠️ **Solução:**
  - Tipar as stores com interfaces específicas: `PendingPmo`, `PendingCaderno`.
  - Tipar `_saveLocal` com `Omit<CadernoEntry, 'id' | 'created_at'>`.

### 🟡 DEBT-06: Snackbar Artesanal Duplicado em 3 Componentes

- 📍 `src/components/PropertyMap/PropertyMap.tsx:59-70`
- 📍 `src/components/PropertyMap/TalhaoDetailsDrawer.tsx:57-67`
- 📍 Vários componentes com `toast` (react-toastify) E custom snackbar pattern
- 🐛 **Problema:** O projeto usa **duas estratégias de feedback** em paralelo: `react-toastify` (em `ManualRecordDialog`, `App.tsx`) e custom snackbar state pattern reimplementado identicamente em `PropertyMap` e `TalhaoDetailsDrawer`. Código duplicado e UX inconsistente.
- 🛠️ **Solução:**
  - Padronizar: ou `react-toastify` everywhere ou um custom `useSnackbar()` hook.
  - Remover a implementação duplicada e centralizar.

---

## Anexo: Mapa de Ficheiros Críticos

| Ficheiro | Linhas | Tamanho | Risco Principal |
|---|---|---|---|
| `ManualRecordDialog.tsx` | 1242 | 76 KB | 🔴 God Component |
| `TalhaoDetailsDrawer.tsx` | 730 | 47 KB | 🟡 God Component |
| `FieldDiaryTableV2.tsx` | 680 | 42 KB | 🟡 Dual render |
| `PropertyMap.tsx` | 491 | 25 KB | 🟡 Memory leak + SEC |
| `usePmoFormLogic.ts` | ~500+ | 21 KB | 🟡 God Hook |
| `useSyncEngine.ts` | 120 | 4.8 KB | 🔴 Data Loss |
| `AuthContext.tsx` | 247 | 9.2 KB | 🔴 Re-render cascade |
| `supabaseClient.ts` | 21 | 0.7 KB | 🟡 Logs in prod |

---

## Próximos Passos Recomendados (Ordem de Prioridade)

1. **🔴 SYNC-01 + SYNC-02 + SYNC-03** → Reescrever `useSyncEngine` com `useRef`, backoff, `beforeunload`.
2. **🔴 SEC-01** → Remover `user_id` do payload do frontend; validar RLS no Supabase.
3. **🔴 PERF-01** → Separar `AuthContext` em 3 contextos ou migrar para Zustand.
4. **🔴 DEBT-01** → Refatorar `ManualRecordDialog` em sub-componentes por tab.
5. **🟡 DEBT-03** → Eliminar ficheiros `.js` duplicados.
6. **🟡 Restantes** → Backlog de sprint futuro.

---

> *"Um sistema offline-first sem retry, sem backoff e sem guarda de fecho é um sistema que vai perder dados dos agricultores mais isolados — exatamente os utilizadores que mais precisam dele."*
