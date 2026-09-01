# Propriedade

A fazenda. Raiz do isolamento de dados e âncora de quase toda consulta.

## `public.propriedades`

`supabase/migrations/20260402000000_create_core_app_tables.sql:7`

| Coluna | Papel |
| --- | --- |
| `id` BIGINT PK | Identidade |
| `nome`, `cidade`, `uf`, `area_total_ha` | Descrição |
| `user_id` UUID | Dono ([[produtor]]), `ON DELETE CASCADE` |
| `modalidade_predominante` | `ORGANICO` \| `TRANSICAO` \| `CONVENCIONAL` |
| `tem_producao_paralela` | Ver [[producao-paralela]] |
| `car`, `inscricao_estadual`, `matricula`, `endereco_cadastral` | Dados cartoriais/fiscais |

RLS: `USING (user_id = auth.uid())` para todas as operações.

## Relações

- 1:N [[talhao]], [[pmo]], [[registro-de-caderno]], [[transacao-financeira]],
  [[lote-de-rastreabilidade]].
- N:N [[organizacao]] via `organizacao_membros`.

## Ciclo de vida

- **Criação**: onboarding com RPC transacional
  (`20260426_create_onboarding_rpc.sql`; ver também a migration não versionada
  `20260830_create_complete_onboarding_rpc.sql`).
- **Exclusão**: cascata explícita em `20260430_delete_propriedade_cascade.sql`.
- **Seleção**: com mais de uma propriedade, o `RouteGuard` força passagem
  pelo hub (`/hub`) antes de qualquer tela operacional.
