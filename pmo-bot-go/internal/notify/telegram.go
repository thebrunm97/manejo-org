// Package notify implementa canais de alerta fora de banda para ports.Notifier.
//
// "Fora de banda" é o requisito central: o primeiro uso destes canais é avisar
// que a sessão do WhatsApp caiu, então nenhum deles pode depender do WhatsApp.
package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// Telegram envia alertas por push usando a Bot API.
//
// Deliberadamente sem biblioteca de terceiros: a API é um POST com JSON, e uma
// dependência nova no go.mod custaria mais do que as ~40 linhas abaixo.
type Telegram struct {
	token   string
	chatID  string
	baseURL string // sobrescrito nos testes; vazio significa a API real
	client  *http.Client
}

// NewTelegram cria o canal. Token e chatID vêm do ambiente e nunca do código
// (DT-45: credencial em fonte de repositório público já custou caro uma vez).
func NewTelegram(token, chatID string) *Telegram {
	return &Telegram{
		token:  token,
		chatID: chatID,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (t *Telegram) Name() string { return "telegram" }

func (t *Telegram) Notify(ctx context.Context, a ports.Alerta) error {
	base := t.baseURL
	if base == "" {
		base = "https://api.telegram.org"
	}
	url := fmt.Sprintf("%s/bot%s/sendMessage", base, t.token)

	payload, err := json.Marshal(map[string]interface{}{
		"chat_id": t.chatID,
		"text":    formatarMensagem(a),
		// Sem parse_mode: o corpo carrega nomes de container e mensagens de erro
		// do WhatsApp, e um "_" ou "*" solto faria o Telegram recusar a mensagem
		// inteira com 400. Alerta que não chega por causa de formatação é pior
		// que alerta feio.
		"disable_web_page_preview": true,
	})
	if err != nil {
		return fmt.Errorf("telegram: falha ao serializar payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("telegram: falha ao criar requisição: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram: requisição falhou: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		corpo, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		// O corpo do erro do Telegram não contém o token (ele vai na URL), então
		// é seguro propagar. A URL, essa, nunca entra na mensagem de erro.
		return fmt.Errorf("telegram: status %d: %s", resp.StatusCode, strings.TrimSpace(string(corpo)))
	}
	return nil
}

// formatarMensagem monta o texto final. Compartilhado com o canal de e-mail para
// os dois contarem a mesma história.
func formatarMensagem(a ports.Alerta) string {
	prefixo := "🚨"
	if a.Severidade == ports.SeveridadeRecuperado {
		prefixo = "✅"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%s %s\n\n", prefixo, a.Titulo)
	b.WriteString(a.Corpo)
	fmt.Fprintf(&b, "\n\n🕒 %s", a.Em.Format("2006-01-02 15:04:05 -07:00"))
	return b.String()
}
