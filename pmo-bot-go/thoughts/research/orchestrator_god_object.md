# Pesquisa e Análise do `orchestrator.go`

## 1. Mapeamento das Responsabilidades Atuais (`ExecuteAgenticLoop`)

O método `ExecuteAgenticLoop` (linhas 58 a 588) tornou-se um clássico "God Object" por assumir simultaneamente o papel de controlador de fluxo, construtor de prompts, roteador de provedores LLM, interceptador de regras de negócio, e executor de ferramentas.

**Principais responsabilidades encontradas:**
1. **Engenharia de Prompts (Context Injection):** Concatenação manual do contexto da fazenda e das regras absolutas do sistema.
2. **Ciclo de Vida do LLM (Loop & Fallbacks):** Gerenciamento de turnos (máx 3), injeção de timeouts por turno e repetição de instruções de resumo.
3. **Governança de Saída (Output Guardrails):** Sanitização bruta de JSON vazado no texto e invocação do `OutputJudge`.
4. **Mutação e Injeção em Ferramentas:** Modificação direta nos argumentos (ex: injeção de `user_id` e _hardcodes_ como o fallback para `ConsultarLeiOrganica_RAG`).
5. **Human-in-the-Loop (HITL):** Lógica complexa de *fingerprint* e geração de resultados sintéticos para aprovação.
6. **Business Guardrails (Validação Determinística):** Um gigantesco bloco `switch` validando as permissões agronômicas antes de chamar as ferramentas.
7. **Execução Final (MCP):** A chamada efetiva para o servidor MCP agnóstico.

## 2. Linhas Exatas dos Eventos

### a) Construção do Prompt
- **Contexto da Fazenda:** Linhas 60-77 (constroi o `farmContext` iterando os talhões).
- **Tool Call Guardrail:** Linhas 80-83 (injeta a regra de formatação para evitar vazamento de JSON).
- **Summary Injection (Multi-turn):** Linhas 150-172 (injeta regras de resumo no histórico).

### b) Interceptação de Validações e HITL
- **Tool JSON Sanitization:** Linhas 216-220 (chama `sanitizeResponse`).
- **Output Judge:** Linhas 222-258 (avalia violações e constroi mensagem de bloqueio amigável).
- **HITL (Human-in-the-Loop):** Linhas 298-376 (calcula hash, dedup, pede aprovação e cria _synthetic response_).
- **Business Guardrails:** Linhas 378-539. É aqui que o código mais sofre com o acoplamento, havendo um `switch tc.Nome` (linha 389) mapeando _hardcoded_ ferramentas como `registrar_compra_insumo`, `registrar_venda`, `registrar_limpeza`, etc.

### c) Execução de Ferramentas via MCP
- **MCP Call:** Linha 542 (`result, err := o.MCP.CallToolWithGuard(guard, tc.Nome, args)`).

## 3. Avaliação de Viabilidade e "Code Smells"

### Code Smells (Maus Cheiros) Identificados:
1. **Divergent Change / Acoplamento Forte:** O `orchestrator.go` conhece o schema interno das ferramentas MCP (o `switch tc.Nome`). Se adicionarmos uma nova ferramenta agronômica, precisamos mexer no core do orquestrador.
2. **Magic Strings:** Mapeamento explícito de `intent` de roteamento (ex: verificando se o prompt tem a string "FINANCE" para ativar o Judge).
3. **Falta de Abstração no Fluxo de Ferramentas:** A sequência de Contexto -> HITL -> Business Rule -> Execução não é uma esteira (pipeline), mas sim um aninhamento imperativo.

### Viabilidade da Refatoração:
É **altamente viável e necessário** extrair essas lógicas.

**Proposta 1: `PromptManager` (ou Strategy Pattern para o LLM)**
Toda a lógica de `farmContext` e injeção do `toolCallGuardrail` deve sair do Orquestrador e ir para uma camada dedicada (ex: `internal/state/prompt_manager.go`).

**Proposta 2: `InterceptorChain` (Chain of Responsibility / Middleware)**
O loop iterando sobre `resp.ToolCalls` (linha 263 em diante) deve usar um padrão de _Middleware_ para as chamadas de ferramentas.
Uma interface simples:
`type ToolInterceptor func(ctx context.Context, req ToolRequest, next ToolHandler) (ToolResponse, error)`

Teríamos os seguintes interceptors injetados na construção do Orquestrador:
1. `ContextInjectorMiddleware` (injeta IDs internos).
2. `HITLMiddleware` (retorna erro sintético caso precise de aprovação).
3. `BusinessGuardrailMiddleware` (remove o `switch` daqui e joga para o pacote `guardrails`, delegando a validação para o domínio).
4. O `Next` final seria o próprio `MCP.CallToolWithGuard`.

Isso blindaria o Orquestrador para ser 100% OCP (Open-Closed Principle): só controlaria o vai-e-vem do LLM, delegando o conteúdo para as bordas.
