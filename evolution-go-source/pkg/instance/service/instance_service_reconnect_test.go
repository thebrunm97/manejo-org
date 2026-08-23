package instance_service

// Teste do F1 (DT-53, Estágio 3): Reconnect deixou de checar
// ensureClientConnected antes de delegar para ReconnectClient. Esse gatekeeper
// devolvia "client disconnected" exatamente no caso mais comum de queda — o
// cliente existe no pool mas o socket morreu — e ReconnectClient nunca chegava
// a ser chamado. Este teste prova que a chamada agora é direta e incondicional.

import (
	"errors"
	"testing"

	instance_model "github.com/EvolutionAPI/evolution-go/pkg/instance/model"
	poll_service "github.com/EvolutionAPI/evolution-go/pkg/poll/service"
	whatsmeow_service "github.com/EvolutionAPI/evolution-go/pkg/whatsmeow/service"
)

// fakeWhatsmeowService satisfaz whatsmeow_service.WhatsmeowService sem tocar
// rede nem banco — só registra o que foi chamado.
type fakeWhatsmeowService struct {
	reconnectCalls []string
	reconnectErr   error
}

func (f *fakeWhatsmeowService) StartClient(*whatsmeow_service.ClientData)            {}
func (f *fakeWhatsmeowService) ConnectOnStartup(string)                              {}
func (f *fakeWhatsmeowService) StartInstance(string) error                           { return nil }
func (f *fakeWhatsmeowService) ClearInstanceCache(string, string) error              { return nil }
func (f *fakeWhatsmeowService) SendToGlobalQueues(string, []byte, string)            {}
func (f *fakeWhatsmeowService) ForceUpdateJid(string, string) error                  { return nil }
func (f *fakeWhatsmeowService) UpdateInstanceSettings(string) error                  { return nil }
func (f *fakeWhatsmeowService) UpdateInstanceAdvancedSettings(string) error          { return nil }
func (f *fakeWhatsmeowService) GetPollService() poll_service.PollService             { return nil }
func (f *fakeWhatsmeowService) CallWebhook(*instance_model.Instance, string, []byte) {}

func (f *fakeWhatsmeowService) ReconnectClient(instanceId string) error {
	f.reconnectCalls = append(f.reconnectCalls, instanceId)
	return f.reconnectErr
}

// O teste central do F1: mesmo sem nenhum client no pool (o cenário mais
// severo, que antes exigia ensureClientConnected chamar StartInstance
// primeiro), Reconnect chama ReconnectClient direto — que já sabe lidar com
// "sem client", "client conectado" e "client com socket morto" sozinho.
func TestReconnect_ChamaReconnectClientDiretoSemGatekeeper(t *testing.T) {
	fake := &fakeWhatsmeowService{}
	svc := instances{whatsmeowService: fake}

	err := svc.Reconnect(&instance_model.Instance{Id: "manejo-org"})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if len(fake.reconnectCalls) != 1 || fake.reconnectCalls[0] != "manejo-org" {
		t.Errorf("ReconnectClient deveria ter sido chamado 1x com \"manejo-org\", chamadas=%v", fake.reconnectCalls)
	}
}

func TestReconnect_PropagaErroDeReconnectClient(t *testing.T) {
	fake := &fakeWhatsmeowService{reconnectErr: errors.New("falha simulada")}
	svc := instances{whatsmeowService: fake}

	if err := svc.Reconnect(&instance_model.Instance{Id: "manejo-org"}); err == nil {
		t.Fatal("deveria propagar o erro de ReconnectClient")
	}
}
