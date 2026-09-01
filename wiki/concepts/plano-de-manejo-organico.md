# Plano de Manejo Orgânico (PMO)

Documento obrigatório em que o produtor **declara antecipadamente** como vai
produzir: culturas, manejo do solo, controle de pragas, insumos, propagação,
equipamentos, limpeza e higienização, fontes de água e vizinhança.

É a peça central de qualquer processo de [[certificacao-organica]] — e dá
nome ao repositório (`pmo-frontend`, `pmo-bot-go`).

## Plano vs. execução

O PMO é **promessa**; a [[caderneta-de-campo]] é **prova**. A auditoria
compara os dois. Por isso todo [[registro-de-caderno]] carrega `pmo_id`, e a
divergência entre plano e execução é o sinal de não-conformidade que o
sistema precisa tornar visível.

## Estrutura no sistema

A entidade e suas nove tabelas-filhas estão descritas em [[pmo]]. No produto,
o PMO é editado em formulário multi-seção (`/pmo/novo`, `/pmo/:pmoId/editar`)
e tem uma versão para impressão (`PmoParaImpressao.tsx`) que reproduz o
formulário oficial.

O acesso a todas as rotas de PMO passa pelo `ModalityGuard` — ver
[[producao-paralela]].

## Fontes

- `docs/knowledge_base/F.GEC_.052_Plano de Manejo Orgânico_7a. Revisão_08-11-24_0.pdf`
- `pmo-frontend/src/domain/pmo/pmoTypes.ts`
