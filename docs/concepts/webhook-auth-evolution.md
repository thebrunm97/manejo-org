---
title: Autenticação do Webhook evolution-go → pmo-bot-go
type: concept
sources: []
related: []
created: 2026-09-08
updated: 2026-09-08
confidence: high
---

# Autenticação do Webhook evolution-go → pmo-bot-go

## O que é

O `evolution-go` entrega cada evento do WhatsApp (mensagens, recibos, presença,
conexão) via HTTP POST para o `pmo-bot-go`, em duas rotas simultâneas por
mensagem: uma **global** (`WEBHOOK_URL`, configurada no ambiente do próprio
`evolution-go`) e outra **por-instância** (registrada em runtime pelo
`pmo-bot-go` via `ConfigureWebhooks`, salva na SQLite do `evolution-go` na
coluna `instances.webhook`).

Desde a correção do **DT-127** (2026-09-08), a autenticação dessa entrega é
feita **exclusivamente pelo header `Authorization: Bearer <WEBHOOK_TOKEN>`**,
aplicado pelo `evolution-go` a toda entrega (as duas rotas) e validado pelo
`pmo-bot-go` só nesse header — nunca mais por `?token=...` na query string.

## Por que isso importa

Colocar o token na URL (padrão antigo, já removido) tinha três problemas: o
segredo vazava em log de proxy/acesso, ficava no histórico de requisições, e
era persistido em texto plano na própria SQLite do `evolution-go` (coluna
`instances.webhook`). Mover para o header fecha os três vetores de uma vez —
sem exigir nenhuma outra mudança de infraestrutura.

## Onde vive no código

- `evolution-go-source/pkg/events/webhook/webhook_producer.go` — monta e
  envia a requisição (`sendWebhook`), aplicando o header incondicionalmente às
  duas entregas.
- `evolution-go-source/cmd/evolution-go/main.go` — lê `WEBHOOK_TOKEN` do
  ambiente e monta o valor `"Bearer <token>"` passado ao producer.
- `pmo-bot-go/internal/webhook/handler.go` (`handleWebhook`) — valida só o
  header `Authorization`, nunca a query string.
- `pmo-bot-go/cmd/server/main.go` — registra o webhook (`ConfigureWebhooks`/
  `ConfigureWebhooksWithRetry`) usando `cfg.WebhookURL` puro, sem token
  embutido — a autenticação fica inteiramente do lado do `evolution-go`.

## Armadilha histórica (DT-127)

Por um tempo, o `evolution-go` rodando em produção era um **binário mais
antigo** que o código no repositório — nunca tinha sido rebuildado depois do
fix acima ser escrito. Isso fazia a entrega **global** (sem `?token=` na URL)
sempre falhar com `token_invalid`, enquanto a entrega **por-instância** (que
ainda carregava o token na query, jeito antigo) sempre passava — um padrão
100% determinístico, não uma race condition, mascarado pela regra de ouro do
handler de sempre responder HTTP 200 mesmo em falha de auth. Lição: depois de
qualquer mudança neste arquivo, confirmar que a imagem Docker do
`evolution-go` foi de fato rebuildada e o container reiniciado — um `git
commit` sozinho não muda o binário rodando.

## Ver também

- `pmo-bot-go/docs/debitos_tecnicos.md` — entrada DT-127 (Concluído), com o
  histórico completo da investigação.
- `pmo-bot-go/internal/webhook/webhook_auth_test.go` — testes de regressão
  cobrindo os três casos (header autentica, query não autentica mais, token
  errado é rejeitado).
