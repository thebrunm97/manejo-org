# Offline-first

A propriedade rural é o pior ambiente possível para um app que depende de
rede: sinal intermitente, latência alta, bateria escassa. O registro precisa
ser aceito **no momento em que o produtor está no canteiro**, não quando ele
volta para a sede.

## Princípio

Escrever local primeiro, sincronizar depois. O sucesso da operação para o
usuário é a gravação no IndexedDB — a subida para o Supabase é um detalhe de
implementação assíncrono.

## Implementação

- PWA com `vite-plugin-pwa` (service worker + instalação no celular).
- IndexedDB via `idb`, banco `pmo-digital-db`
  (`pmo-frontend/src/utils/db.ts`), com três stores:
  - `pending-pmos` — rascunhos de [[pmo]];
  - `pending-caderno` — store legada de [[registro-de-caderno]];
  - `offline-sync-queue` — fila unificada atual.
- Reconciliação com backoff exponencial no
  [[motor-de-sincronizacao-offline]].

## O risco que isso cria

Conflito e duplicação. Um registro pode ser enfileirado offline e também
chegar pelo WhatsApp. A idempotência é tratada no servidor
(`pmo-bot-go/internal/guardrails/idempotency.go`, tabela
`processed_webhooks`) e nas RPCs atômicas do [[supabase-postgres]].

## Fontes

- `docs/concepts/offline-sync.md`
- `docs/raw/RESEARCH_PWA_OFFLINE.md`
