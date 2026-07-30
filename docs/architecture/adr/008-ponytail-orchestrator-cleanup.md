# 008 - Ponytail Orchestrator Cleanup

## Contexto
Durante o desenvolvimento das capacidades agenticas e pipelines de orquestração do PMO Bot (em especial a Máquina de Estados e o despachante de requisições de LLM via `orchestrator.go`), algumas abstrações genéricas foram incluídas visando futura extensibilidade. 

Entre essas abstrações genéricas estavam:
1. Uma interface `InterceptorChain` no pacote `state` usada para encadear lógicas de middleware (`ContextInjector`, `HITL` e `BusinessGuardrail`), as quais são sempre estáticas.
2. Atribuições verbosas via dependências globais em *handlers* especializados que eram injetadas repetidamente em instâncias da FSM.
3. Função manual de criação de fingerprint criptográfico para evitar duplicações (`hitlFingerprint`), implementando ordenação de chaves que já existe no `json.Marshal` da stdlib (Go >= 1.8).

Esses fatores criaram *boilerplate*, indirection excessivo e complexidade acidental. Seguindo a regra do desenvolvedor "lazy senior" (Ponytail) onde "o melhor código é o código que não precisou ser escrito", conduzimos uma limpeza da Fase 1 no núcleo do orquestrador.

## Decisão
Decidimos remover o over-engineering substituindo padrões genéricos e abstratos por funções diretas:

- **Substituição do `InterceptorChain`**: Removemos as interfaces de Chain e Middleware em `tool_pipeline.go`. Agora, o `orchestrator.go` injeta contexto e invoca os guardrails via chamadas de funções sequenciais, o que diminui a alocação de memória e permite um *stack trace* direto caso haja problemas.
- **Normalização por Standard Library**: Removemos a lógica arbitrária de sort no `hitlFingerprint`, delegando-a para a ordenação lexicográfica nativa e automática do `encoding/json`.
- **Injeção de Globais Simplificada**: Encapsulamos a injeção das dependências ativas (*ActiveOutputJudge*, *ActiveHITLController*, *ActiveBusinessEvaluator*) como valores *default* diretamente no construtor genérico `NewOrchestrator`, limpando código do `specialized_handlers.go`.

## Consequências
- **Positivas**:
  - Código fonte consideravelmente mais curto.
  - Stack trace simplificado no pipeline de despache e interceptação de Tools (LLM).
  - Configuração da FSM e do orquestrador simplificada.
- **Negativas**:
  - Acoplamento estático no construtor principal em relação ao pacote (as globais), o que é aceitável dado o escopo atual (onde as instâncias do bot não rodam isoladas destas configurações na infraestrutura serverless/long-polling).
  - Remoção de interface de Middleware implica que a inserção de novos validadores exigirá a adição manual de novas chamadas procedurais no `orchestrator.go`. (Isto reflete nossa intenção: menos plugins abstratos, mais pragmatismo explícito).
