package notify

import (
	"context"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// Email envia alertas por SMTP. Serve como registro auditável e como segunda
// via caso o push do Telegram não chegue ou não seja visto.
type Email struct {
	host  string
	porta string
	user  string
	senha string
	de    string
	para  []string

	// enviar é injetável para teste. Subir um servidor SMTP falso só para provar
	// que montamos o cabeçalho certo seria caro e frágil; trocar a função aqui
	// testa exatamente a parte que é nossa.
	enviar func(addr string, a smtp.Auth, from string, to []string, msg []byte) error
}

// NewEmail cria o canal. `para` aceita múltiplos destinatários separados por
// vírgula.
func NewEmail(host, porta, user, senha, de, para string) *Email {
	var destinos []string
	for _, p := range strings.Split(para, ",") {
		if p = strings.TrimSpace(p); p != "" {
			destinos = append(destinos, p)
		}
	}
	return &Email{
		host:   host,
		porta:  porta,
		user:   user,
		senha:  senha,
		de:     de,
		para:   destinos,
		enviar: smtp.SendMail,
	}
}

func (e *Email) Name() string { return "email" }

func (e *Email) Notify(ctx context.Context, a ports.Alerta) error {
	if len(e.para) == 0 {
		return fmt.Errorf("email: nenhum destinatário configurado")
	}

	// smtp.SendMail não aceita context.Context. Em vez de fingir que respeita o
	// prazo, verificamos antes de gastar uma conexão e deixamos o timeout real
	// por conta do chamador, que roda o Notify em goroutine própria.
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("email: contexto encerrado antes do envio: %w", err)
	}

	assunto := a.Titulo
	if a.Severidade == ports.SeveridadeRecuperado {
		assunto = "[RECUPERADO] " + assunto
	} else {
		assunto = "[CRITICO] " + assunto
	}

	var msg strings.Builder
	fmt.Fprintf(&msg, "From: %s\r\n", e.de)
	fmt.Fprintf(&msg, "To: %s\r\n", strings.Join(e.para, ", "))
	fmt.Fprintf(&msg, "Subject: %s\r\n", assunto)
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(formatarMensagem(a))

	var auth smtp.Auth
	if e.user != "" {
		auth = smtp.PlainAuth("", e.user, e.senha, e.host)
	}

	addr := fmt.Sprintf("%s:%s", e.host, e.porta)
	if err := e.enviar(addr, auth, e.de, e.para, []byte(msg.String())); err != nil {
		return fmt.Errorf("email: envio falhou: %w", err)
	}
	return nil
}
