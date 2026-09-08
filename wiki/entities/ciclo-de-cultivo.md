# Ciclo de cultivo

Ocupação de um [[canteiro]] por uma cultura, do plantio ao encerramento.
É o que responde "o que está plantado aqui agora?".

## `public.ciclos_cultivo`

`supabase/migrations/20260402000000_create_core_app_tables.sql:114`

| Coluna | Papel |
| --- | --- |
| `id` UUID PK | Identidade |
| `canteiro_id` | Pai, `ON DELETE CASCADE` |
| `produto`, `variedade` | O que foi plantado |
| `data_plantio`, `data_colheita_prevista`, `data_encerramento` | Janela |
| `ativo` | Ciclo corrente |
| `pmo_id` | Vínculo com o [[pmo]] declarado |

RLS em dois saltos: `canteiro → talhao → user_id`.

## Papel no produto

Alimenta a tela `/culturas` (`MinhasCulturas.tsx`) e o cronograma
(`cronograma_plantio`). Um ciclo ativo é o contexto que dá sentido a um
[[registro-de-caderno]] de manejo ou colheita.
