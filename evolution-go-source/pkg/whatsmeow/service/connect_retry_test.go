package whatsmeow_service

// Testes do F2/F3 (DT-53, Estágio 3). retryConnect não é testado diretamente
// aqui: exige um *whatsmeow.Client real conectando de verdade, e o fork não
// tem nenhuma camada de abstração sobre isso hoje — introduzir uma só para
// testar arriscaria mais do que os dois edits em si (mesma cautela do plano
// original sobre não refatorar o fork além do necessário). O que É testável
// sem rede nem whatsmeow real — o schedule de backoff e o efeito colateral de
// reportarFalhaDeConexao (persistir o motivo + disparar o webhook que o
// self-heal do pmo-bot-go escuta) — está coberto abaixo.

import (
	"errors"
	"testing"
	"time"

	config "github.com/EvolutionAPI/evolution-go/pkg/config"
	instance_model "github.com/EvolutionAPI/evolution-go/pkg/instance/model"
	logger_wrapper "github.com/EvolutionAPI/evolution-go/pkg/logger"
)

// instance_repository_stub implementa InstanceRepository inteira com no-ops,
// pra fakeInstanceRepository só precisar sobrescrever UpdateConnected — o
// único método que reportarFalhaDeConexao de fato usa.
type instance_repository_stub struct{}

func (instance_repository_stub) Create(instance_model.Instance) (*instance_model.Instance, error) {
	return nil, nil
}
func (instance_repository_stub) GetInstanceByID(string) (*instance_model.Instance, error) {
	return nil, nil
}
func (instance_repository_stub) GetConnectedInstanceByID(string) (*instance_model.Instance, error) {
	return nil, nil
}
func (instance_repository_stub) GetInstanceByToken(string) (*instance_model.Instance, error) {
	return nil, nil
}
func (instance_repository_stub) GetInstanceByName(string) (*instance_model.Instance, error) {
	return nil, nil
}
func (instance_repository_stub) Update(*instance_model.Instance) error      { return nil }
func (instance_repository_stub) UpdateConnected(string, bool, string) error { return nil }
func (instance_repository_stub) UpdateQrcode(string, string) error          { return nil }
func (instance_repository_stub) UpdateProxy(string, string) error           { return nil }
func (instance_repository_stub) UpdateJid(string, string) error             { return nil }
func (instance_repository_stub) GetAllConnectedInstances() ([]*instance_model.Instance, error) {
	return nil, nil
}
func (instance_repository_stub) GetAllConnectedInstancesByClientName(string) ([]*instance_model.Instance, error) {
	return nil, nil
}
func (instance_repository_stub) GetAll(string) ([]*instance_model.Instance, error) { return nil, nil }
func (instance_repository_stub) Delete(string) error                               { return nil }
func (instance_repository_stub) GetAdvancedSettings(string) (*instance_model.AdvancedSettings, error) {
	return nil, nil
}
func (instance_repository_stub) UpdateAdvancedSettings(string, *instance_model.AdvancedSettings) error {
	return nil
}

// O backoff precisa crescer e ficar num teto razoável — nenhuma tentativa
// sub-5s (martelaria a Meta) nem um total absurdo (o incidente real do DT-56
// já foi de 36min; o schedule não deveria sozinho superar isso).
func TestConnectRetrySchedule_CrescenteEDentroDoRazoavel(t *testing.T) {
	if len(connectRetrySchedule) != 5 {
		t.Fatalf("len(connectRetrySchedule) = %d, queria 5", len(connectRetrySchedule))
	}
	if connectRetrySchedule[0] != 5*time.Second {
		t.Errorf("primeira tentativa = %s, queria 5s (retentativas sub-5s martelam a Meta)", connectRetrySchedule[0])
	}

	var total time.Duration
	for i, d := range connectRetrySchedule {
		total += d
		if i > 0 && d <= connectRetrySchedule[i-1] {
			t.Errorf("schedule não é estritamente crescente em i=%d: %s <= %s", i, d, connectRetrySchedule[i-1])
		}
	}
	if total > 5*time.Minute {
		t.Errorf("soma do schedule = %s, maior que 5min — tempo demais gastado no fork antes do self-heal do bot poder agir", total)
	}
}

// fakeInstanceRepository só implementa o que reportarFalhaDeConexao usa;
// qualquer outra chamada é um bug no teste, não algo a mascarar em silêncio.
type fakeInstanceRepository struct {
	instance_repository_stub
	updateConnectedChamadas []struct {
		userId, reason string
		status         bool
	}
}

func (f *fakeInstanceRepository) UpdateConnected(userId string, status bool, disconnectReason string) error {
	f.updateConnectedChamadas = append(f.updateConnectedChamadas, struct {
		userId, reason string
		status         bool
	}{userId, disconnectReason, status})
	return nil
}

// fakeProducer registra o que foi produzido — usado como webhookProducer.
type fakeProducer struct {
	produzidos []struct {
		queueName, webhookUrl, userID string
		payload                       []byte
	}
}

func (f *fakeProducer) Produce(queueName string, payload []byte, webhookUrl string, userID string) error {
	f.produzidos = append(f.produzidos, struct {
		queueName, webhookUrl, userID string
		payload                       []byte
	}{queueName, webhookUrl, userID, payload})
	return nil
}
func (f *fakeProducer) CreateGlobalQueues() error { return nil }

// A sessão real de produção tem Events="MESSAGE,SEND_MESSAGE,CONNECTION"
// (confirmado ao vivo durante o DT-56) — sem "CONNECTION" na assinatura,
// CallWebhook descarta o evento em silêncio e o detector por webhook do
// Estágio 2 nunca saberia da desistência.
func TestReportarFalhaDeConexao_PersisteEDisparaWebhookConnectFailure(t *testing.T) {
	repo := &fakeInstanceRepository{}
	producer := &fakeProducer{}
	w := whatsmeowService{
		instanceRepository: repo,
		webhookProducer:    producer,
		config:             &config.Config{},
		loggerWrapper:      logger_wrapper.NewLoggerManager(&config.Config{}),
	}

	instance := &instance_model.Instance{
		Id:     "manejo-org",
		Events: "MESSAGE,SEND_MESSAGE,CONNECTION",
	}

	w.reportarFalhaDeConexao(instance, errors.New("dial tcp: lookup web.whatsapp.com: i/o timeout"))

	if len(repo.updateConnectedChamadas) != 1 {
		t.Fatalf("UpdateConnected chamado %d vezes, queria 1", len(repo.updateConnectedChamadas))
	}
	chamada := repo.updateConnectedChamadas[0]
	if chamada.status != false {
		t.Errorf("status persistido = %v, queria false", chamada.status)
	}
	if chamada.reason == "" {
		t.Error("disconnect_reason persistido vazio — o self-heal do bot usa isso pra diagnóstico")
	}

	if len(producer.produzidos) != 1 {
		t.Fatalf("webhook produzido %d vezes, queria exatamente 1 (evento ConnectFailure)", len(producer.produzidos))
	}
	payload := string(producer.produzidos[0].payload)
	if !contains_test(payload, `"event":"ConnectFailure"`) {
		t.Errorf("payload não contém event=ConnectFailure: %s", payload)
	}
}

// Sem "CONNECTION" assinado, o webhook não pode ser disparado — provaria que
// reportarFalhaDeConexao ignora a filtragem de assinatura do CallWebhook, o
// que seria uma regressão de comportamento silenciosa em qualquer instalação
// que não assine CONNECTION.
func TestReportarFalhaDeConexao_RespeitaFiltroDeAssinatura(t *testing.T) {
	repo := &fakeInstanceRepository{}
	producer := &fakeProducer{}
	w := whatsmeowService{
		instanceRepository: repo,
		webhookProducer:    producer,
		config:             &config.Config{},
		loggerWrapper:      logger_wrapper.NewLoggerManager(&config.Config{}),
	}

	instance := &instance_model.Instance{Id: "manejo-org", Events: "MESSAGE"}
	w.reportarFalhaDeConexao(instance, errors.New("timeout"))

	if len(producer.produzidos) != 0 {
		t.Errorf("webhook disparado mesmo sem CONNECTION assinado: %d vezes", len(producer.produzidos))
	}
	// Mas o estado ainda deve ser persistido — a próxima sondagem de status do
	// self-heal precisa ver isso, mesmo sem o push.
	if len(repo.updateConnectedChamadas) != 1 {
		t.Errorf("UpdateConnected deveria rodar independente do webhook, chamadas=%d", len(repo.updateConnectedChamadas))
	}
}

func contains_test(s, substr string) bool {
	return len(s) >= len(substr) && (func() bool {
		for i := 0; i+len(substr) <= len(s); i++ {
			if s[i:i+len(substr)] == substr {
				return true
			}
		}
		return false
	})()
}
