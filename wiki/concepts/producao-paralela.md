# Produção paralela

Situação em que a mesma propriedade produz **orgânico e convencional**
simultaneamente. É permitida sob condições estritas — separação física,
segregação de insumos, equipamentos e registros distintos — porque é o
cenário de maior risco de contaminação e de fraude por mistura de lotes.

## Como o sistema modela

Duas colunas em [[propriedade]]:

- `modalidade_predominante` (`ORGANICO` | `TRANSICAO` | `CONVENCIONAL`)
- `tem_producao_paralela` (boolean)

Cada [[talhao]] carrega sua própria `modalidade_producao`, e cada
[[registro-de-caderno]] carimba a `modalidade_aplicada` do que foi feito —
de modo que a segregação é auditável no nível da operação, não só da fazenda.

## A regra de acesso

`pmo-frontend/src/routes/ModalityGuard.tsx` bloqueia as rotas de PMO
(`/planos`, `/mapa`, `/pmo/*`) quando a propriedade é `CONVENCIONAL` **e não**
tem produção paralela. Admins passam direto. A regra em uma linha:

> acesso liberado se `modalidade != CONVENCIONAL` **ou** `tem_producao_paralela = true`.

Relacionado: [[agricultura-organica]], [[certificacao-organica]].
