package ports

import (
	"context"
	"time"
)

// RateLimitDecision é o veredito de uma consulta ao rate limiter.
//
// Remaining e RetryAfter existem para que o chamador possa responder algo útil
// (header Retry-After, log com contexto) em vez de só um 429 mudo. Quando
// Allowed é true, RetryAfter é zero.
type RateLimitDecision struct {
	// Allowed indica se a requisição pode prosseguir.
	Allowed bool

	// Remaining é quantas requisições ainda cabem na janela atual. Nunca
	// negativo: excedentes são reportados como 0.
	Remaining int

	// RetryAfter é quanto falta para a janela atual expirar. Só é significativo
	// quando Allowed é false.
	RetryAfter time.Duration
}

// RateLimiter limita a taxa de eventos de uma identidade (telefone,
// organização, IP). A política — janela, teto, algoritmo — é decidida pela
// implementação, não pelo chamador: quem chama só pergunta "posso?".
//
// Vive em `ports`, não em `webhook`, porque é o pacote webhook quem depende
// desta interface, nunca o contrário — mesma direção de dependência de
// ports.MessageSender e ports.ConnectionEventNotifier.
//
// # Contrato de falha: degradar ABERTO
//
// Toda implementação distribuída (Redis, e amanhã qualquer outra) DEVE retornar
// erro em vez de negar quando o backend estiver indisponível. A decisão de
// deixar passar é do chamador, e é deliberada: um Redis fora do ar não pode
// derrubar o recebimento de mensagens do bot. Rate limiting aqui é proteção
// contra abuso, não um controle de segurança — negar por falha de
// infraestrutura trocaria um problema de custo por uma interrupção total.
//
// Em erro, o valor de RateLimitDecision retornado deve ser ignorado pelo
// chamador.
type RateLimiter interface {
	// Allow consome uma unidade da cota de `key` e devolve o veredito.
	//
	// A chamada tem efeito colateral: mesmo negando, o consumo é contabilizado.
	// Não deve bloquear esperando a janela liberar — quem chama é o handler
	// HTTP do webhook, que precisa devolver 200 rápido.
	Allow(ctx context.Context, key string) (RateLimitDecision, error)
}

// NoopRateLimiter permite tudo. É o valor default quando não há Redis
// configurado (REDIS_URL vazia) ou quando a conexão falhou no boot, para que
// quem chama nunca precise checar nil.
//
// Deixar passar é a escolha certa aqui pelo mesmo motivo descrito no contrato
// de RateLimiter: sem backend, a alternativa seria um bot que não recebe
// mensagem nenhuma. A ausência de proteção é logada no boot, em main.go.
type NoopRateLimiter struct{}

// Allow implementa RateLimiter permitindo sempre.
func (NoopRateLimiter) Allow(context.Context, string) (RateLimitDecision, error) {
	return RateLimitDecision{Allowed: true}, nil
}
