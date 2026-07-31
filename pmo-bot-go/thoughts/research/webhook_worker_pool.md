# Pesquisa: Arquitetura de Webhook e Desacoplamento Assíncrono (Worker Pool)

## 1. Entrada da Requisição HTTP e Roteamento
A requisição HTTP do webhook da Evolution API (WhatsApp) chega primeiramente no arquivo **`cmd/server/main.go`**, onde as rotas são registradas usando o framework Gin:

```go
// cmd/server/main.go (Linha 308)
handler := webhook.NewHandler(webhook.Config{ ... })
handler.RegisterRoutes(r)
```

O arquivo responsável por lidar com o endpoint é o **`internal/webhook/handler.go`**. A função exata que recebe o JSON, faz o parse do payload e toma as decisões iniciais de negócio (como descarte por idade/duplicação) é a **`handleWebhook`**:

```go
// internal/webhook/handler.go
func (h *Handler) handleWebhook(c *gin.Context) {
    // ... parse evolution.ParseWebhook(rawBody)
    // ... validações
}
```

## 2. Acionamento do Orquestrador (LLM Loop)
Ainda na função `handleWebhook`, o código decide como processar a mensagem. Atualmente, existem duas vias configuráveis via `HARNESS_ENABLED`:
1. **HarnessQueue (Modo Produção/PostgreSQL):** Se habilitado, envia para a fila durável.
2. **Modo Legado:** Chama a função `processLegacy`.

Se olharmos o **`processLegacy`** no arquivo `internal/webhook/handler.go` (linha ~345), vemos exatamente a transição para background e a chamada do Orquestrador:

```go
func (h *Handler) processLegacy(msg ports.IncomingMessage) {
    // Roda em uma goroutine não gerenciada a partir do handleWebhook:
    // go h.processLegacy(*payload)
    
    // Criação de NOVO contexto
    ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
    defer cancel()

    // Aciona a máquina de estados que chama o orquestrador e o LLM
    result := state.ProcessMessage(ctx, msg, ...)
}
```
A função **`state.ProcessMessage`** (localizada em `internal/state/fsm.go`) é a responsável por gerenciar a intenção e invocar indiretamente os *sub-loops* de LLM (como o `ExecuteAgenticLoop`).

## 3. Comportamento do Contexto (`context.Context`)
**A requisição HTTP atual já não prende o contexto ao client.**
Dentro do `handleWebhook`, a requisição original tem o seu contexto em `c.Request.Context()`. Porém, ao delegar o trabalho para `processLegacy` (ou ao PostgreSQL via Harness), o código inteligentemente cria um *novo* contexto usando `context.Background()` com um timeout rígido de 120 segundos.

**Conclusão:** O contexto que desce para o LLM Loop **NÃO** está atrelado ao `http.Request`. Se a requisição HTTP do webhook fechar (retornando o HTTP 200 na linha ~263 do `handleWebhook`), o contexto de execução não morre, permitindo que a IA rode e responda o WhatsApp em background.

## 4. O Problema Atual e Onde Injetar o Worker Pool
Apesar do contexto já estar isolado, o uso indiscriminado de `go h.processLegacy(*payload)` cria uma **goroutine não limitada** ("unbounded") para cada webhook recebido. Sob alta carga (ex: disparo em massa de clientes), isso pode sobrecarregar recursos do sistema ou os rate limits do provedor LLM.

### Inspiração 'Motor Proativo': Proposta de Arquitetura (Go Channels)
Para implementar um Worker Pool eficiente (sem a dependência do PostgreSQL se quisermos algo leve em memória), devemos alterar o `internal/webhook/handler.go`.

**Passo a passo da injeção:**
1. **Estrutura do Handler:** Adicionar um Go Channel bufferizado ao `Config` ou `Handler` em `internal/webhook/handler.go`:
   ```go
   type Handler struct {
       cfg        Config
       limiter    *rate.Limiter
       jobQueue   chan ports.IncomingMessage // Novo Channel!
   }
   ```
2. **Inicialização (Worker Pool):** No `NewHandler`, inicializar o channel e iniciar um pool fixo de workers (ex: 5-10 workers).
   ```go
   func NewHandler(...) *Handler {
       h := &Handler{... jobQueue: make(chan ports.IncomingMessage, 1000)}
       // Inicializa os Workers
       for i := 0; i < 10; i++ {
           go h.workerLoop()
       }
       return h
   }
   
   func (h *Handler) workerLoop() {
       for msg := range h.jobQueue {
           h.processLegacy(msg) // O processo acontece sequencial e gerenciado
       }
   }
   ```
3. **Ponto de Enfileiramento:** Em `handleWebhook`, substituir o `go h.processLegacy(*payload)` pelo envio (não bloqueante) ao channel:
   ```go
   select {
   case h.jobQueue <- *payload:
       log.Printf("Mensagem enfileirada no pool")
   default:
       log.Printf("Fila cheia, rejeitando requisição com 429 Too Many Requests")
       c.JSON(http.StatusTooManyRequests, gin.H{"error": "queue full"})
       return // Retorna 429 para que a Evolution API faça o retry depois!
   }
   ```
Isso resolverá os problemas de timeouts por sobrecarga, limitará a concorrência no processamento do LLM e retornará um `200 OK` instantâneo (ou `429` saudável caso a fila em-memória encha), sem derrubar conexões ou abrir goroutines de forma descontrolada.
