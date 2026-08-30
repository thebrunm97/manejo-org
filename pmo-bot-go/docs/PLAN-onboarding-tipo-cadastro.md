# Planejamento: Cadastro Simples ou Completo no Onboarding

> **STATUS: FECHADO PARA O MVP.** Decisão (2026-08-24): manter só o cadastro
> simples (nome + confirmação, comportamento atual). Não implementar a
> ramificação Simples/Completo agora. Este documento fica registrado para
> retomar depois do MVP — ver "Decisão e Motivo" abaixo antes de reabrir.

## Decisão e Motivo
O fluxo atual (`HandleOnboarding` em `onboarding.go`) já é deliberadamente
minimalista: `StateAguardandoCadastro` pede só o nome, `StateConfirmandoCadastro`
confirma, `finalizarCadastro` cria o profile. Propriedade/hectares/talhão
ficam para uma complementação futura via `setup_initial_profile` — decisão
tomada no DT-58 ("Fatia 2", ver comentário em `onboarding.go:12-19`) para
reduzir atrito no primeiro contato.

Adicionar a pergunta "Simples ou Completo" reintroduziria esse atrito antes
do MVP validar o cadastro básico. Por ora, **não mexer** no fluxo de
onboarding: ele permanece só "simples".

## Overview (mantido para referência futura)
Ideia original: logo após o nome, perguntar se o produtor quer cadastro
**simples** (nome só, como é hoje) ou **completo** (propriedade, hectares,
talhão coletados no ato). Adiado — ver decisão acima.

## 🔴 Portão Socrático (ainda em aberto, retomar quando reabrir)
1. **Definição de Completo:** perguntas uma a uma ou tudo de uma vez?
2. **Copy:** mensagem exata da pergunta Simples/Completo.
3. **Botões:** reply buttons do WhatsApp para as duas opções?

## Correção técnica para quando isto for retomado
O rascunho original apontava a Task 1 para `internal/state/fsm.go` — **isso
está errado**. Os estados de onboarding (`StateAguardandoCadastro`,
`StateConfirmandoCadastro` etc.) são constantes em
`internal/state/onboarding.go:47-58`, não em `fsm.go`. `fsm.go` só contém a
orquestração de `ProcessMessage`. Qualquer novo estado (`StatePerguntaTipoCadastro`)
deve ser adicionado em `onboarding.go`, junto dos demais.

Além disso, "Completo" deveria provavelmente reaproveitar a RPC
`setup_initial_profile` já existente para propriedade/área/talhão, em vez de
criar um novo caminho de gravação do zero — ver `finalizarCadastro` e o
comentário sobre complementação futura no topo do arquivo.

## Project Type
**BACKEND** (Go - WhatsApp Bot)

## Decisão Arquitetural: Modalidade de Cultivo (Orgânico vs Não Orgânico)
*Decisão registrada via Socratic Gate (2026-08-24) com base na Lei nº 10.831/2003, Decreto nº 6.323/2007 e Portaria nº 52/2021 do MAPA.*

A modalidade de manejo não será definida exclusivamente no produtor nem na propriedade. O produtor poderá informar uma preferência inicial no onboarding (Orgânico, Em conversão, Não orgânico, Ainda não sei), mas o status operacional e de conformidade será registrado rigorosamente por **talhão ou área de manejo**. Isso permite a coexistência de áreas orgânicas, em conversão e não orgânicas na mesma unidade de produção, conforme as regras de conversão parcial e produção paralela da legislação brasileira.

O onboarding terá baixa fricção. Na criação do primeiro talhão, o status de manejo será solicitado de forma contextual. O status informado pelo produtor será distinguido do status aprovado ou reconhecido por OAC/OCS.

O status “em conversão” terá histórico temporal e módulo progressivo de compliance (ledger append-only), incluindo:
- Início da conversão e previsão de término
- Tipo de cultura
- Entidade responsável (OAC/OCS)
- Evidências e Plano de Manejo Orgânico

Nenhum talhão será convertido automaticamente em orgânico apenas com base no decurso do tempo (a aprovação OAC/OCS é necessária).

**UX no Frontend:** A interface, o catálogo de insumos e os alertas de restrição serão determinados e validados pelo *status do talhão selecionado*, e não pela preferência geral do produtor. Produtos permitidos/restritos devem exigir justificativa de uso atrelada ao plano de manejo.
