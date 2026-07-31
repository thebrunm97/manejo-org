# Auditoria de Telemetria e Observabilidade - Manejo Orgânico

## 1. Estado Atual: Backend (Go)
Após uma investigação profunda no código em `pmo-bot-go`:

- **Logging Estruturado**: **Inexistente**. Todo o sistema depende exclusivamente dos pacotes standard `log` (`log.Printf`, `log.Println`) e `fmt` (`fmt.Printf`, `fmt.Println`). Não são utilizados pacotes como `slog`, `zap` ou `logrus`.
- **Rastreio Distribuído (Tracing)**: O `go.mod` contém referências indiretas (transitive dependencies) ao OpenTelemetry (`go.opentelemetry.io/otel`), porém **não há instrumentação real** (spans, propagação de contexto) no código-fonte do negócio.
- **Middleware / HTTP**: A aplicação utiliza o framework `Gin` (`gin.New()`). Os middlewares ativos são apenas `gin.Logger()` e `gin.Recovery()`. Estes emitem logs padrão de consola (texto plano), dificultando a ingestão por agregadores (Datadog, ELK).
- **Métricas e Banco de Dados**: Não existem endpoints Prometheus `/metrics`. O rastreio de latências de RAG e do LLM é calculado de forma rudimentar e exportado para o terminal em `internal/telemetry/tracker.go` (através de `fmt.Printf`). Adicionalmente, métricas pontuais de consumo são enviadas de forma síncrona diretamente para o Supabase (ex: `InsertLogConsumo`).

## 2. Estado Atual: Frontend (React/TypeScript)
A investigação no diretório `pmo-frontend` revelou:

- **Monitorização e Error Reporting**: Não existem ferramentas profissionais de monitorização integradas (Sentry, Datadog RUM, New Relic, Posthog).
- **Gestão de Logs do Cliente**: Toda a telemetria reportada no frontend baseia-se em dezenas de `console.log`, `console.warn` e `console.error` isolados (especialmente em `pmoService.ts` e em requisições de API).
- **Gaps Críticos**: Erros de rede, falhas de estado ou sessões inválidas morrem no browser do utilizador. Não há qualquer mechanism de feedback centralizado do lado do cliente para alertas à equipa de engenharia.
- Existe menção a um *AI Guardrails Security Telemetry Dashboard*, mas a sua implementação lê dados que já estão no Supabase (injetados pelo backend) em vez de capturar telemetria pura originada do frontend.

## 3. Gaps e Pontos Cegos em Componentes Críticos

Os seguintes componentes operam de forma isolada e sem rastreabilidade adequada:

- **MemoryWorkerPool (`internal/webhook/worker_pool.go`)**:
  - Toda a atividade concurrente é monitorizada apenas com `log.Printf("Worker %d recebendo sinal...")`.
  - Falta de identificação unificada: Caso um job bloqueie (goroutine leak) ou sofra *panic*, não há logs estruturados com `job_id`, `pmo_id` ou `worker_id` para correlacionar e alertar.
- **Webhooks Assíncronos (`internal/webhook/handler.go`)**:
  - Componente que serve como a "porta de entrada" dos dados (WhatsApp, etc). 
  - Regista rate limits e deduplicações via standard `log`. Sem structured JSON logs, é impossível efetuar *queries* avançadas por `phone_number` ou rastrear em que fase o webhook falhou.
- **LLM Loop & Orchestrator (`fsm.go`, `orchestrator.go`)**:
  - Telemetria de LLM e RAG assenta em `fmt.Printf` no ficheiro `telemetry/tracker.go`. É vital que estes tempos (RetrieveMS, LLMMS, etc.) sejam transpostos para Histogramas de Métricas ou Traces do OpenTelemetry para identificar *bottlenecks* nas respostas da IA.
- **CachedEmbedder**:
  - Interações de cache não possuem telemetria (Hit/Miss ratio), impedindo a otimização da cache em produção.

## 4. Oportunidades de Melhoria Imediata

1. **Backend**: Migração massiva de `log.Printf` para a package `log/slog` (built-in no Go 1.21+). Utilizar o `slog.NewJSONHandler` em `ReleaseMode`.
2. **Backend**: Implementação de middleware personalizado no Gin para associar um `Trace-ID` ou `Request-ID` a todas as interações e injetar no `context.Context`.
3. **Frontend**: Implementação urgente do Sentry (ou equivalente) para Error Tracking global via *Error Boundaries* no React e intercetores no `SupabaseClient`/Axios.
4. **Métricas**: Implementação de Prometheus (`github.com/prometheus/client_golang`) para recolher uso de memória, tamanho da Queue do `MemoryWorkerPool` e latências de geração de *Embeddings* e LLMs.
