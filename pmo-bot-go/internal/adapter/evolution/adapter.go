package evolution

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// EvolutionAdapter implements the ports.MessageSender interface for Evolution API.
type EvolutionAdapter struct {
	BaseURL      string
	InstanceName string
	APIKey       string
	httpClient   *http.Client
}

// NewEvolutionAdapter creates a new instance of EvolutionAdapter.
func NewEvolutionAdapter(baseURL, instanceName, apiKey string) *EvolutionAdapter {
	return &EvolutionAdapter{
		BaseURL:      baseURL,
		InstanceName: instanceName,
		APIKey:       apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendMessage sends a text message.
func (a *EvolutionAdapter) SendMessage(to, text string) error {
	url := fmt.Sprintf("%s/send/text", a.BaseURL)
	payload := map[string]interface{}{
		"number":       to,
		"text":         text,
		"instanceName": a.InstanceName,
	}
	return a.doRequest(http.MethodPost, url, payload)
}

// SendButton sends a button message with reply buttons.
func (a *EvolutionAdapter) SendButton(to string, title, description, footer string, buttons []map[string]string) error {
	url := fmt.Sprintf("%s/send/button", a.BaseURL)

	var serializedButtons []map[string]interface{}
	for _, btn := range buttons {
		serializedButtons = append(serializedButtons, map[string]interface{}{
			"type":        btn["type"],
			"displayText": btn["displayText"],
			"id":          btn["id"],
		})
	}

	payload := map[string]interface{}{
		"number":       to,
		"title":        title,
		"description":  description,
		"footer":       footer,
		"buttons":      serializedButtons,
		"instanceName": a.InstanceName,
	}

	err := a.doRequest(http.MethodPost, url, payload)
	if err != nil {
		log.Printf("⚠️ [Evolution] Falha ao enviar botões interativos: %v. Fazendo fallback para texto puro.", err)
		var sb strings.Builder
		if title != "" {
			sb.WriteString("*")
			sb.WriteString(title)
			sb.WriteString("*\n\n")
		}
		sb.WriteString(description)
		sb.WriteString("\n\n")
		if footer != "" {
			sb.WriteString("_")
			sb.WriteString(footer)
			sb.WriteString("_\n\n")
		}
		sb.WriteString("Responda com:\n*1. SIM*\n*2. NÃO*")
		return a.SendMessage(to, sb.String())
	}
	return nil
}

// SendVoice sends a PTT (push-to-talk) audio message via Evolution API.
//
// O endpoint /send/media do evolution-go tem dois caminhos: o de JSON exige um
// campo "url" acessível por HTTP (ele faz http.Get nela), então não aceita
// base64 nem data URI. O caminho multipart aceita os bytes crus no campo "file",
// converte para Opus automaticamente e já envia com PTT=true. Como aqui o áudio
// é gerado em memória (TTS), usamos o multipart.
func (a *EvolutionAdapter) SendVoice(to, base64Audio string, isPtt bool) error {
	url := fmt.Sprintf("%s/send/media", a.BaseURL)

	audioBytes, err := base64.StdEncoding.DecodeString(base64Audio)
	if err != nil {
		return fmt.Errorf("failed to decode SendVoice base64 audio: %w", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("number", to); err != nil {
		return fmt.Errorf("failed to write SendVoice field 'number': %w", err)
	}
	if err := writer.WriteField("type", "audio"); err != nil {
		return fmt.Errorf("failed to write SendVoice field 'type': %w", err)
	}
	part, err := writer.CreateFormFile("file", "ManejoORG_Resposta.ogg")
	if err != nil {
		return fmt.Errorf("failed to create SendVoice form file: %w", err)
	}
	if _, err := part.Write(audioBytes); err != nil {
		return fmt.Errorf("failed to write SendVoice audio bytes: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close SendVoice multipart writer: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body.Bytes()))
	if err != nil {
		return fmt.Errorf("failed to create SendVoice request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("apikey", a.APIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("evolution SendVoice request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read SendVoice response body (status %d): %w", resp.StatusCode, err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("evolution API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	log.Printf("✅ [Evolution] Voice message sent to %s (ptt=%v)", to, isPtt)
	return nil
}

// SetPresence sends a presence update (composing, recording, etc.) to a chat.
func (a *EvolutionAdapter) SetPresence(to string, presence string) error {
	url := fmt.Sprintf("%s/message/presence", a.BaseURL)
	payload := map[string]interface{}{
		"number":       to,
		"state":        presence,
		"delay":        15000,
		"instanceName": a.InstanceName,
	}

	err := a.doRequest(http.MethodPost, url, payload)
	if err != nil {
		log.Printf("⚠️ [Evolution] Falha ao definir presença (%s) para %s: %v", presence, to, err)
	}
	return err
}

// SendPresence sends a presence update (composing, paused, etc.) to a chat, with context support.
func (a *EvolutionAdapter) SendPresence(ctx context.Context, to string, state string) error {
	url := fmt.Sprintf("%s/message/presence", a.BaseURL)
	payload := map[string]interface{}{
		"number":       to,
		"state":        state,
		"delay":        15000,
		"instanceName": a.InstanceName,
	}

	err := a.doRequest(http.MethodPost, url, payload)
	if err != nil {
		log.Printf("⚠️ [Evolution] Falha ao definir presença (%s) para %s: %v", state, to, err)
	}
	return err
}

// SendReply is not fully implemented yet in Evolution Go, returning a stub.
func (a *EvolutionAdapter) SendReply(to, message, replyToMessageID string) error {
	return errors.New("SendReply not implemented yet for Evolution API")
}

// DownloadAudio fetches the audio file from Evolution API and decodes it.
func (a *EvolutionAdapter) DownloadAudio(messageID string, rawPayload []byte) ([]byte, string, error) {
	fullURL := fmt.Sprintf("%s/message/downloadmedia", a.BaseURL)
	log.Printf("📥 [Evolution-Go] Solicitando download de áudio. URL: %s | MessageID: %s", fullURL, messageID)

	if len(rawPayload) == 0 {
		return nil, "", errors.New("rawPayload is empty, cannot download media in Evolution-Go")
	}

	payload := map[string]interface{}{
		"message": json.RawMessage(rawPayload),
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal download payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, fullURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, "", fmt.Errorf("failed to create download request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.APIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("download request failed: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("📡 [Evolution-Go] Resposta do Download: %d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("evolution download error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Data struct {
			Base64 string `json:"base64"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", fmt.Errorf("failed to decode base64 response: %w", err)
	}

	if result.Data.Base64 == "" {
		return nil, "", errors.New("evolution returned empty base64 for audio in data field")
	}

	// Simple base64 decode - Strip Data URL prefix if exists and extract mimeType
	base64Str := result.Data.Base64
	mimeType := ""
	if idx := strings.Index(base64Str, ","); idx != -1 {
		prefix := base64Str[:idx] // e.g., "data:audio/ogg; codecs=opus;base64"
		if strings.HasPrefix(prefix, "data:") {
			parts := strings.Split(prefix[5:], ";")
			mimeType = parts[0]
		}
		base64Str = base64Str[idx+1:]
	}

	data, err := base64.StdEncoding.DecodeString(base64Str)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode base64 audio data: %w", err)
	}

	log.Printf("✅ [Evolution-Go] Áudio baixado com sucesso: %d bytes", len(data))
	return data, mimeType, nil
}

// DownloadImage fetches the image file from Evolution API and decodes it.
func (a *EvolutionAdapter) DownloadImage(messageID string, rawPayload []byte) ([]byte, string, error) {
	fullURL := fmt.Sprintf("%s/message/downloadmedia", a.BaseURL)
	log.Printf("📥 [Evolution-Go] Solicitando download de imagem. URL: %s", fullURL)

	if len(rawPayload) == 0 {
		return nil, "", errors.New("rawPayload is empty, cannot download media in Evolution-Go")
	}

	payload := map[string]interface{}{
		"message": json.RawMessage(rawPayload),
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal download payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, fullURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, "", fmt.Errorf("failed to create download request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.APIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("download request failed: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("📡 [Evolution-Go] Resposta do Download Image: %d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("evolution download error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Data struct {
			Base64 string `json:"base64"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", fmt.Errorf("failed to decode base64 response: %w", err)
	}

	if result.Data.Base64 == "" {
		return nil, "", errors.New("evolution returned empty base64 for image")
	}

	data, err := base64.StdEncoding.DecodeString(result.Data.Base64)
	return data, "image/jpeg", nil
}

// GetConnectionState returns the current state of the WhatsApp connection.
func (a *EvolutionAdapter) GetConnectionState() (string, error) {
	// For Evolution Go, the correct endpoint is /instance/status
	// The apikey identifies which instance to check.
	url := fmt.Sprintf("%s/instance/status", a.BaseURL)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("apikey", a.APIKey)

	// Use a longer timeout for the connection state check
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	// Evolution Go returns {"message": "success", "data": {"Connected": true, "LoggedIn": true}}
	var result struct {
		Data struct {
			Connected bool `json:"Connected"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Data.Connected {
		return "open", nil
	}
	return "close", nil
}

// StatusError carrega o código HTTP de uma resposta não-2xx da Evolution API.
//
// Existe para os chamadores classificarem por código em vez de vasculhar a
// string do erro — o padrão `strings.Contains(err.Error(), "status 401")` já
// usado no heartbeat (cmd/server/main.go) é exatamente a fragilidade que isto
// evita no código novo do healer (DT-53), onde 401 precisa de um tratamento
// diferente de "gateway indisponível".
type StatusError struct {
	Code int
	Body string
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("evolution api error (status %d): %s", e.Code, e.Body)
}

// InstanceStatus espelha a resposta de GET /instance/status.
//
// LoggedIn é o campo que GetConnectionState descarta ao colapsar tudo em
// "open"/"close". Ele importa porque, com o socket caído, LoggedIn vem false
// mesmo quando a sessão salva em disco continua perfeitamente válida — por
// isso o healer (DT-53) não pode decidir só por ele; precisa também de
// InstanceInfo.Jid.
type InstanceStatus struct {
	Connected bool
	LoggedIn  bool
	Name      string
}

// InstanceInfo espelha a resposta de GET /instance/info/:id — rota
// administrativa no evolution-go.
//
// Jid é o telefone do produtor codificado (ex.: "5534...@s.whatsapp.net").
// Nunca deve ser logado nem colocado em corpo de alerta por extenso; o healer
// só verifica se está vazio ou não. Um Jid vazio é o sinal que StartClient usa
// para decidir entre retomar sessão e abrir fluxo de QR — checar isso aqui,
// antes de agir, é a segunda das três travas contra QR automático.
type InstanceInfo struct {
	Jid              string
	Connected        bool
	DisconnectReason string
	Events           string
}

// FetchStatus consulta GET /instance/status com contexto.
//
// Autentica com a apikey por-instância — a mesma que os demais métodos deste
// adapter já usam, sem exigir chave admin.
func (a *EvolutionAdapter) FetchStatus(ctx context.Context) (InstanceStatus, error) {
	url := fmt.Sprintf("%s/instance/status", a.BaseURL)

	var result struct {
		Data struct {
			Connected bool   `json:"Connected"`
			LoggedIn  bool   `json:"LoggedIn"`
			Name      string `json:"Name"`
		} `json:"data"`
	}
	if err := a.getJSON(ctx, url, &result); err != nil {
		return InstanceStatus{}, err
	}
	return InstanceStatus{
		Connected: result.Data.Connected,
		LoggedIn:  result.Data.LoggedIn,
		Name:      result.Data.Name,
	}, nil
}

// FetchInfo consulta GET /instance/info/:id — rota administrativa.
//
// A chave do bot só alcança esta rota se coincidir com a GLOBAL_API_KEY do
// evolution-go (verificado nesta instalação: é o caso). Se não coincidir, o
// erro vem como StatusError com Code 401/403, e o healer (DT-53) trata isso
// como estado NAO_AUTORIZADA — nunca como "sessão caiu", que exigiria uma
// remediação completamente diferente.
func (a *EvolutionAdapter) FetchInfo(ctx context.Context, instanceID string) (InstanceInfo, error) {
	url := fmt.Sprintf("%s/instance/info/%s", a.BaseURL, instanceID)

	var result struct {
		Data struct {
			Jid              string `json:"jid"`
			Connected        bool   `json:"connected"`
			DisconnectReason string `json:"disconnect_reason"`
			Events           string `json:"events"`
		} `json:"data"`
	}
	if err := a.getJSON(ctx, url, &result); err != nil {
		return InstanceInfo{}, err
	}
	return InstanceInfo{
		Jid:              result.Data.Jid,
		Connected:        result.Data.Connected,
		DisconnectReason: result.Data.DisconnectReason,
		Events:           result.Data.Events,
	}, nil
}

// ForceReconnect chama POST /instance/forcereconnect/:id — rota administrativa,
// e a única forma confirmada de recuperar uma sessão cujo socket caiu sem
// derrubar o cliente do pool (POST /instance/reconnect recusa esse caso
// específico com "client disconnected", sem nunca chamar ReconnectClient).
//
// `number` é exigido pela API mas é inofensivo aqui: no evolution-go,
// ForceUpdateJid só reescreve o jid quando a instância NÃO tem um — e o healer
// (DT-53) só chama este método depois de confirmar via FetchInfo que o Jid
// está preenchido. Ou seja, o parâmetro nunca tem efeito no caminho que o
// healer usa; ele existe só porque a API exige o campo no corpo.
//
// O status HTTP da resposta NÃO deve ser usado para decidir sucesso ou
// falha: o serviço dorme só 2s antes de responder, e a conexão real leva bem
// mais que isso — uma reconexão bem-sucedida frequentemente devolve 500
// "failed to connect" mesmo assim. Quem decide é uma nova consulta a
// FetchStatus depois, nunca o retorno deste método.
func (a *EvolutionAdapter) ForceReconnect(ctx context.Context, instanceID, number string) error {
	url := fmt.Sprintf("%s/instance/forcereconnect/%s", a.BaseURL, instanceID)
	payload := map[string]interface{}{"number": number}
	return a.doRequestCtx(ctx, http.MethodPost, url, payload)
}

// getJSON faz um GET com contexto e decodifica a resposta em out.
func (a *EvolutionAdapter) getJSON(ctx context.Context, url string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("apikey", a.APIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &StatusError{Code: resp.StatusCode, Body: string(body)}
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}
	return nil
}

// doRequestCtx é a variante context-aware de doRequest.
//
// doRequest (abaixo) não foi tocado: está em produção há mais tempo e mexer
// nele arriscaria os call sites existentes (SendMessage, SendButton, etc.) sem
// necessidade — o healer é o único chamador que precisa respeitar
// cancelamento de contexto até aqui.
func (a *EvolutionAdapter) doRequestCtx(ctx context.Context, method, url string, payload interface{}) error {
	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.APIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return &StatusError{Code: resp.StatusCode, Body: string(respBody)}
	}
	return nil
}

// ConfigureWebhooks ensures that only the correct webhook is registered for the instance.
// It fetches existing webhooks and sets the new one, effectively overriding or cleaning up old ones.
func (a *EvolutionAdapter) ConfigureWebhooks(webhookURL string) error {
	log.Printf("🔄 [Evolution] Configurando webhooks para a instância: %s...", a.InstanceName)

	// Payload for setting the webhook
	payload := map[string]interface{}{
		"url":     webhookURL,
		"enabled": true,
		"events": []string{
			"MESSAGE",
			"SEND_MESSAGE",
			"CONNECTION",
			// QRCODE (DT-53): sem esta assinatura, um fluxo de QR aberto pelo
			// evolution-go seria invisível para o bot — o self-heal nunca saberia
			// que precisa se desligar. Com ela, ExtractEventType detecta o evento
			// "QRCode" e o healer trata como disjuntor: para de agir e alerta.
			"QRCODE",
		},
	}

	// Evolution API's /webhook/set usually overrides the existing configuration for the instance.
	// To be extra safe as requested, we use the set endpoint which guarantees the state.
	url := fmt.Sprintf("%s/webhook/set/%s", a.BaseURL, a.InstanceName)

	err := a.doRequest(http.MethodPost, url, payload)
	if err != nil {
		return fmt.Errorf("failed to set webhook: %w", err)
	}

	log.Printf("✅ [Evolution] Webhook configurado com sucesso: %s", webhookURL)
	return nil
}

// ConfigureWebhooksWithRetry calls ConfigureWebhooks with a retry mechanism.
func (a *EvolutionAdapter) ConfigureWebhooksWithRetry(webhookURL string, maxRetries int, interval time.Duration) error {
	var err error
	for i := 1; i <= maxRetries; i++ {
		log.Printf("🔄 [Evolution] Tentativa %d/%d de configurar webhook...", i, maxRetries)
		err = a.ConfigureWebhooks(webhookURL)
		if err == nil {
			log.Printf("✅ [Evolution] Webhook configurado com sucesso após %d tentativas", i)
			return nil
		}
		log.Printf("⚠️ [Evolution] Tentativa %d falhou: %v. Retentando em %v...", i, err, interval)
		time.Sleep(interval)
	}
	log.Printf("❌ [Evolution] Falha final ao configurar webhook após %d tentativas: %v", maxRetries, err)
	return fmt.Errorf("failed to configure webhooks after %d retries: %w", maxRetries, err)
}

// doRequest helper to handle HTTP requests and error responses.
func (a *EvolutionAdapter) doRequest(method, url string, payload interface{}) error {
	var bodyReader io.Reader
	if payload != nil {
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("failed to marshal payload: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", a.APIKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("evolution api error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// Webhook handling

// EvolutionWebhook represents the top-level webhook structure (compatible with Go version).
type EvolutionWebhook struct {
	Event string `json:"event"`
	Data  struct {
		Info struct {
			ID        string `json:"ID"`
			Chat      string `json:"Chat"`
			Sender    string `json:"Sender"`
			IsFromMe  bool   `json:"IsFromMe"`
			Timestamp string `json:"Timestamp"`
			Type      string `json:"Type"`
		} `json:"info"`
		Message json.RawMessage `json:"message"`
	} `json:"data"`
}

// Eventos de CONNECTION que interessam ao self-heal (DT-53) — os únicos que
// justificam acordar a sondagem antes do próximo tick de 60s.
//
// StreamReplaced somado depois do Estágio 3: o evolution-go passou a reportar
// esse evento em vez de engoli-lo em silêncio (era exatamente a causa do
// DT-52 — 24min fora do ar sem nenhum aviso). O healer trata como suspeita
// elevada quando chega por este caminho.
var eventosDeConexao = map[string]bool{
	"Disconnected":   true,
	"ConnectFailure": true,
	"LoggedOut":      true,
	"Connected":      true,
	"QRCode":         true,
	"StreamReplaced": true,
}

// ExtractEventType lê só o campo "event" do payload bruto do webhook, sem
// decodificar o resto.
//
// Existe porque ParseWebhook descarta de propósito tudo que não é mensagem
// (webhook.go:471-473) — correto para o caminho de mensagens, mas isso também
// jogava fora eventos de CONNECTION que o evolution-go já entrega e que o
// self-heal precisa ver. Em vez de sobrecarregar ParseWebhook com uma
// responsabilidade que não é dele, esta função fica isolada e é chamada à
// parte, no handler do webhook.
func ExtractEventType(rawBody []byte) string {
	var envelope struct {
		Event string `json:"event"`
	}
	_ = json.Unmarshal(rawBody, &envelope)
	if !eventosDeConexao[envelope.Event] {
		return ""
	}
	return envelope.Event
}

// ParseWebhook converts an Evolution API webhook payload into a ports.IncomingMessage.
func ParseWebhook(rawBody []byte) (*ports.IncomingMessage, error) {
	var payload EvolutionWebhook
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal webhook: %w", err)
	}

	// Evolution Go uses "Message", Legacy Evolution Node uses "messages.upsert", and buttons response event
	if payload.Event != "messages.upsert" && payload.Event != "Message" && payload.Event != "ButtonClick" && payload.Event != "BUTTON_CLICK" {
		return nil, nil // Ignored event
	}

	if payload.Event == "ButtonClick" || payload.Event == "BUTTON_CLICK" {
		var btnPayload struct {
			Data struct {
				ButtonId   string `json:"buttonId"`
				ButtonText string `json:"buttonText"`
				Key        struct {
					RemoteJid string `json:"remoteJid"`
					FromMe    bool   `json:"fromMe"`
					Id        string `json:"id"`
				} `json:"key"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rawBody, &btnPayload); err != nil {
			return nil, fmt.Errorf("failed to unmarshal button click webhook: %w", err)
		}

		body := btnPayload.Data.ButtonText
		if body == "" {
			body = btnPayload.Data.ButtonId
		}

		return &ports.IncomingMessage{
			ID:         btnPayload.Data.Key.Id,
			From:       btnPayload.Data.Key.RemoteJid,
			Body:       body,
			IsFromMe:   btnPayload.Data.Key.FromMe,
			Timestamp:  time.Now(),
			Type:       "button_click",
			IsAudio:    false,
			RawPayload: rawBody,
		}, nil
	}

	// Extract message object
	var internalMsg struct {
		Conversation        string `json:"conversation"`
		ExtendedTextMessage struct {
			Text string `json:"text"`
		} `json:"extendedTextMessage"`
		AudioMessage interface{} `json:"audioMessage"`
		PtvMessage   interface{} `json:"ptvMessage"`
	}
	if err := json.Unmarshal(payload.Data.Message, &internalMsg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal internal message: %w", err)
	}

	// Extract body
	body := internalMsg.Conversation
	if body == "" && internalMsg.ExtendedTextMessage.Text != "" {
		body = internalMsg.ExtendedTextMessage.Text
	}

	// Extract Sender/Chat correctly
	from := payload.Data.Info.Chat
	if from == "" {
		from = payload.Data.Info.Sender
	}

	// Parse Timestamp
	ts := time.Now()
	if payload.Data.Info.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, payload.Data.Info.Timestamp); err == nil {
			ts = t
		}
	}

	// If timestamp is still zero or very old, use current time
	if ts.IsZero() {
		ts = time.Now()
	}

	// Detect Message Type
	msgType := strings.ToLower(payload.Data.Info.Type)
	isAudio := msgType == "audiomessage" || msgType == "ptvmessage" || internalMsg.AudioMessage != nil || internalMsg.PtvMessage != nil

	if isAudio {
		log.Printf("🎙️ [Evolution] Detectada mensagem de áudio (Tipo: %s)", msgType)
		if msgType == "" {
			msgType = "audioMessage" // Force standard type for internal routing
		}
	}

	return &ports.IncomingMessage{
		ID:                      payload.Data.Info.ID,
		From:                    from,
		Body:                    body,
		IsFromMe:                payload.Data.Info.IsFromMe,
		Timestamp:               ts,
		Type:                    msgType,
		IsAudio:                 isAudio,
		RespondWithAudio:        isAudio,
		HasExplicitResponseMode: true,
		RawPayload:              payload.Data.Message,
	}, nil
}
