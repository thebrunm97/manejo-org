package notify

import (
	"context"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// Noop descarta alertas silenciosamente.
//
// Existe para que NENHUM call site precise checar nil antes de alertar. O laço
// de reconexão legado (internal/adapter/wppconnect/adapter.go) engole erros
// justamente porque ninguém quis lidar com verificações desse tipo espalhadas
// pelo código; um objeto nulo custa menos que um nil-check esquecido.
//
// Devolvido por NewFromEnv quando nenhum canal está configurado.
type Noop struct{}

func (Noop) Name() string { return "nenhum" }

func (Noop) Notify(context.Context, ports.Alerta) error { return nil }
