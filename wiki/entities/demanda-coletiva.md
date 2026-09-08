# Demanda coletiva

Pedido de mercado que nenhum produtor atende sozinho e que a
[[organizacao]] rateia entre membros. É o mecanismo de comercialização
coletiva do produto.

## `public.demandas_coletivas`

`supabase/migrations/20260420_create_demandas_coletivas.sql`

| Coluna | Papel |
| --- | --- |
| `id` UUID PK | Identidade |
| `titulo`, `descricao`, `cultura`, `unidade` | Descrição do pedido |
| `quantidade_total` | NOT NULL, CHECK `> 0` |
| `quantidade_assumida` | Soma das cotas assumidas |
| `preco_referencia`, `data_entrega` | Condições |
| `status` | CHECK: `aberta` \| `em_captacao` \| `fechada` \| `cancelada` |
| `modalidade_exigida` | Filtra quem pode assumir — ver [[producao-paralela]] |
| `cooperativa_id` | FK NOT NULL para [[organizacao]] |

## `public.cotas_produtores`

A parcela que cada [[propriedade]] assume: `quantidade_assumida`,
`quantidade_entregue` e `status` (`pendente` → `confirmada` →
`entregue_parcial` / `entregue_total` / `cancelada`).

Um trigger de capacidade física
(`20260421_capacidade_fisica_trigger.sql`) confronta a cota assumida com a
área disponível e a `referencia_agronomica` de produtividade — impedindo que
um produtor prometa mais do que sua área é capaz de produzir.

## Onde aparece

Rotas `/mural` (`MuralDemandas.tsx`) e
`/coop/organizacao/:slug/demandas`. Refatoração em
`20260502_refatoracao_demandas.sql`.
