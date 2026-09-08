# Motor de sincronização offline

Reconcilia o que foi gravado no celular sem rede com o
[[supabase-postgres]]. É a implementação do princípio descrito em
[[offline-first]] (ADR-003).

## Armazenamento local

`pmo-frontend/src/utils/db.ts` — IndexedDB `pmo-digital-db`, versão 2, via
`idb`:

| Store | Conteúdo |
| --- | --- |
| `pending-pmos` | Rascunhos de [[pmo]] |
| `pending-caderno` | Store legada de [[registro-de-caderno]] |
| `offline-sync-queue` | Fila unificada atual |

`localDb` expõe `set` / `get` / `getAll` / `delete` / `clear`, com o store
como parâmetro.

## O hook

`pmo-frontend/src/hooks/offline/useSyncEngine.ts`

- Só roda com `navigator.onLine`; `isSyncingRef` impede execução concorrente.
- **Migra a store legada**: se `offline-sync-queue` está vazia mas
  `pending-caderno` tem itens, converte cada um em job
  `{ type: 'CADERNO_SAVE', payload, retries, status, syncing }` e apaga o
  original. Migração preguiçosa, sem script de deploy.
- Cada item tem `retries` e `lastAttempt`, com **backoff exponencial**.
- Estado exposto: `idle` | `syncing` | `error`, com feedback via toast.
- Despacha para `cadernoService` ou `createPmo` / `updatePmo` conforme o tipo.

Lógica específica da caderneta em
`hooks/offline/useCadernoOfflineLogic.ts`.

## O que ainda dói

A proteção contra duplicação depende da idempotência do servidor. Um mesmo
fato registrado offline no PWA **e** falado no WhatsApp são dois caminhos de
escrita distintos; a reconciliação entre eles não é automática.

## Fontes

- `docs/architecture/adr/003-offline-first.md`
- `docs/concepts/offline-sync.md`, `docs/raw/RESEARCH_PWA_OFFLINE.md`
