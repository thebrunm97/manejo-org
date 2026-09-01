# Organização

Cooperativa, associação, OPAC/SPG ou grupo informal que agrega
[[propriedade]]s. É a camada de multi-tenancy que viabiliza o
[[spg-sistema-participativo-de-garantia]].

## `public.organizacoes`

`supabase/migrations/20260422_create_organizacoes.sql`

| Coluna | Papel |
| --- | --- |
| `id` BIGINT PK | Identidade |
| `nome` | Razão social / nome do grupo |
| `cnpj` | UNIQUE |
| `tipo` | CHECK: `cooperativa` \| `associacao` \| `spg` \| `grupo_informal` |

## `public.organizacao_membros`

Junção N:N com PK composta `(organizacao_id, propriedade_id)`, mais `role`
(default `membro`) e `data_filiacao`. Note que o vínculo é com a
**propriedade**, não com o [[produtor]] — um produtor com duas fazendas pode
ter só uma delas filiada.

## RLS

Membros enxergam a própria organização; gestores enxergam dados agregados
dos membros. As policies foram corrigidas em
`20260427_fix_organizacao_membros_rls.sql` — consulte-a antes de mexer, é o
ponto mais delicado do isolamento de dados do projeto.

## Relações

- 1:N [[demanda-coletiva]] (`demandas_coletivas.cooperativa_id`, NOT NULL).
- Dashboard agregado via `20260501_coop_dashboard_rpc.sql`.
