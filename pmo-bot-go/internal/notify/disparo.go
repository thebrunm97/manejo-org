package notify

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
)

// timeoutEntrega limita quanto tempo uma tentativa de alerta pode consumir.
const timeoutEntrega = 10 * time.Second

// Disparar entrega um alerta em segundo plano, sem jamais bloquear nem derrubar
// o chamador.
//
// Três decisões que parecem detalhes e não são:
//
//  1. context.WithoutCancel — o contexto do chamador pode já estar sendo
//     cancelado (shutdown, tick encerrado). Herdar esse cancelamento faria o
//     alerta morrer sem abrir conexão, que é exatamente o defeito (c) do DT-32:
//     a escalada retornava em 0,55ms porque nascia com prazo esgotado. Um alerta
//     de queda disparado durante o encerramento do processo é justamente o que
//     mais precisa sair.
//
//  2. recover — roda em goroutine nua, sem gin.Recovery() acima. Pânico aqui
//     derrubaria o bot inteiro por causa de uma notificação.
//
//  3. Erro nunca propaga para a decisão de cura. Falhar ao avisar é ruim; deixar
//     de tentar se recuperar porque o aviso falhou seria pior.
func Disparar(ctx context.Context, n ports.Notifier, a ports.Alerta) {
	if n == nil {
		return
	}
	if a.Em.IsZero() {
		a.Em = time.Now()
	}

	entrega, cancel := context.WithTimeout(context.WithoutCancel(ctx), timeoutEntrega)

	go func() {
		defer cancel()
		defer func() {
			if r := recover(); r != nil {
				slog.Error("pânico ao enviar alerta",
					slog.String("chave", a.Chave),
					slog.Any("panico", r),
				)
				telemetry.AlertsSentTotal.WithLabelValues(n.Name(), a.Severidade, "panico").Inc()
			}
		}()

		inicio := time.Now()
		err := n.Notify(entrega, a)
		latencia := time.Since(inicio).Milliseconds()

		var suprimido *ErrSuprimido
		switch {
		case err == nil:
			registrar(n, a, "ok", latencia)
			slog.Info("alerta enviado",
				slog.String("chave", a.Chave),
				slog.String("severidade", a.Severidade),
				slog.String("canal", n.Name()),
				slog.Int64("latency_ms", latencia),
			)

		case errors.As(err, &suprimido):
			// Não é falha: é o cooldown fazendo o trabalho dele.
			registrar(n, a, "suprimido", latencia)

		default:
			registrar(n, a, "erro", latencia)
			slog.Error("falha ao enviar alerta",
				slog.String("chave", a.Chave),
				slog.String("severidade", a.Severidade),
				slog.String("canal", n.Name()),
				slog.String("erro", err.Error()),
			)
			// Terceiro caminho, independente do Telegram e do e-mail. O Sentry já
			// é inicializado em main.go e até aqui não tinha nenhum call site;
			// ficar sem nenhuma via de aviso é o cenário que o DT-53 existe para
			// evitar.
			sentry.CaptureMessage("falha ao entregar alerta " + a.Chave + ": " + err.Error())
		}
	}()
}

func registrar(n ports.Notifier, a ports.Alerta, status string, latencia int64) {
	telemetry.AlertsSentTotal.WithLabelValues(n.Name(), a.Severidade, status).Inc()
	// Formato grep-friendly consumido por scripts/analisar_telemetria.sh: ordem
	// de campo estável e valores sem espaço.
	log.Printf("telemetry event=self_heal_alert canal=%s severidade=%s chave=%s status=%s latency_ms=%d",
		n.Name(), a.Severidade, a.Chave, status, latencia)
}
