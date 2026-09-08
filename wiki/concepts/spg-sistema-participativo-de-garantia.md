# SPG — Sistema Participativo de Garantia

Mecanismo de certificação em que a garantia da conformidade é construída
coletivamente por produtores, técnicos e consumidores organizados em uma
OPAC (Organismo Participativo de Avaliação da Conformidade), com
**responsabilidade solidária**: a irregularidade de um membro compromete o
grupo inteiro.

É um dos três mecanismos descritos em [[certificacao-organica]].

## Consequência para o sistema

O SPG exige que o dado saia do escopo individual e seja visível ao grupo —
o oposto do isolamento por RLS que protege o produtor. O Manejo.ORG resolve
isso com uma camada de multi-tenancy: [[organizacao]] agrupa propriedades via
`organizacao_membros`, e políticas RLS específicas permitem que gestores da
organização enxerguem os dados agregados dos membros.

O tipo da organização é restrito por `CHECK` a `cooperativa`, `associacao`,
`spg` ou `grupo_informal`
(`supabase/migrations/20260422_create_organizacoes.sql`).

## Onde isso aparece no produto

- Rotas `/coop/organizacoes`, `/coop/organizacao/:slug`,
  `/coop/organizacao/:slug/dashboard` e `/coop/organizacao/:slug/demandas`
  em `pmo-frontend/src/App.tsx`, protegidas pelo `GestaoRoute`.
- Serviços `organizacaoService.ts` e `coopDashboardService.ts`.
- Feira/mercado coletivo via [[demanda-coletiva]].

## Fontes

- `docs/knowledge_base/11IN_19_28052009_MECANISMOS.pdf`
- `docs/raw/RESEARCH_COOP_DASHBOARD.md`
