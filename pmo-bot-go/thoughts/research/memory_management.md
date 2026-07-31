# Pesquisa: Memory Management (Sliding Window & Sumarização)

## 1. Como o Histórico é Armazenado e Recuperado
Atualmente, o histórico é armazenado **em memória RAM** (com TTL) através do `history.Manager` localizado em `internal/history/manager.go`. O histórico é indexado pelo número de telefone do usuário (`conversations map[string]*Conversation`).

O fluxo de recuperação ocorre da seguinte forma:
- Antes de iniciar o LLM (ex: em `internal/state/specialized_handlers.go`, linha 64), o manipulador chama `h := historyManager.GetHistory(phone)`.
- Isso retorna um array/slice de `llm.MensagemAgnostica`, que é diretamente injetado no payload que vai para o *Orchestrator* (`ExecuteAgenticLoop`).

## 2. Limites (Limit/Offset) Atuais
O projeto aplica um limite **baseado em quantidade fixa de mensagens** (`m.maxMessages`). 
Dentro de `AddMessage` e `AppendAgnosticHistory`, se o tamanho do array exceder o limite, o histórico sofre um *slicing* simples:
```go
if len(conv.Messages) > m.maxMessages {
    conv.Messages = conv.Messages[len(conv.Messages)-m.maxMessages:]
}
```
**Problema:** Esse corte é cego. Ele não considera o tamanho em *tokens* das mensagens. Uma mensagem gigante pode estourar o *Context Window*, enquanto 20 mensagens curtas poderiam caber sem problemas.

## 3. Pruning Semântico (Implementação Existente)
O `manager.go` já possui uma tentativa inicial de otimização em `AppendAgnosticHistory`: ele localiza turnos passados em que **ferramentas foram chamadas** e os substitui por uma única mensagem textual determinística (`[MEMÓRIA DO SISTEMA] Em um turno anterior, o usuário disse...`). 
Contudo, isso não cobre mensagens conversacionais normais (bate-papo sem tools), que continuam acumulando até bater em `maxMessages`.

## 4. Ponto de Injeção do Novo 'MemoryManager'
O ponto ideal para injetar uma verdadeira **Sliding Window com Sumarização** é na fase de Persistência/Atualização (`AppendAgnosticHistory`), ou criando um novo componente `TokenAwareHistoryManager`.
Em vez de usar um corte determinístico por número de mensagens, o gestor deveria:
1. Medir a quantidade de tokens atual da janela de contexto real.
2. Se o limite "soft" for atingido (ex: 80% do window max), extrair os `N` turnos mais antigos (ignorando a *System Prompt* inicial).
3. Invocar um LLM (um modelo menor e barato, ex: *GPT-4o-mini* ou *Gemini 1.5 Flash*) para gerar um resumo curto dessas interações ("O usuário relatou um ataque de pragas, e o bot recomendou o uso de Neem").
4. Substituir esses `N` turnos no array por uma mensagem de `Role: system` ou `Assistant` contendo `[SUMÁRIO DE CONVERSA ANTERIOR]: <resumo>`.
