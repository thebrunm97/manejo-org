# Estratégia de Teste de Carga e Stress (k6)

Esta documentação detalha a análise empírica, pontos de falha e configuração para o teste de carga no microsserviço `pmo-bot-go`.

## 1. Research (Diagnóstico de Arquitetura)
Após inspecionar a arquitetura assíncrona do bot:
- **Endpoints de Webhook (`/webhook/evolution`):** A receção de webhooks no Gin injeta um `Request-ID`, faz `ParseWebhook` e verifica `dedup` via Mutex in-memory (`sync.Map`) antes de enfileirar.
- **Worker Pool (`MemoryWorkerPool`):** Contém um limite de *queue* rígido (tamanho 1000). Quando 1000 mensagens se acumulam simultaneamente na fila, a chamada `Enqueue` lança `ErrQueueFull` e o webhook recusa o pedido retornando **HTTP 429 (Too Many Requests)**.
- **Vulnerabilidades/Gargalos Teóricos:**
  1. **Contenção no Mutex do Dedup (`processedMu`):** A leitura/escrita concorrente na validação de mensagens duplicadas pode introduzir micro-latências.
  2. **Supabase/Network Limits:** Ao saturar os workers, os limites reais recairão nas queries concorrentes ao banco Supabase (InsertPayload) e nas respostas do provedor LLM (Rate Limits 429 de APIs externas como o Groq/OpenAI).
  3. **OOM Crash Preventivo:** O comportamento ideal é que a barreira do `ErrQueueFull` atue como um backpressure *circuit breaker*, protegendo a memória do container de crachar.

## 2. Load Profile Plan
Foi delineado um perfil de teste de carga (`load-test.js`) distribuído por três etapas:
1. **Ramp-up:** De 0 a 50 Virtual Users (VUs) em 30 segundos. Serve para garantir que o pool processa a carga standard inicial com sucesso e a conexão com o Supabase instancía as pools.
2. **Stress Peak:** Carga constante de 300 VUs em 2 minutos. Simula um volume maciço de mensagens disparado simultaneamente (ex: uma campanha em grupo no WhatsApp).
3. **Spike Súbito:** Salto de 300 para 600 VUs em 30s. Aqui entra o stress extremo com o intuito de exaurir a `queue_size` (atingir as 1000 mensagens enfileiradas). Esperamos ver retornos HTTP 429, validando a degradação graciosa da aplicação sem *downtime*.

## 3. Instruções de Execução

### Instalar k6
Se não possuir o k6 instalado localmente (no Windows via Chocolatey):
```bash
choco install k6
```
(Alternativamente pode usar `winget install k6` ou correr via Docker).

### Correr o Teste
Certifique-se de que a aplicação `pmo-bot-go` está a correr. De seguida, na raiz do projeto:
```bash
k6 run deploy/load-test/load-test.js -e WEBHOOK_TOKEN="seu_token_aqui" -e BASE_URL="http://localhost:8080"
```

### Correlação com o Prometheus
1. Durante o teste, observe o Grafana Dashboard.
2. Verifique o **Worker Pool Queue Size** (vai subir até 1000 no Spike).
3. Verifique o **Webhook Throughput** (Poderá observar erros `queue_full` quando a fila estiver no máximo).
4. Verifique a **RAG Latency (p95)** para diagnosticar se a alta concorrência prejudicou o tempo do pipeline semântico.
