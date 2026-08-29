package ports

import "context"

// EventPublisher publica eventos efêmeros de fan-out — coisas que interessam a
// zero ou mais interessados e cuja perda é tolerável (presença, "digitando…",
// status de leitura, sinais de observabilidade).
//
// # Por que esta interface existe antes de ter implementação
//
// Esta é a costura pela qual um broker (RabbitMQ, ou Redis Streams) entra no
// sistema sem refatorar quem publica. Ela é declarada agora, e de propósito sem
// adapter, porque hoje não existe nenhum produtor que a justifique: a auditoria
// em docs/PLAN-redis-integration.md mostrou que a fila durável do Postgres
// (RPC claim_next_message_job, com backoff ocioso em ai_worker.go) não tem o
// problema de carga que motivaria trocá-la por um broker.
//
// Quando o primeiro produtor real aparecer, o adapter entra em
// internal/adapter/ e nada além do wiring em cmd/server/main.go muda.
//
// # O que NÃO passa por aqui
//
// Trabalho durável. A fila de jobs de mensagem exige entrega garantida,
// retentativa e reaper — isso vive no Postgres (internal/queue) e continua
// vivendo lá. Publicar aqui é fire-and-forget: um evento perdido não pode
// significar uma mensagem de produtor perdida.
type EventPublisher interface {
	// Publish envia um evento para o tópico dado. Não bloqueia esperando
	// consumidor e não garante entrega — um tópico sem ninguém escutando é um
	// no-op bem-sucedido, não um erro.
	Publish(ctx context.Context, topic string, payload []byte) error
}

// NoopEventPublisher descarta tudo. É o valor default enquanto não há broker
// configurado, para que quem publica nunca precise checar nil.
type NoopEventPublisher struct{}

// Publish implementa EventPublisher descartando o evento.
func (NoopEventPublisher) Publish(context.Context, string, []byte) error { return nil }
