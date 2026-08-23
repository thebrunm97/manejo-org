package notify

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

const janelaCooldownPadrao = 30 * time.Minute

// NewFromEnv monta a cadeia de alerta a partir do ambiente.
//
// Único ponto que conhece canais concretos — mesma estratégia do
// tts.NewFromEnv (DT-28). O resto do código só enxerga ports.Notifier.
//
// Nunca devolve nil: sem configuração alguma, devolve Noop{}. O segundo retorno
// diz se há algum canal real, para o chamador poder avisar no log de boot que a
// operação está surda.
func NewFromEnv() (ports.Notifier, bool) {
	var canais []ports.Notifier

	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID := os.Getenv("TELEGRAM_CHAT_ID")
	switch {
	case token != "" && chatID != "":
		canais = append(canais, NewTelegram(token, chatID))
	case token != "" || chatID != "":
		// Meio configurado é quase certamente um engano de quem editou o .env, e
		// silenciar isso significa descobrir só no dia do incidente.
		log.Println("⚠️ [Alerta] Telegram ignorado: TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID precisam estar ambos preenchidos")
	}

	host := os.Getenv("ALERT_SMTP_HOST")
	de := os.Getenv("ALERT_EMAIL_FROM")
	para := os.Getenv("ALERT_EMAIL_TO")
	switch {
	case host != "" && de != "" && para != "":
		canais = append(canais, NewEmail(
			host,
			envOr("ALERT_SMTP_PORT", "587"),
			os.Getenv("ALERT_SMTP_USER"),
			os.Getenv("ALERT_SMTP_PASSWORD"),
			de,
			para,
		))
	case host != "" || de != "" || para != "":
		log.Println("⚠️ [Alerta] E-mail ignorado: ALERT_SMTP_HOST, ALERT_EMAIL_FROM e ALERT_EMAIL_TO precisam estar todos preenchidos")
	}

	if len(canais) == 0 {
		return Noop{}, false
	}

	cascata := NewCascata(canais...)
	log.Printf("📣 [Alerta] Canais ativos: %s (cooldown=%s)", strings.Join(cascata.Canais(), ", "), janelaCooldown())
	return NewCooldown(cascata, janelaCooldown()), true
}

// janelaCooldown segue o padrão de duração já usado para REAPER_INTERVAL e
// AUDIT_GC_INTERVAL em cmd/server/main.go: valor inválido vira aviso e default,
// nunca um erro fatal na subida.
func janelaCooldown() time.Duration {
	v := os.Getenv("ALERT_COOLDOWN")
	if v == "" {
		return janelaCooldownPadrao
	}
	parsed, err := time.ParseDuration(v)
	if err != nil {
		log.Printf("⚠️ [Alerta] ALERT_COOLDOWN=%q inválido, usando default de %s: %v", v, janelaCooldownPadrao, err)
		return janelaCooldownPadrao
	}
	return parsed
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Garantias de compilação: as implementações satisfazem o contrato.
var (
	_ ports.Notifier = (*Telegram)(nil)
	_ ports.Notifier = (*Email)(nil)
	_ ports.Notifier = (*Cascata)(nil)
	_ ports.Notifier = (*Cooldown)(nil)
	_ ports.Notifier = Noop{}
)
