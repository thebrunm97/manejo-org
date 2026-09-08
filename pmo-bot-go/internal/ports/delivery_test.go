package ports

import (
	"context"
	"testing"
)

// fakeChannelAdapter é um ChannelSender mínimo, sem rede, só para provar o
// roteamento do DeliveryManager.
type fakeChannelAdapter struct {
	sent          int
	typed         int
	downloaded    int
	lastEnvelope  OutboundEnvelope
	lastToChannel ChannelType
}

func (f *fakeChannelAdapter) Send(ctx context.Context, env OutboundEnvelope) error {
	f.sent++
	f.lastEnvelope = env
	return nil
}
func (f *fakeChannelAdapter) SendTyping(ctx context.Context, channel ChannelType, to string) error {
	f.typed++
	f.lastToChannel = channel
	return nil
}
func (f *fakeChannelAdapter) DownloadMedia(ctx context.Context, mediaID string, rawPayload []byte) ([]byte, string, error) {
	f.downloaded++
	return nil, "", nil
}

// TestDeliveryManager_CanalVazioCaiParaWhatsApp cobre o fallback central
// desta mudança: nenhum ponto de saída em produção define env.Channel hoje,
// então sem este fallback ligar o DeliveryManager derrubaria toda mensagem
// (nenhum adapter registrado para o canal "").
func TestDeliveryManager_CanalVazioCaiParaWhatsApp(t *testing.T) {
	dm := NewDeliveryManager()
	adapter := &fakeChannelAdapter{}
	dm.RegisterAdapter(ChannelWhatsApp, adapter)

	if err := dm.Send(context.Background(), OutboundEnvelope{To: "5511999999999", Text: "oi"}); err != nil {
		t.Fatalf("Send com canal vazio não deveria falhar: %v", err)
	}
	if adapter.sent != 1 {
		t.Errorf("esperava 1 envio roteado ao adapter WhatsApp, got %d", adapter.sent)
	}

	if err := dm.SendTyping(context.Background(), "", "5511999999999"); err != nil {
		t.Fatalf("SendTyping com canal vazio não deveria falhar: %v", err)
	}
	if adapter.typed != 1 || adapter.lastToChannel != ChannelWhatsApp {
		t.Errorf("SendTyping deveria rotear para ChannelWhatsApp, got typed=%d channel=%q", adapter.typed, adapter.lastToChannel)
	}

	if _, _, err := dm.DownloadMedia(context.Background(), "msg-1", nil); err != nil {
		t.Fatalf("DownloadMedia não deveria falhar: %v", err)
	}
	if adapter.downloaded != 1 {
		t.Errorf("esperava 1 download roteado, got %d", adapter.downloaded)
	}
}

// TestDeliveryManager_CanalExplicitoRoteiaParaOAdapterCerto garante que
// declarar env.Channel — o que nenhum call site faz ainda, mas passará a
// fazer quando um segundo canal existir — continua funcionando junto com o
// fallback acima.
func TestDeliveryManager_CanalExplicitoRoteiaParaOAdapterCerto(t *testing.T) {
	dm := NewDeliveryManager()
	whatsapp := &fakeChannelAdapter{}
	web := &fakeChannelAdapter{}
	dm.RegisterAdapter(ChannelWhatsApp, whatsapp)
	dm.RegisterAdapter(ChannelWeb, web)

	if err := dm.Send(context.Background(), OutboundEnvelope{Channel: ChannelWeb, To: "user-1", Text: "oi"}); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if web.sent != 1 || whatsapp.sent != 0 {
		t.Errorf("mensagem com Channel=web deveria ir só para o adapter web, got web=%d whatsapp=%d", web.sent, whatsapp.sent)
	}
}

// TestDeliveryManager_CanalSemAdapterFalha garante que a ausência de
// registro continua um erro explícito, não um silêncio.
func TestDeliveryManager_CanalSemAdapterFalha(t *testing.T) {
	dm := NewDeliveryManager()
	if err := dm.Send(context.Background(), OutboundEnvelope{Channel: ChannelTelegram, To: "x"}); err == nil {
		t.Error("Send para canal sem adapter registrado deveria falhar")
	}
}
