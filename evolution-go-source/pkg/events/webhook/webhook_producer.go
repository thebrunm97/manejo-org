package webhook_producer

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	producer_interfaces "github.com/EvolutionAPI/evolution-go/pkg/events/interfaces"
	logger_wrapper "github.com/EvolutionAPI/evolution-go/pkg/logger"
)

type webhookProducer struct {
	url             string
	authHeaderValue string
	loggerWrapper   *logger_wrapper.LoggerManager
}

// NewWebhookProducer recebe authHeaderValue já pronto para uso em
// `Authorization: <valor>` (ex.: "Bearer <token>"). Vazio significa "sem
// autenticação" — mantém compatibilidade com quem ainda não configurou
// WEBHOOK_TOKEN. O header é aplicado a TODA entrega, tanto a global (p.url,
// de WEBHOOK_URL) quanto a por instância (webhookUrl, de SetWebhook) — as
// duas passam pelo mesmo sendWebhook abaixo. Isso substitui o padrão antigo
// de embutir o token na própria URL (?token=...), que expunha o segredo em
// logs de proxy, histórico e no `SetWebhook` gravado em texto plano no
// banco.
func NewWebhookProducer(
	url string,
	authHeaderValue string,
	loggerWrapper *logger_wrapper.LoggerManager,
) producer_interfaces.Producer {
	return &webhookProducer{
		url:             url,
		authHeaderValue: authHeaderValue,
		loggerWrapper:   loggerWrapper,
	}
}

func (p *webhookProducer) Produce(
	queueName string,
	payload []byte,
	webhookUrl string,
	userID string,
) error {
	splitQueue := strings.Split(queueName, ".")

	if len(splitQueue) < 2 {
		return nil
	}

	if p.url != "" {
		go p.sendWebhookWithRetry(p.url, payload, 5, 30*time.Second, userID)
	}
	if webhookUrl != "" {
		go p.sendWebhookWithRetry(webhookUrl, payload, 5, 30*time.Second, userID)
	}

	return nil
}

func (p *webhookProducer) sendWebhookWithRetry(url string, body []byte, maxRetries int, retryInterval time.Duration, userID string) {
	for i := 0; i < maxRetries; i++ {
		err, responseBody, statusCode := p.sendWebhook(url, body, userID)
		if err == nil {
			p.loggerWrapper.GetLogger(userID).LogInfo("[%s] webhook sent successfully - url: %s, status: %d, response: %s", userID, url, statusCode, string(responseBody))
			return
		}
		p.loggerWrapper.GetLogger(userID).LogWarn("[%s] webhook failed - url: %s, attempt: %d, error: %v", userID, url, i+1, err)

		time.Sleep(retryInterval)
	}
	p.loggerWrapper.GetLogger(userID).LogError("[%s] webhook failed after maximum retries - url: %s", userID, url)
}

func (p *webhookProducer) sendWebhook(url string, body []byte, userID string) (error, []byte, int) {
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("erro ao criar request: %w", err), nil, 0
	}

	req.Header.Set("Content-Type", "application/json")
	if p.authHeaderValue != "" {
		req.Header.Set("Authorization", p.authHeaderValue)
	}

	// Configuração do timeout para evitar hang infinito (Goroutine leak)
	client := &http.Client{
		Timeout: 15 * time.Second,
	}
	
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("erro ao executar request HTTP: %w", err), nil, 0
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("erro ao ler corpo da resposta: %w", err), nil, resp.StatusCode
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("received non-2xx response: %s (Body: %s)", resp.Status, string(responseBody)), responseBody, resp.StatusCode
	}

	return nil, responseBody, resp.StatusCode
}

// CreateGlobalQueues não faz nada para webhook producer
func (p *webhookProducer) CreateGlobalQueues() error {
	return nil
}
