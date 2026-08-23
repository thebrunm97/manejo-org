package notify

import (
	"context"
	"sync"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ErrSuprimido não é uma falha: indica que o alerta foi deliberadamente
// silenciado por repetição dentro da janela de cooldown. O chamador deve
// distingui-lo de um erro de entrega — contá-lo como falha faria a métrica de
// alertas parecer quebrada justamente quando o mecanismo está funcionando.
type ErrSuprimido struct {
	Chave  string
	Desde  time.Duration
	Janela time.Duration
}

func (e *ErrSuprimido) Error() string {
	return "alerta suprimido por cooldown: chave=" + e.Chave
}

// Cooldown é um decorator que impede tempestade de alertas.
//
// Mesma forma do tts.ConcurrencyLimiter (DT-54): envolve outro Notifier e
// acrescenta uma única política, sem que o canal de baixo saiba disso.
type Cooldown struct {
	next   ports.Notifier
	janela time.Duration

	mu      sync.Mutex
	ultimos map[string]time.Time

	// agora é injetável para o teste controlar o relógio, seguindo a decisão do
	// StuckJobReaper (DT-50) de nunca fazer teste esperar tempo real passar.
	agora func() time.Time
}

// NewCooldown cria o decorator. Janela não-positiva desliga a supressão, para
// ALERT_COOLDOWN=0 ser uma forma válida de dizer "quero tudo".
func NewCooldown(next ports.Notifier, janela time.Duration) *Cooldown {
	return &Cooldown{
		next:    next,
		janela:  janela,
		ultimos: make(map[string]time.Time),
		agora:   time.Now,
	}
}

func (c *Cooldown) Name() string { return "cooldown(" + c.next.Name() + ")" }

func (c *Cooldown) Notify(ctx context.Context, a ports.Alerta) error {
	if permitido, desde := c.permitir(a); !permitido {
		return &ErrSuprimido{Chave: a.Chave, Desde: desde, Janela: c.janela}
	}

	err := c.next.Notify(ctx, a)
	if err != nil {
		// Entrega falhou: desfaz a marcação para a próxima tentativa não ser
		// silenciada. Caso contrário, uma falha transitória do Telegram
		// silenciaria o incidente inteiro pela janela toda — o cooldown existe
		// para conter repetição, não para engolir o primeiro aviso.
		c.desmarcar(a.Chave)
	}
	return err
}

// permitir decide e já registra o envio, sob o mesmo lock, para dois alertas
// concorrentes com a mesma chave não passarem juntos.
func (c *Cooldown) permitir(a ports.Alerta) (bool, time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	agora := c.agora()

	// Recuperação sempre passa e LIMPA a chave: fechar o incidente é urgente, e
	// zerar o estado garante que uma nova queda logo em seguida volte a alertar
	// em vez de ser confundida com repetição da anterior.
	if a.Severidade == ports.SeveridadeRecuperado {
		delete(c.ultimos, a.Chave)
		return true, 0
	}

	if c.janela <= 0 {
		return true, 0
	}

	if ultimo, visto := c.ultimos[a.Chave]; visto {
		if desde := agora.Sub(ultimo); desde < c.janela {
			return false, desde
		}
	}

	c.ultimos[a.Chave] = agora
	return true, 0
}

func (c *Cooldown) desmarcar(chave string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.ultimos, chave)
}
