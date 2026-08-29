# Plan: Integração RPI (Harness, Loop, Graph)

## Overview
Integração do framework RPI (Research, Plan, Implement) e os conceitos de Harness, Loop e Graph Engineering na infraestrutura de IA do projeto (pasta `.agent`). O objetivo é evoluir o comportamento da IA para um modelo **Goal-Based Loop (Nível 2)**, garantindo desenvolvimento orientado a especificações (Spec-Driven Development) e minimizando erros compostos através de memória de estado (`estado_tarefa.md`).

## Project Type
**BACKEND / AI HARNESS**

## Success Criteria
- [ ] IA restrita a apenas planejar na Fase 1 e Fase 2.
- [ ] Fase 2 sempre exige criação de testes (TDD) como condição de parada.
- [ ] O Loop de execução (Fase 3) é autônomo, corrigindo erros baseados no `estado_tarefa.md` e parando apenas quando 100% dos testes passam.
- [ ] Workflow `/orchestrate` delega "mini loops" paralelos a agentes especialistas.

## Tech Stack
- Markdown (para regras de Agentes/Skills)
- Python (scripts do checklist/verificadores)

## File Structure
```text
.agent/
├── rules/
│   └── GEMINI.md            (Atualizar Harness RPI)
├── skills/
│   ├── brainstorming/
│   │   └── SKILL.md         (Atualizar Socratic Gate e Loop Engine)
│   └── intelligent-routing/
│       └── SKILL.md         (Atualizar nó central do Graph)
└── workflows/
    └── orchestrate.md       (Atualizar workflow de paralelismo)
```

## Task Breakdown

### Task 1: RPI Harness Foundation (GEMINI.md)
- **Agent:** `orchestrator` / `backend-specialist`
- **Skills:** `plan-writing`
- **Priority:** P0
- **Dependencies:** None
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* `.agent/rules/GEMINI.md`
  - *Output:* Arquivo atualizado com Fase 1 (Research sem código) e Fase 2 (Plan focado em TDD) bem definidas.
  - *Verify:* O arquivo `GEMINI.md` dita as restrições explicitamente.

### Task 2: Implement Loop Engineering (estado_tarefa.md)
- **Agent:** `orchestrator`
- **Skills:** `brainstorming`, `behavioral-modes`
- **Priority:** P1
- **Dependencies:** Task 1
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* `.agent/skills/brainstorming/SKILL.md`
  - *Output:* Adicionar regras do Loop Autônomo (Fase 3) para que a IA não peça ajuda a cada erro de linter/teste, mas use e atualize `estado_tarefa.md` para auto-correção.
  - *Verify:* Regras de "Condição de Parada" e TDD estão formalizadas no skill.

### Task 3: Graph Engineering (Orchestrator Node)
- **Agent:** `project-planner`
- **Skills:** `parallel-agents`, `intelligent-routing`
- **Priority:** P2
- **Dependencies:** Task 2
- **INPUT → OUTPUT → VERIFY:**
  - *Input:* `.agent/workflows/orchestrate.md` e `.agent/skills/intelligent-routing/SKILL.md`
  - *Output:* Workflows atualizados para que o orchestrator divida tarefas complexas em "mini loops" delegando a agentes especialistas, ao invés de tentar fazer tudo no mesmo contexto.
  - *Verify:* A sintaxe de invocação de subagentes ou paralelismo está documentada no workflow.

## Loop Budget e Condições de Parada

Objetivo: permitir auto-correção sem criar loops infinitos, custo imprevisível ou degradação de contexto.

### Regras
- Cada tarefa executável possui um orçamento máximo de tentativas locais.
- O padrão inicial é:
  - até 3 tentativas para erro de linter;
  - até 2 tentativas para erro de testes;
  - até 1 tentativa para erro de arquitetura ou ambiguidade de requisito.
- Se o mesmo erro ocorrer 2 vezes sem mudança material na hipótese de causa, o agente deve parar e escalonar.
- Se a correção exigir alterar mais de 3 arquivos fora do escopo inicial, o agente deve voltar à fase de planejamento.
- Toda tentativa deve atualizar `estado_tarefa.md`.

### Campos mínimos em `estado_tarefa.md`
- `task_id`
- `objetivo_atual`
- `hipotese_de_falha`
- `evidencia`
- `ultima_acao`
- `resultado`
- `tentativas_restantes`
- `proxima_acao`
- `critério_de_escalonamento`

### Condição de parada
O agente deve parar automaticamente quando:
- o orçamento de tentativas chegar a zero;
- houver conflito entre instruções de arquivos de regra;
- a falha observada indicar requisito ausente ou ambíguo;
- o teste falhar por motivo não relacionado ao diff atual.

## Agent Handoff Contract

Objetivo: garantir que toda delegação entre orchestrator e especialistas tenha entrada, saída e validação explícitas.

### Regra geral
Nenhum agente pode repassar trabalho ao próximo apenas com texto livre. Todo handoff deve seguir contrato estruturado.

### Schema mínimo do handoff
- `task_id`: identificador único
- `agent_owner`: agente responsável atual
- `objective`: objetivo da subtarefa
- `scope`: arquivos e limites de atuação
- `inputs`: artefatos e contexto recebidos
- `constraints`: regras obrigatórias (TDD, sem mudar JS/TS, sem tocar produção, etc.)
- `expected_output`: formato de saída esperado
- `verification`: como validar a entrega
- `status`: `ready`, `blocked`, `done`
- `blockers`: impedimentos concretos
- `evidence`: testes, diff, logs ou trechos relevantes

### Regras de fronteira
- O agente receptor deve validar o handoff antes de executar.
- Se o schema vier incompleto, o receptor não executa; devolve `blocked`.
- Nenhum handoff pode perder restrições globais definidas em `GEMINI.md`.
- Toda saída de especialista deve incluir evidência verificável e recomendação do próximo passo.

### Regra de rastreabilidade
Cada subtarefa deve permitir responder:
- quem executou;
- com qual objetivo;
- em quais arquivos;
- com qual evidência;
- por que foi considerada concluída.

## Quando Não Usar Multiagente

Objetivo: evitar sobreengenharia de orquestração em tarefas que um único agente pode resolver melhor.

### Use agente único quando
- a tarefa for curta e sequencial;
- o contexto principal couber confortavelmente em uma única linha de raciocínio;
- a maior dificuldade for interpretação de requisito, e não divisão de trabalho;
- o custo de handoff for maior que o benefício da especialização;
- houver alto acoplamento entre arquivos e decisões.

### Use orchestrator + especialistas quando
- a tarefa puder ser dividida em subtarefas com contratos claros;
- houver validações independentes entre etapas;
- especialistas distintos trouxerem ganho real de qualidade;
- o trabalho puder ocorrer em mini-loops parcialmente isolados;
- houver necessidade de comparar abordagens em paralelo.

### Regra de decisão
O default do sistema é começar simples.
Multiagente só deve ser ativado quando houver evidência de que:
1. a tarefa é decomponível;
2. o handoff pode ser especificado;
3. a verificação por subtarefa é objetiva.

## Gate de Paralelização

Antes de delegar para múltiplos agentes, o orchestrator deve responder explicitamente:

- A tarefa pode ser quebrada sem dependência circular forte?
- Cada subtarefa possui output verificável?
- O custo de reconciliação é menor que o ganho esperado?
- Existe risco de dois agentes editarem a mesma fonte conceitual?
- Há um plano claro de merge/síntese?

Se qualquer resposta crítica for "não", usar fluxo sequencial.

## Retorno Obrigatório ao Planejamento

O sistema deve retornar da execução para a fase de planejamento quando ocorrer qualquer uma das situações abaixo:
- falha repetida sem nova hipótese de causa;
- necessidade de alterar escopo original;
- conflito entre restrições globais e solução local;
- dependência não prevista;
- teste indicando falha arquitetural, não sintática.

Nesse caso, o agente deve:
1. atualizar `estado_tarefa.md`;
2. registrar a causa do retorno;
3. propor plano revisado antes de qualquer novo diff.

## Critérios de Saída por Fase

### Fase 1 — Research
Só conclui quando:
- restrições foram extraídas;
- arquivos-fonte relevantes foram identificados;
- riscos e anti-padrões foram listados;
- nenhuma alteração de código foi feita.

### Fase 2 — Plan
Só conclui quando:
- existe plano em passos verificáveis;
- há estratégia de TDD explícita;
- escopo e não-escopo foram definidos;
- critérios objetivos de sucesso foram escritos.

### Fase 3 — Execute
Só conclui quando:
- mudanças seguem o plano ou revisão aprovada;
- testes/linter relevantes passaram;
- `estado_tarefa.md` foi atualizado;
- evidência foi registrada.

### Fase 4 — Verify
Só conclui quando:
- o resultado atende ao objetivo original;
- não houve violação de regras globais;
- o diff final está dentro do escopo;
- há justificativa para próximos passos, se existirem.

## Phase X: Verification
- [ ] `GEMINI.md` revisado visualmente (sem código que quebre os parsers)
- [ ] Executar mock task para validar que a IA exige TDD e usa `estado_tarefa.md`
- [ ] Regras anti-padrão (Socratic Gate) respeitadas
- [ ] Nenhum arquivo `.ts` ou `.js` alterado neste processo (apenas markdown).
