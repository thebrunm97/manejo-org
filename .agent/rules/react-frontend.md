---
globs: ["pmo-frontend/**/*.tsx", "pmo-frontend/**/*.ts"]
---

# Regras para Frontend React — PMO Dashboard PWA

## Referências Obrigatórias
Antes de modificar o frontend, consultar:
- **Offline Sync:** [offline.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/frontend/offline.md)
- **Schema do banco:** [schema.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/database/schema.md)
- **Arquitetura:** [overview.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/architecture/overview.md)

## Stack de Mapas (CRÍTICO — ler com atenção)
- **Motor de renderização:** MapLibre GL JS v5 (WebGL).
- **NÃO usar Google Maps.** NÃO instalar `@googlemaps/*`.
- **NÃO usar Leaflet** como motor principal.
- **NÃO usar Mapbox GL JS** (usar o fork MapLibre).
- **Wrapper React:** `react-map-gl` v8 em modo MapLibre.
- **Tiles/Basemap:** Esri World Imagery via ArcGIS REST Services.
- **Desenho de polígonos:** `@mapbox/mapbox-gl-draw` v1.5.
- **⚠️ BUG CONHECIDO:** intercepta touch events no mobile.
    - **Solução:** montar Draw CONDICIONALMENTE (`{isDrawMode && <DrawControl/>}`).
    - **Para touch detection:** usar capture phase no container PAI, não no canvas.
- **Cálculos geográficos:** Turf.js e geolib.

## Regras de Offline Sync
- **Storage local:** IndexedDB via biblioteca `idb`.
- **Engine de sync:** `useSyncEngine.ts` com pattern Claim-then-Delete.
- **IDs offline:** DEVEM ter prefixo `offline_` para identificação.
- **Sync:** usa backoff exponencial em caso de falha.
- **Novos stores:** DEVEM ser documentados em [offline.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/frontend/offline.md).

## Regras de Estilo
- **CSS:** usar CSS-Direct ou Tailwind v4 nas áreas refatoradas.
- **Manter consistência** com o estilo existente da página/componente.
- **Componentes de UI** devem ser responsivos (mobile-first).

## Regras de Qualidade
- **Novos componentes de página** devem ser documentados com comentário de header.
- **Queries ao Supabase** devem tratar erro e estado de loading.
- **Dados sensíveis** NUNCA no client-side (usar Supabase RLS).
