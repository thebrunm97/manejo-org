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

## Performance e Estado (Expert)
- **Evitar Re-renders:** Usar `useMemo` e `useCallback` em componentes de lista complexos (ex: `MuralDemandas.tsx`) e passar dependências mínimas.
- **Context optimization:** Não colocar estados que mudam frequentemente no `AuthContext` ou root context para evitar re-render da árvore toda.
- **Loading Skeletons:** Usar skeletons em vez de spinners genéricos para melhorar a percepção de performance (LCP).
- **Virtualização:** Para listas com mais de 50 itens (histórico de atividades, mural), usar `react-window` ou similar.

## Regras de Mobile UX (PWA)
- **Touch Optimization:** Botões e elementos clicáveis DEVEM ter área de toque mínima de 44x44px.
- **Bottom Sheets:** Usar o componente `ResponsiveModal` para formulários e detalhes no mobile, seguindo o padrão de gaveta inferior (drawer).
- **Feedback Tátil:** Implementar loading states visuais imediatos em ações de "Salvar" ou "Enviar".
- **Keyboard Awareness:** Garantir que inputs não sejam cobertos pelo teclado virtual no mobile.

## Regras de Estilo e Tailwind
- **Tailwind v4:** Usar a configuração CSS-first. Preferir utilitários de container queries (`@task`) para layouts complexos.
- **Design Tokens:** Seguir os tokens de cores e sombras definidos para o modo dark/glassmorphism do PMO.

## Regras de Qualidade
- **Data Fetching:** Usar patterns de cache (ex: `React Query` ou cache interno no store) para evitar requisições redundantes ao Supabase.
- **Segurança:** Dados sensíveis NUNCA no client-side; aplicar RLS rigoroso no backend.
- **Build Clean:** Ativar lint e type-checking no CI/CD para garantir zero erros de build.
