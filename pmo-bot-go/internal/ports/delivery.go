package ports

import (
	"context"
	"fmt"
	"sync"
)

// DeliveryManager roteia mensagens para o canal correto
type DeliveryManager struct {
	adapters map[ChannelType]ChannelSender
	mu       sync.RWMutex
}

func NewDeliveryManager() *DeliveryManager {
	return &DeliveryManager{
		adapters: make(map[ChannelType]ChannelSender),
	}
}

// RegisterAdapter registra um adapter para um canal
func (d *DeliveryManager) RegisterAdapter(channel ChannelType, sender ChannelSender) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.adapters[channel] = sender
}

// defaultChannel preenche um ChannelType vazio como WhatsApp.
//
// Nenhum ponto do código de produção define env.Channel hoje — é sempre a
// string vazia. Sem este fallback, ligar o DeliveryManager no lugar da
// injeção direta do adapter derrubaria toda mensagem de saída do bot, porque
// "" nunca bate com nenhuma chave registrada. WhatsApp é o único canal em
// produção; o fallback deixa de ser necessário assim que os pontos de saída
// passarem a preencher env.Channel explicitamente.
func defaultChannel(channel ChannelType) ChannelType {
	if channel == "" {
		return ChannelWhatsApp
	}
	return channel
}

// Send routeia o envelope de envio
func (d *DeliveryManager) Send(ctx context.Context, env OutboundEnvelope) error {
	channel := defaultChannel(env.Channel)

	d.mu.RLock()
	adapter, exists := d.adapters[channel]
	d.mu.RUnlock()

	if !exists {
		return fmt.Errorf("DeliveryManager: no adapter registered for channel %s", channel)
	}

	// TODO: B.8 Idempotency - check redis if (env.Channel, env.ID) was already sent

	return adapter.Send(ctx, env)
}

// SendTyping routeia o envio de typing
func (d *DeliveryManager) SendTyping(ctx context.Context, channel ChannelType, to string) error {
	channel = defaultChannel(channel)

	d.mu.RLock()
	adapter, exists := d.adapters[channel]
	d.mu.RUnlock()

	if !exists {
		return fmt.Errorf("DeliveryManager: no adapter registered for channel %s", channel)
	}

	return adapter.SendTyping(ctx, channel, to)
}

// DownloadMedia roteia o download de mídia.
//
// A assinatura (sem parâmetro de canal) é a exigida pela interface
// ChannelSender, que o próprio DeliveryManager também precisa satisfazer
// para poder substituir o adapter direto nos pontos que hoje recebem um
// ChannelSender. Sem um canal explícito para escolher o adapter, cai no
// mesmo fallback dos outros métodos — hoje sempre WhatsApp, o único
// registrado.
func (d *DeliveryManager) DownloadMedia(ctx context.Context, mediaID string, rawPayload []byte) ([]byte, string, error) {
	channel := defaultChannel("")

	d.mu.RLock()
	adapter, exists := d.adapters[channel]
	d.mu.RUnlock()

	if !exists {
		return nil, "", fmt.Errorf("DeliveryManager: no adapter registered for channel %s", channel)
	}

	return adapter.DownloadMedia(ctx, mediaID, rawPayload)
}
