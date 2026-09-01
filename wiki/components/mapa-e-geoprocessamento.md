# Mapa e geoprocessamento

Desenho de [[talhao]]es, cálculo de área e análise de imagem de satélite.

## No cliente

`pmo-frontend/src/components/Map/` e `pages/MapaPropriedade.tsx` (`/mapa`).

- **MapLibre GL** (`maplibre-gl` + `react-map-gl`) — renderização.
- **`@mapbox/mapbox-gl-draw`** via `MapDrawControl.tsx` — desenho do polígono,
  com estilo próprio em `mapLibreDrawStyle.ts` e estilos base em `mapStyles.ts`.
- **Turf** (`@turf/area`, `@turf/length`, `@turf/center-of-mass`) — área,
  perímetro e centroide calculados **no navegador**, já que a geometria é
  JSONB e não PostGIS.
- Serviços: `services/mapService.ts`, `talhaoService.ts`,
  `locationService.ts`, `googleTilesSession.ts`.

## No servidor (Google Earth Engine)

`pmo-bot-go/internal/geo/` — `earthengine_auth.go`, `earthengine_client.go`,
`earthengine_maps.go`, `earthengine_zonal.go`, `earthengine_ast.go`.
Exposto por `pmo-bot-go/internal/api/map_handler.go`:

| Rota | Handler | Uso |
| --- | --- | --- |
| `GET /api/v1/maps/tiles` | `GenerateTiles` | Pede à REST API do GEE a URL do tile |
| `POST /api/v1/maps/zonal` | `ZonalStats` | Estatística zonal (ex.: NDVI por talhão) |
| `GET /api/v1/admin/maps/diagnostics` | `DiagnosticsHandler` | Diagnóstico (admin) |

O handler tem **rate limiting próprio** (`SetRateLimiter` / `permitir`,
testado em `map_handler_ratelimit_test.go`): chamada ao GEE é cara e cotada.

Os arquivos `ast_ndvi.json` e `ast_rgb.json` na raiz do repositório são ASTs
de expressão do Earth Engine — material de trabalho, candidatos naturais a
`RAW/`.

## Por que isso importa para o domínio

NDVI por talhão dá evidência independente do que o produtor declarou na
[[caderneta-de-campo]] — vigor de cultura observado por satélite versus
manejo registrado.
