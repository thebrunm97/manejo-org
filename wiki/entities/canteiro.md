# Canteiro

Subdivisão operacional de um [[talhao]] — o nível em que a olericultura
orgânica realmente opera (canteiro, estufa, bancada).

## `public.canteiros`

`supabase/migrations/20260402000000_create_core_app_tables.sql:87`

| Coluna | Papel |
| --- | --- |
| `id` UUID PK | Identidade |
| `talhao_id` | Pai, `ON DELETE CASCADE` |
| `nome`, `tipo` (`Canteiro`), `tipo_estrutura` (`canteiro`) | Classificação |
| `comprimento_metros`, `largura_metros`, `profundidade_metros`, `volume_m3`, `area_total_m2`, `quantidade` | Dimensões |
| `grid_x`, `grid_y` | Posição na grade visual |
| `status` | default `livre` |

RLS **indireta**: acesso concedido se o `talhao_id` pertence a um talhão do
usuário. O canteiro não guarda `user_id` próprio.

## Relações

- 1:N [[ciclo-de-cultivo]].
- N:N [[registro-de-caderno]] via `caderno_campo_canteiros`.

## Dívida conhecida

O DDL original de `caderno_campo_canteiros` (linha 215 da mesma migration)
foi criado com as colunas de [[lote-de-rastreabilidade]] em vez das colunas
de junção. A coluna `canteiro_id` e sua FK só chegaram depois, em
`20260817214500_fix_caderno_canteiros_fk.sql` — cujo próprio comentário
declara *schema drift*. O frontend já assume o nome da FK corrigida
(`caderno_campo_canteiros_canteiro_id_fkey`) em
`pmo-frontend/src/services/cadernoService.ts:14`. As colunas órfãs do DDL original continuam na tabela.
