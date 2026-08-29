# PLANO DE IMPLEMENTAÇÃO: GUARDRAILS (AVALIADOR GLOBAL DETERMINÍSTICO)

Este plano descreve o mapeamento arquitetural, o design e o roteiro de integração do novo módulo de **Guardrails Determinísticos** para o `pmo-bot-go`. 
O objetivo deste componente é analisar as intenções e payloads estruturados gerados pela LLM (ou preenchidos deterministicamente em entrevistas) antes da chamada de qualquer RPC no Supabase, agindo como um "Fail-Safe" de segurança de dados e conformidade agrícola.

---

## 1. Mapeamento do Fluxo Atual (Trace)

Atualmente, existem dois caminhos que geram alterações (escritas) no banco de dados e que precisam ser interceptados antes de chamarem as RPCs do Supabase:

### A. Fluxo Agêntico (Orchestrator Loop)
1. O webhook de entrada (`handler.go`) recebe uma mensagem e gera o `raw_payload_id` (se for inserido com sucesso na tabela `raw_payloads`).
2. A máquina de estados (`fsm.go`) chama `handleDuvidaFallback` para realizar o processamento agêntico.
3. O `Orchestrator` (`orchestrator.go`) executa `ExecuteAgenticLoop` onde o LLM decide chamar ferramentas de escrita (ex: `registrar_compra_insumo`, `registrar_operacao_campo`).
4. O `Orchestrator` injeta metadados contextuais (`user_id`, `pmo_id`, `propriedade_id`, `raw_payload_id`) no mapa de argumentos (`args`).
5. O `Orchestrator` executa a chamada à ferramenta via `o.MCP.CallToolWithGuard(...)`.
6. A ferramenta MCP é despachada para o handler correspondente em `tools_manejo.go`, que finalmente invoca as funções RPC do Supabase (`s.supabase.RegistrarCompraInsumoRPC`, `s.supabase.RegistrarOperacaoCampoRPC`, etc.).

> **Ponto de Interceptação A:** No `ExecuteAgenticLoop` (`orchestrator.go`), imediatamente antes da linha `result, err := o.MCP.CallToolWithGuard(guard, tc.Nome, args)`. 

### B. Fluxo Determinístico (FSM Interview Turn-2)
1. Se no turno 1 a LLM detectou que faltavam informações obrigatórias (ex: quantidade), ela salvou o estado na FSM (`StateAguardandoQuantidade` ou `StateAguardandoCompra`).
2. No turno 2, o usuário responde à FSM (ex: enviando apenas o fornecedor ou a quantidade).
3. O handler de turn-2 correspondente (ex: `handleAguardandoQuantidade` em `handlers_manejo.go`) lê o input e invoca a função `finalizeRegistration(...)`.
4. A função `finalizeRegistration` monta os argumentos e executa diretamente as chamadas RPC no Supabase Client:
   `sbClient.RegistrarCompraInsumoRPC(...)` ou `sbClient.RegistrarOperacaoCampoRPC(...)`.

> **Ponto de Interceptação B:** Na função `finalizeRegistration` (`handlers_manejo.go`) e `handleRegistroFinanceiro` (`handlers_financeiro.go`), imediatamente antes de executar as funções RPC no `sbClient`.

---

## 2. Proposta de Arquitetura do Pacote `internal/guardrails`

A arquitetura estende o pacote `internal/guardrails` existente (que hoje trata de PII, Prompt Injection e RAG Output Judge) adicionando os **Guardrails de Negócios e Limites**.

### Interface e Structs (`internal/guardrails/business.go`)

Propomos a criação de tipos fortemente tipados para evitar o uso de interfaces genéricas de baixo nível:

```go
package guardrails

import "context"

// EvaluationContext encapsula os metadados contextuais do produtor e da fazenda
type EvaluationContext struct {
	PmoID         int64
	PropriedadeID int64
	UserID        string
}

// TransactionPayload representa os dados financeiros de compras, despesas ou receitas
type TransactionPayload struct {
	ValorTotal float64
	Produto    string
	Talhoes    []string // IDs ou nomes de talhões alocados
}

// ManejoPayload representa as operações agrícolas realizadas no campo
type ManejoPayload struct {
	Quantidade    float64
	Unidade       string
	Produto       string
	TalhaoNome    string
	TipoAtividade string
}

// BusinessEvaluator define o contrato determinístico para validação pré-escrita no banco
type BusinessEvaluator interface {
	EvaluateTransaction(ctx context.Context, evalCtx EvaluationContext, payload TransactionPayload) error
	EvaluateManejo(ctx context.Context, evalCtx EvaluationContext, payload ManejoPayload) error
}
```

### Implementação Concreta: `DeterministicEvaluator` com Fallback Pattern

A struct `DeterministicEvaluator` implementará a interface `BusinessEvaluator` aplicando as regras de negócio acordadas:

```go
package guardrails

// Limites padrão compilados no código (Defaults)
const (
	DefaultLimiteTransacao = 50000.00 // R$ 50.000,00
	DefaultLimiteManejo    = 5000.00  // 5.000 kg ou Litros
)

type DeterministicEvaluator struct {
	dbClient dbClientInterface // interface mockable para consultar overrides no Supabase
}
```

#### Regras de Negócio Implementadas:
1. **Regras de Parametrização (Fallback Pattern):**
   * Ao receber um payload, o avaliador consultará a tabela `limites_seguranca` no Supabase utilizando o par `(propriedade_id, pmo_id)`.
   * Se existir um registro customizado (**Override**), usa-se esse limite específico.
   * Se não existir ou o banco de dados falhar (ex: timeout, erro de rede), o avaliador aplica de forma segura o valor **Default** em Go (Fail-Safe).
2. **UX e Feedback Dinâmico:**
   * Caso o limite seja violado, o avaliador retornará um erro customizado estruturado contendo a mensagem exata de erro em português que será enviada ao produtor.
     * Exemplo: *"Atenção: A quantidade de 10.000 kg excede o limite de segurança de 5.000 kg configurado para a sua propriedade. Por favor, reenvie a operação com o valor correto."*
3. **Regras de Talhão (Obrigatoriedade Contextual):**
   * **Manejo de Campo:** O campo `talhao_nome` (ou similar) é **estritamente obrigatório**. Se nulo ou vazio, o Guardrail reprova imediatamente a transação com um erro de talhão ausente.
   * **Transações Financeiras (Compras/Vendas):** O campo de talhão é **opcional**, permitindo alocações gerais na propriedade (ex: compras para o estoque/armazém central).

---

## 3. Design do Tratamento de Rejeição (Fail-Safe)

Se o `BusinessEvaluator` retornar um erro (ou seja, o payload for reprovado):

1. **Aborto da RPC:** A execução da chamada RPC correspondente no Supabase Client será imediatamente abortada.
2. **Atualização do Status `raw_payloads`:** A tabela `raw_payloads` no Supabase será atualizada utilizando a função existente:
   ```go
   _ = sbClient.UpdateRawPayloadStatus(ctx, rawPayloadID, "FAILED", err.Error())
   ```
   * O status será alterado para `'FAILED'`.
   * A mensagem descritiva de erro do Guardrail será gravada na coluna `processing_error`.
3. **Reset da Máquina de Estados (FSM):** Para manter o bot em estado previsível, limpa-se o estado ativo de turnos do produtor no gerenciador de histórico:
   ```go
   if historyManager != nil {
       historyManager.ClearFSMState(phone)
   }
   ```
   Isso move a FSM de volta ao estado inicial (`IDLE`), forçando o usuário a re-enviar uma mensagem completa caso queira corrigir o valor.
4. **Mensagem Limpa ao Produtor:** A mensagem amigável contida no erro do Guardrail será retornada no canal do WhatsApp.

---

## 4. Estrutura de Arquivos Proposta

```
pmo-bot-go/
└── internal/
    └── guardrails/
        ├── types.go               # Interfaces genéricas de input/output (existente)
        ├── hitl.go                # Logica de Human-in-the-Loop (existente)
        ├── business.go            # [NOVO] Interface, Structs e Lógica do Avaliador Determinístico
        └── business_test.go       # [NOVO] Testes Unitários de Limites, Talhão e Fallbacks
```

---

## 5. Roteiro de Injeção no Código Atual

### Passo 1: Injeção de Dependência
Adicionar o `BusinessEvaluator` na configuração global do webhook handler (`Config` em `handler.go`) e propagar para o `Orchestrator` e handlers de estado:
```diff
// pmo-bot-go/internal/webhook/handler.go
type Config struct {
    ...
+   BusinessEvaluator guardrails.BusinessEvaluator
}
```

### Passo 2: Interceptação no Loop Agêntico (`internal/state/orchestrator.go`)
Na função `ExecuteAgenticLoop`, no loop de processamento de `resp.ToolCalls`:
```go
// Antes de executar o o.MCP.CallToolWithGuard
if o.BusinessEvaluator != nil {
    // 1. Mapear o tc.Nome e tc.Args para os structs do Guardrail
    // 2. Chamar o.BusinessEvaluator.EvaluateTransaction / EvaluateManejo
    // 3. Se retornar erro:
    //    a. sbClient.UpdateRawPayloadStatus(ctx, rawPayloadID, "FAILED", err.Error())
    //    b. Limpar estado da FSM
    //    c. Retornar a mensagem amigável de erro
}
```

### Passo 3: Interceptação no Fluxo FSM (`internal/state/handlers_manejo.go`)
Na função `finalizeRegistration`:
```go
// Antes de executar sbClient.RegistrarCompraInsumoRPC ou RegistrarOperacaoCampoRPC
if activeBusinessEvaluator != nil {
    // 1. Mapear o struct ExtractionResult para os structs do Guardrail
    // 2. Chamar a avaliação correspondente
    // 3. Se falhar:
    //    a. sbClient.UpdateRawPayloadStatus(ctx, rawPayloadID, "FAILED", err.Error())
    //    b. ClearFSMState(phone)
    //    c. Retornar mensagem limpa de erro
}
```

---

## 6. Registro de Dívida Técnica (Frontend UI)

> [!WARNING]
> **DÍVIDA TÉCNICA - CONFIGURAÇÃO DE LIMITES NO DASHBOARD**
> Atualmente, os limites customizados são lidos dinamicamente da tabela `limites_seguranca` no banco. No entanto, não há interface gráfica para administradores ou proprietários gerenciarem esses limites.
> **Tarefa Pendente:** Criar uma tela/componente no `pmo-frontend` dentro do painel administrativo que permita atualizar os campos `limite_transacao` e `limite_manejo` da tabela `limites_seguranca` associados à propriedade/PMO correspondente.
