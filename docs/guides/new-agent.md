# 🤖 Guia: Como Adicionar um Novo Agente ou Intenção

O ManejoORG é extensível. Caso precise adicionar uma nova funcionalidade de IA (ex: Agente de Logística, Previsão de Pragas), siga este roteiro.

---

## 1. Caso de Uso: Novo Agente Especializado
Exemplo: Adicionar um **Agente de Vendas** para ajudar na precificação.

### Passo 1: Criar o Prompt System
Crie `internal/gemini/prompts/sales_agent.md` com as regras de comportamento e ferramentas permitidas.

### Passo 2: Registrar no Router
No arquivo `internal/gemini/router.go`, adicione a nova intenção à lógica de classificação:
```go
// Exemplo
const IntentSales = "SALES"
// No prompt do Router (inline), adicione a descrição do novo intent.
```

### Passo 3: Configurar as Ferramentas (Tools)
No `internal/gemini/client.go`, decida se o novo agente terá acesso a ferramentas do banco:
```go
if intent == IntentSales {
    // Configura tools de consulta de mercado e estoque
}
```

---

## 2. Caso de Uso: Novo Estado na FSM
Exemplo: Fluxo de **Confirmar Recebimento de Adubo**.

### Passo 1: Definir o Estado
Em `internal/state/fsm.go`:
```go
const StateAguardandoRecebimento = "aguardando_recebimento"
```

### Passo 2: Implementar o Choke Point
No `ProcessMessage`, detecte quando o bot deve entrar nesse estado:
```go
if msg.Contem"recebi" {
    historyManager.SetFSMState(phone, StateAguardandoRecebimento, context)
    return "Qual o lote do produto recebido?"
}
```

### Passo 3: Implementar o Handler de Resposta
Crie a função `handleAguardandoRecebimento` para processar a próxima mensagem do usuário.

---

## 3. Dicas de Ouro
- **Testes de Prompt:** Use o Playground do Google AI Studio para testar seus prompts `.md` antes de implementar no código.
- **LoopGuard:** Se o seu novo agente precisar chamar várias ferramentas em sequência, certifique-se de que ele não caia no limite de 5 iterações do `LoopGuard`.
- **Small Context:** Mantenha os prompts curtos e focados. Agentes especialistas funcionam melhor que agentes "faz-tudo".
