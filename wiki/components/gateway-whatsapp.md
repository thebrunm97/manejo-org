# Gateway WhatsApp

O WhatsApp é a interface principal do produtor no campo — mais usada que o
PWA, porque não exige instalação nem navegação. Este componente é a borda
entre a rede do WhatsApp e o [[pmo-bot-go]].

## Caminho da mensagem

```
Produtor → WhatsApp → Evolution API → POST /webhook/evolution
        → dedup → fila → worker → [[roteador-de-agentes-ia]]
        → guardrails → RPC no [[supabase-postgres]] → resposta
```

## Registro de rotas

`pmo-bot-go/internal/webhook/handler.go:149`

```go
r.POST("/webhook", h.handleWebhook)
r.POST("/webhook/evolution", h.handleWebhook)  // rota primária
```

Mais `POST /api/:session/webhook` para instâncias por sessão.

## Autenticação do webhook

O token recebido é comparado com `h.cfg.Token` usando `hmac.Equal`
(`handler.go:846`) — comparação em **tempo constante**, contra ataque de
temporização.

> Cuidado com a nomenclatura: o `README.md` da raiz descreve o webhook como
> "POST + HMAC". Na prática o que existe é comparação constante de um token
> compartilhado, **não** verificação de assinatura HMAC do corpo da
> requisição. São garantias diferentes — a segunda detectaria adulteração do
> payload, a primeira não.

## Adaptadores

`internal/adapter/evolution/` (atual) e `internal/adapter/wppconnect/`
(legado). A abstração de canal está registrada em
`docs/architecture/adr/011-abstracao-de-canal-de-chat.md`.

## Entrega assíncrona e resiliência

- Deduplicação por `processed_webhooks` e
  `internal/guardrails/idempotency.go` — a Evolution reentrega em caso de
  timeout, e o mesmo áudio não pode virar dois registros.
- Enfileiramento: `internal/webhook/handler_queue.go`,
  `internal/webhook/worker_pool.go`, `internal/queue/` (`ai_worker.go`,
  `media_worker.go`, `reaper.go`), com RabbitMQ
  (`internal/adapter/rabbitmq/`) e Redis (`internal/adapter/redisstore/`).
- Tabela `message_queue` + view `message_queue_monitor`, monitoradas pelo PWA
  (`pmo-frontend/src/services/queueService.ts`, tela `/admin/chat`).
- Áudio bruto vai para o cofre efêmero (`internal/adapter/auditvault/`,
  tabela `audios_audit`) — ver `pmo-bot-go/docs/COFRE-EFEMERO-LGPD.md`.

Relacionado: [[caderneta-de-campo]], [[compliance-de-insumos]].
