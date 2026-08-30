# Plano de Tracing de Latência e Diagnóstico de Gargalos

O objetivo desta intervenção é adicionar instrumentação leve (via `time.Since`) nas camadas críticas do backend Go (`pmo-bot-go`), permitindo diagnosticar a lentidão nas respostas sem causar overhead no sistema em produção.

## User Review Required

> [!WARNING]
> Esta instrumentação adicionará ruído aos logs (stdout). Como o sistema roda no modo Harness com múltiplos workers, os logs podem ficar confusos se houver alto paralelismo. É aceitável usarmos apenas `log.Printf`, ou prefere que estes logs sejam gravados numa tabela temporária no Supabase para análise posterior?

## Open Questions (Socratic Gate)

> [!IMPORTANT]
> 1. **Destino das Métricas**: Atualmente a instrumentação sugerida é simples (`log.Printf`). Devemos adotar uma abordagem OpenTelemetry no futuro, ou para este diagnóstico o stdout é suficiente?
> 2. **Medição End-to-End**: Queremos medir o tempo desde que a mensagem cai no webhook até ao envio via API do WhatsApp, ou o foco é estritamente no gargalo interno das camadas (Worker de IA, RAG, Supabase, LLM)?

## Análise de Concorrência Inicial

- **Extração de PDF e Webhook**: O bot utiliza um padrão arquitetural excelente (Harness Mode). O Webhook apenas coloca a mensagem na fila do PostgreSQL e retorna HTTP 200 imediatamente. A extração de texto (RAG/PDF) e a transcrição ocorrem nos `Media Workers`, e o raciocínio ocorre nos `AI Workers`. Portanto, **o processamento de PDFs não bloqueia a resposta do webhook**, mas pode causar lentidão visível na fila do worker.
- **Supabase e LLMs**: Estas chamadas são I/O-bound e ocorrem no AI Worker. Podem ser as principais causadoras de estrangulamento da *goroutine*.

## Proposed Changes

Abaixo estão os ficheiros e as injeções de telemetria propostas:

---

### Módulo de RAG (PDF)

#### [MODIFY] pmo-bot-go/internal/utils/rag.go
- **Adição**: Injetar `start := time.Now()` no início de `ExtractTextFromPDF`.
- **Adição**: `defer log.Printf("⏱️ [Tracing] RAG - Extração de PDF demorou: %v", time.Since(start))`
- **Objetivo**: Descobrir se a biblioteca `ledongthuc/pdf` está a estrangular a leitura de PDFs densos.

---

### Módulo de LLM (Gemini / OpenRouter)

#### [MODIFY] pmo-bot-go/internal/gemini/client.go
- **Adição**: Na função `AskSimple` (e outras chamadas críticas), adicionar um temporizador que cubra toda a chamada HTTP ao LLM.
- **Objetivo**: Medir a latência real da API do Google Gemini, e capturar o *penalty time* caso a chamada faça failover para o OpenRouter.

---

### Módulo de Supabase (I/O e Base de Dados)

#### [MODIFY] pmo-bot-go/internal/supabase/client.go
- **Adição**: Nas funções de escrita crítica como `UpsertBotStatus`, `CreateMessage`, e `UpdateRawPayloadStatus`, adicionar medições de latência.
- **Objetivo**: Confirmar se o bottleneck está nas requisições HTTP REST ao Supabase.

---

### Módulo Workers (Orquestração Geral)

#### [MODIFY] pmo-bot-go/internal/queue/media_worker.go
- **Adição**: Instrumentar `processMediaJob` (que lida com áudios Groq e PDFs).
- **Objetivo**: Medir o tempo total da Camada 3.

#### [MODIFY] pmo-bot-go/internal/queue/ai_worker.go
- **Adição**: Melhorar o `time.Since` já existente no `processAIJob`, desagregando o tempo gasto no Guardrail vs Tempo gasto no Orchestrator (Tool Loop).

## Verification Plan

### Testes Manuais
- Iniciar o `pmo-bot-go` localmente ou no ambiente de staging com `HARNESS_ENABLED=true`.
- Enviar 3 tipos de cargas via WhatsApp:
  1. Texto simples ("Olá").
  2. Áudio longo (para sobrecarregar o Groq).
  3. PDF técnico pesado (para stressar o `ledongthuc/pdf`).
- Capturar e analisar o ficheiro `trace.log` gerado.
