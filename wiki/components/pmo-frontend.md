# pmo-frontend

PWA React que é o dashboard do [[produtor]] e o painel das
[[organizacao]]s. Diretório: `pmo-frontend/`.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · react-router-dom 7 ·
`@supabase/supabase-js` · Zod (validação) · `idb` (IndexedDB) ·
MapLibre GL + `react-map-gl` + Turf · i18next (pt/en/es) · Recharts ·
Sentry · `vite-plugin-pwa`. Testes: Vitest + Testing Library + Playwright.

## Mapa de rotas

`pmo-frontend/src/App.tsx` (nomes canônicos em `src/routes/routeNames.ts`)

| Escopo | Rotas |
| --- | --- |
| Público | `/home`, `/login`, `/cadastro`, `/changelog`, `/trace/:codigoLote`, `/t/:id` |
| Privado | `/hub`, `/onboarding`, `/dashboard`, `/perfil`, `/propriedade`, `/financeiro`, `/mural`, `/caderno`, `/culturas` |
| Sob `ModalityGuard` | `/planos`, `/mapa`, `/pmo/novo`, `/pmo/:pmoId`, `/pmo/:pmoId/editar` |
| Gestão | `/coop/organizacoes`, `/coop/organizacao/:slug[/dashboard\|/demandas]` |
| Admin | `/admin`, `/admin/chat` |

## Guards (`src/routes/`)

- `RouteGuard` — sessão; redireciona para `/onboarding` (zero propriedades)
  ou `/hub` (mais de uma propriedade sem seleção ativa).
- `ModalityGuard` — bloqueia features orgânicas em propriedade convencional,
  ver [[producao-paralela]].
- `GestaoRoute` / `AdminRoute` — papéis de [[organizacao]] e administração.

## Camadas

```
pages/      telas por rota
components/ UI reutilizável (Map/, layouts/)
hooks/      estado por domínio (offline/, map/, pmo/, financeiro/, coop/)
services/   acesso a dados — Supabase SDK e cliente do bot Go
domain/     tipos e regras (pmo/, geo/, financeiro/, organizacao/, coletivo/)
utils/db.ts IndexedDB
```

## Como fala com o backend

Dois canais distintos:

1. **Direto ao Postgres** via Supabase SDK (`supabaseClient.ts`) — a maioria
   das leituras e as RPCs de mutação. Autorização por RLS, ver
   [[supabase-postgres]].
2. **HTTP ao Go** via `services/goApiClient.ts` e `ragService.ts` — mapas,
   tiles, estatísticas zonais e upload de conhecimento. Ver [[pmo-bot-go]].

Relacionado: [[motor-de-sincronizacao-offline]], [[mapa-e-geoprocessamento]].
