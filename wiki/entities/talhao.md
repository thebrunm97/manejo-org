# Talhão

Unidade de manejo georreferenciada dentro de uma [[propriedade]]. É a peça
que aparece desenhada no mapa.

## `public.talhoes`

`supabase/migrations/20260402000000_create_core_app_tables.sql:50`

| Grupo | Colunas |
| --- | --- |
| Identidade | `id` BIGINT PK, `nome`, `active`, `tipo` (default `produtivo`) |
| Vínculo | `propriedade_id`, `pmo_id`, `user_id` |
| Geografia | `geometry` JSONB (GeoJSON), `area_ha`, `area_total_m2` |
| Visual | `cor`, `cor_identificacao`, `fill_color`, `border_color` |
| Regime | `modalidade_producao`, `status_certificacao` (default `Certificado`), `cultura` |
| Solo | `ph_solo`, `ph_agua`, `v_percent`, `materia_organica`, `fosforo`, `potassio`, `teor_argila`, `silte`, `areia` |

RLS: `USING (user_id = auth.uid())`.

> `geometry` é **JSONB**, não `geometry` do PostGIS. O cálculo de área é
> feito no cliente com `@turf/area`. Consequência: não há índice espacial nem
> consulta geográfica no banco.
> `20260428_fix_talhoes_geometry_null.sql` trata talhões sem geometria.

## Relações

- 1:N [[canteiro]].
- 1:N [[registro-de-caderno]] (`caderno_campo.talhao_id`).
- Recebe rateio de [[transacao-financeira]] (`transacao_alocacoes.talhao_id`).

## Onde é manipulado

`pmo-frontend/src/services/talhaoService.ts`, tela `/mapa`
(`MapaPropriedade.tsx`) e o desenho em `components/Map/MapDrawControl.tsx`.
Ver [[mapa-e-geoprocessamento]].
