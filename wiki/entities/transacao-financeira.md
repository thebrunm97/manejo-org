# Transação financeira

Receita ou despesa da [[propriedade]], com rateio por [[talhao]] ou por
[[registro-de-caderno]] — é o que permite calcular custo por área e margem
por cultura.

## `public.transacoes_financeiras`

`supabase/migrations/20260402120000_create_operational_tables.sql`

| Coluna | Papel |
| --- | --- |
| `id` UUID PK | Identidade |
| `propriedade_id` (NOT NULL), `pmo_id`, `user_id` | Vínculo |
| `categoria_id` | FK para `categorias_financeiras` |
| `tipo` | CHECK `receita` \| `despesa` |
| `valor_total`, `data_competencia`, `data_transacao` | Valores e datas |
| `fornecedor_cliente`, `fornecedor`, `nota_fiscal`, `status_pagamento` | Documento |
| `raw_payload_id` | Procedência (mensagem que originou o lançamento) |

## `public.transacao_alocacoes`

Rateio: `transacao_id` + (`talhao_id` \| `caderno_campo_id`) +
`valor_alocado` / `percentual_alocado`. Uma nota de adubo pode ser dividida
entre vários talhões.

## Atenção: divergência de CHECK

Duas migrations declaram a mesma tabela. `20260402120000` (que roda antes)
define `tipo IN ('receita','despesa')` em minúsculas;
`20260525_create_financial_ledger.sql` declara
`tipo IN ('RECEITA','DESPESA')`. Como a segunda usa
`CREATE TABLE IF NOT EXISTS`, ela **não** se aplica em banco já migrado —
a constraint efetiva é a minúscula. Confirme o caso antes de escrever
qualquer código que insira `tipo`.

## Escrita

RPC `rpc_registrar_transacao_com_rateio` (chamada pelo [[pmo-bot-go]]) e
`20260526_create_financeiro_transactions_rpc.sql`. No PWA:
`services/financeiroService.ts`, rota `/financeiro`.

## Fontes

- `docs/PLAN-fase-2-financeiro.md`, `docs/raw/RESEARCH_FINANCEIRO.md`
