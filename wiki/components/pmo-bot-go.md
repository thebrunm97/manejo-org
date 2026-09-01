# pmo-bot-go

Backend em Go: recebe mensagens de WhatsApp, orquestra os agentes de IA e
grava no banco por RPCs atômicas. Diretório: `pmo-bot-go/`.

Módulo `github.com/thebrunm97/pmo-bot-go`, Go 1.25, HTTP com Gin.

## Filosofia: *thin backend*

A regra de negócio vive no Postgres (ADR-002, `docs/architecture/adr/002-fat-database.md`).
O Go orquestra: autentica, transcreve, classifica, aplica guardrails e chama
a RPC certa. Ver [[supabase-postgres]].

## Superfície HTTP

`pmo-bot-go/cmd/server/main.go`

| Rota | Papel |
| --- | --- |
| `POST /webhook/evolution` | Entrada principal do WhatsApp — ver [[gateway-whatsapp]] |
| `POST /webhook`, `POST /api/:session/webhook` | Entradas legadas/por sessão |
| `POST /knowledge/upload` | Ingestão de PDF — ver [[rag-e-base-de-conhecimento]] |
| `GET /health`, `GET /metrics` | Saúde e Prometheus (com BasicAuth se `promToken`) |
| `POST /admin/reload-knowledge` | Recarga de conhecimento (auth + admin) |
| `GET /api/v1/admin/maps/diagnostics` | Diagnóstico do Earth Engine |
| `GET /api/v1/maps/tiles`, `POST /api/v1/maps/zonal` | Ver [[mapa-e-geoprocessamento]] |

Middlewares: `RequestID`, `CORS`, `RequireAuth` (JWT), `RequireAdmin`.

## Pacotes internos

| Pacote | Responsabilidade |
| --- | --- |
| `internal/state/` | FSM e orquestrador; handlers por domínio (manejo, financeiro, limpeza, coletivo, system) |
| `internal/domain/` | Intenção, mutações, tipos de operação, cofre de auditoria |
| `internal/guardrails/` | Injeção, PII, HITL, idempotência, juiz LLM — ver [[compliance-de-insumos]] |
| `internal/llm/`, `internal/gemini/`, `internal/groq/` | Provedores de modelo com fallback |
| `internal/knowledge/`, `internal/chunking/` | Ingestão e avaliação de RAG |
| `internal/supabase/` | Cliente PostgREST com chave de serviço |
| `internal/gateway/` | Proxy de RPC com allowlist e JWT do usuário |
| `internal/geo/` | Cliente Earth Engine |
| `internal/queue/`, `internal/adapter/rabbitmq/`, `internal/adapter/redisstore/` | Fila, workers e cache |
| `internal/telemetry/`, `internal/middleware/`, `internal/config/` | Observabilidade e infraestrutura |

## Binários (`cmd/`)

`server` (principal), `ingestor`, `reindex`, `evaluate`, `loadtest`,
`loadtest_piper`, `pricing-refresh`, `check_all_tools`.

## O proxy de RPC — decisão importante

`internal/gateway/rpc_proxy.go` encaminha o **JWT do próprio produtor** ao
PostgREST, em vez de usar a chave de serviço, para dez RPCs em allowlist
(`create/update/delete` de talhão, caderno e PMO, mais
`rpc_update_propriedade`). Motivo: essas funções são `SECURITY DEFINER` e
derivam o dono de `auth.uid()`; com a chave de serviço, `auth.uid()` seria
NULL e toda chamada falharia em "Não autorizado". O comentário no topo do
arquivo documenta o raciocínio completo — leia antes de alterar.
