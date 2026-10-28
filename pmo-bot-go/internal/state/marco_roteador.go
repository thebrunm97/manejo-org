package state

import (
	"context"
	"time"
)

type chaveRoteadorPronto struct{}

// comRoteadorPronto guarda no contexto quando o roteador terminou de decidir.
func comRoteadorPronto(ctx context.Context, t time.Time) context.Context {
	return context.WithValue(ctx, chaveRoteadorPronto{}, t)
}

// marcoRoteador põe esse instante no início do rastro gravado em
// logs_processamento. Com ele, e com o tempo total de logs_consumo, dá para
// separar no banco o tempo do roteador do tempo do especialista, sem depender
// do log do container.
func marcoRoteador(ctx context.Context, trace []TraceEvent) []TraceEvent {
	t, ok := ctx.Value(chaveRoteadorPronto{}).(time.Time)
	if !ok {
		return trace
	}
	return append([]TraceEvent{{Action: "roteador_decidiu", Time: t}}, trace...)
}
