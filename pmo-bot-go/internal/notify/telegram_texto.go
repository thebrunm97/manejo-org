package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// EnviarTexto manda um texto livre ao chat configurado. Diferente de Notify,
// que formata um alerta, aqui o texto vai como está (usado pelo comando
// /reconectar para devolver o código de pareamento).
func (t *Telegram) EnviarTexto(ctx context.Context, texto string) error {
	base := t.baseURL
	if base == "" {
		base = "https://api.telegram.org"
	}
	url := fmt.Sprintf("%s/bot%s/sendMessage", base, t.token)

	payload, err := json.Marshal(map[string]interface{}{
		"chat_id":                  t.chatID,
		"text":                     texto,
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
		return fmt.Errorf("telegram: status %d: %s", resp.StatusCode, strings.TrimSpace(string(corpo)))
	}
	return nil
}
