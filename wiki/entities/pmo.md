# PMO (entidade)

Materialização em banco do [[plano-de-manejo-organico]]. É uma tabela-cabeça
com nove tabelas-filhas, uma por seção do formulário oficial.

## `public.pmos`

`supabase/migrations/20260402000000_create_core_app_tables.sql:30`

| Coluna | Papel |
| --- | --- |
| `id` BIGINT PK | Identidade |
| `nome_identificador`, `status`, `version` | Controle documental |
| `form_data` JSONB | Payload completo do formulário |
| `user_id`, `propriedade_id` | Vínculo ([[produtor]], [[propriedade]]) |
| `cultura`, `produtividade_kg_ha` | NOT NULL — usados pelo motor agronômico |

RLS: `USING (user_id = auth.uid())`.

> Modelagem híbrida: `form_data` guarda o formulário inteiro em JSONB **e**
> as tabelas-filhas guardam o mesmo conteúdo normalizado. Ao alterar uma
> seção, verifique se as duas representações estão sendo mantidas em sincronia.

## Tabelas-filhas

`pmo_culturas`, `pmo_manejo`, `pmo_pragas`, `pmo_equipamentos`,
`pmo_insumos`, `pmo_propagacao`, `pmo_limpeza`, `pmo_clima` — todas com
`pmo_id ... ON DELETE CASCADE`. Some-se `culturas_anuais` (área por safra).

`pmo_limpeza` é especial: além de seção do plano, é **fonte de leitura da
caderneta** — `cadernoService.getRegistros` faz merge de `caderno_campo` com
`pmo_limpeza`, apresentando registros de limpeza como atividade do tipo
`Limpeza`.

## Relações

- 1:N [[talhao]], [[registro-de-caderno]], [[ciclo-de-cultivo]],
  [[transacao-financeira]].
- `profiles.pmo_ativo_id` aponta para o PMO em foco.

## Onde é manipulado

`pmo-frontend/src/services/pmoService.ts`,
`pmo-frontend/src/domain/pmo/pmoTypes.ts`, páginas `PmoFormPage.tsx`,
`PmoDetailPage.tsx`, `PlanosManejoList.tsx` e `PmoParaImpressao.tsx`.
