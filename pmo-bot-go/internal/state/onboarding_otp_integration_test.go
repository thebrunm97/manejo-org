package state

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// TestOnboardingOTP_Integration simula o cenário do DT-126:
// 1. Usuário envia OTP.
// 2. Telefone deve ser gravado na tabela profiles.
// 3. Nova mensagem chega e roteador deve conseguir identificar o perfil via GetProfileByPhone.
func TestOnboardingOTP_Integration(t *testing.T) {
	var profilesPatchCalled bool
	var linkCalled bool
	var getProfileByPhoneCalled bool

	// 1. Mock do servidor Supabase para interceptar as chamadas REST/Admin
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock VerifyEmailOTP
		if r.URL.Path == "/auth/v1/verify" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"user": {"id": "test-user-id"}}`))
			return
		}

		// Mock LinkPhoneToUser
		if r.URL.Path == "/auth/v1/admin/users/test-user-id" && r.Method == http.MethodPut {
			linkCalled = true
			w.WriteHeader(http.StatusOK)
			return
		}

		// Mock GetProfileByPhone
		if r.URL.Path == "/rest/v1/profiles" && r.Method == http.MethodGet {
			getProfileByPhoneCalled = true
			phone := r.URL.Query().Get("telefone")
			if phone == "eq.5511999999999" {
				if profilesPatchCalled { // Retorna perfil se já foi patcheado (corrigindo DT-126)
					w.WriteHeader(http.StatusOK)
					w.Write([]byte(`[{"id": "test-user-id", "telefone": "5511999999999"}]`))
				} else { // Retorna vazio, simulando roteador não encontrando
					w.WriteHeader(http.StatusOK)
					w.Write([]byte(`[]`))
				}
			} else {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[]`))
			}
			return
		}

		// Mock UpdateProfilePhone
		if r.URL.Path == "/rest/v1/profiles" && r.Method == http.MethodPatch {
			profilesPatchCalled = true
			w.WriteHeader(http.StatusOK)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	// 2. Setup do handler e dependências
	sbClient, err := supabase.NewClient(supabase.Config{
		URL: server.URL,
		Key: "test-key",
	})
	require.NoError(t, err)

	historyManager := history.NewManager(45*time.Minute, 1000)
	
	ctx := context.Background()
	phone := "5511999999999"
	email := "test@example.com"
	
	// Simula a máquina de estados aguardando os 6 dígitos do OTP por e-mail
	historyManager.SetFSMState(phone, StateAguardandoOTPEmail, map[string]interface{}{"email": email}, nil)

	msg := ports.IncomingEnvelope{
		From: phone,
		Body: "123456", // Mock do token
	}

	// Mock wpClient
	dummyWp := dummyMessageSender{}
	dummyLlm := dummyLLMClient{}

	// 3. Act: O usuário envia o código OTP.
	res, handled := HandleOnboarding(ctx, msg, phone, msg.Body, false, sbClient, &dummyWp, nil, &dummyLlm, historyManager)
	
	// 4. Assert
	assert.True(t, handled)
	assert.True(t, res.Success)
	assert.Equal(t, "conta_vinculada", res.Reason)

	assert.True(t, linkCalled, "LinkPhoneToUser deveria ter atualizado auth.users via Admin API")
	assert.True(t, profilesPatchCalled, "UpdateProfilePhone deveria ter sido chamado para persistir na tabela profiles")
	
	// O estado de onboarding deve ter sido zerado
	estado, _, _ := historyManager.GetFSMState(phone)
	assert.Equal(t, "", estado)

	// Simula o comportamento do Roteador para a *próxima* mensagem (DT-126 exige que isso funcione)
	profile, err := sbClient.GetProfileByPhone(phone)
	assert.NoError(t, err, "Roteador deveria encontrar o usuário sem erro")
	assert.NotNil(t, profile)
	assert.Equal(t, "test-user-id", profile.ID)
	assert.True(t, getProfileByPhoneCalled)
}

type dummyLLMClient struct{}

func (d *dummyLLMClient) GenerateContent(ctx context.Context, req llm.ContentRequest) (llm.RespostaAgnostica, error) { return llm.RespostaAgnostica{}, nil }
func (d *dummyLLMClient) ClassifyIntent(ctx context.Context, text string) (llm.UnifiedIntentResult, string, error) { return llm.UnifiedIntentResult{}, "", nil }
func (d *dummyLLMClient) AskSimple(ctx context.Context, question string, systemInstruction string) (string, string, error) { return "", "", nil }
func (d *dummyLLMClient) DescribeImage(ctx context.Context, imageBytes []byte, mimeType string) (string, string, error) { return "", "", nil }
func (d *dummyLLMClient) ModelName() string { return "dummy" }

// dummyMessageSender migrado para ChannelSender junto com a Fase B do
// multicanal (ver mockSender em handlers_manejo_test.go para o mock que
// captura o texto enviado; este aqui só precisa satisfazer a interface).
type dummyMessageSender struct{}

func (d *dummyMessageSender) Send(ctx context.Context, env ports.OutboundEnvelope) error {
	return nil
}
func (d *dummyMessageSender) SendTyping(ctx context.Context, channel ports.ChannelType, to string) error {
	return nil
}
func (d *dummyMessageSender) DownloadMedia(ctx context.Context, mediaID string, rawPayload []byte) ([]byte, string, error) {
	return nil, "", nil
}

