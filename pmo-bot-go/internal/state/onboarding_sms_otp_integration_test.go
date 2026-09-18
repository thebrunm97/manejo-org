package state

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// TestOnboardingSMSOTP_Integration percorre o vínculo alternativo por SMS
// (pensado pra mercados com baixo acesso a e-mail, ex. Moçambique) de ponta a
// ponta: escolha do canal -> telefone cadastrado -> OTP por SMS -> vínculo do
// WhatsApp atual à conta encontrada. Só roda com SMS_OTP_ENABLED=true; sem a
// env, o fluxo é idêntico ao de antes (só e-mail) — ver TestOnboardingOTP_Integration.
func TestOnboardingSMSOTP_Integration(t *testing.T) {
	t.Setenv("SMS_OTP_ENABLED", "true")

	var attachCalled, linkCalled, otpSentCalled, profilePatchCalled bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		// GetProfileByPhone: localiza a conta pelo telefone CADASTRADO (não o WhatsApp atual).
		case r.URL.Path == "/rest/v1/profiles" && r.Method == http.MethodGet:
			phone := r.URL.Query().Get("telefone")
			if phone == "eq.258841234567" {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[{"id": "test-user-id", "telefone": "258841234567"}]`))
				return
			}
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`))

		// AttachUnconfirmedPhone e LinkPhoneToUser batem no mesmo endpoint;
		// distinguidos pelo valor de phone_confirm no corpo.
		case r.URL.Path == "/auth/v1/admin/users/test-user-id" && r.Method == http.MethodPut:
			body, _ := io.ReadAll(r.Body)
			if strings.Contains(string(body), `"phone_confirm":false`) {
				attachCalled = true
			} else if strings.Contains(string(body), `"phone_confirm":true`) {
				linkCalled = true
			}
			w.WriteHeader(http.StatusOK)

		// SendPhoneOTP
		case r.URL.Path == "/auth/v1/otp" && r.Method == http.MethodPost:
			otpSentCalled = true
			w.WriteHeader(http.StatusOK)

		// VerifyPhoneOTP
		case r.URL.Path == "/auth/v1/verify" && r.Method == http.MethodPost:
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"user": {"id": "test-user-id"}}`))

		// UpdateProfilePhone
		case r.URL.Path == "/rest/v1/profiles" && r.Method == http.MethodPatch:
			profilePatchCalled = true
			w.WriteHeader(http.StatusOK)

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	sbClient, err := supabase.NewClient(supabase.Config{URL: server.URL, Key: "test-key"})
	require.NoError(t, err)

	historyManager := history.NewManager(45*time.Minute, 1000)
	ctx := context.Background()
	phoneWhatsApp := "5511999999999" // número de onde a mensagem chega agora
	telefoneCadastro := "258841234567"

	dummyWp := dummyMessageSender{}
	dummyLlm := dummyLLMClient{}

	// 1. Escolhe SMS.
	historyManager.SetFSMState(phoneWhatsApp, StateEscolhendoCanalVinculo, nil, nil)
	msg := ports.IncomingEnvelope{From: phoneWhatsApp, Body: "SMS"}
	res, handled := HandleOnboarding(ctx, msg, phoneWhatsApp, msg.Body, false, sbClient, &dummyWp, nil, &dummyLlm, historyManager)
	assert.True(t, handled)
	assert.Equal(t, "escolheu_sms", res.Reason)
	estado, _, _ := historyManager.GetFSMState(phoneWhatsApp)
	assert.Equal(t, StateAguardandoTelefoneVinculo, estado)

	// 2. Informa o telefone cadastrado na conta (diferente do WhatsApp atual).
	msg = ports.IncomingEnvelope{From: phoneWhatsApp, Body: telefoneCadastro}
	res, handled = HandleOnboarding(ctx, msg, phoneWhatsApp, msg.Body, false, sbClient, &dummyWp, nil, &dummyLlm, historyManager)
	assert.True(t, handled)
	assert.Equal(t, "otp_sms_enviado", res.Reason)
	assert.True(t, attachCalled, "AttachUnconfirmedPhone deveria ter sido chamado antes do envio do OTP")
	assert.True(t, otpSentCalled, "SendPhoneOTP deveria ter sido chamado")
	estado, _, _ = historyManager.GetFSMState(phoneWhatsApp)
	assert.Equal(t, StateAguardandoOTPSMS, estado)

	// 3. Digita o código recebido por SMS.
	msg = ports.IncomingEnvelope{From: phoneWhatsApp, Body: "654321"}
	res, handled = HandleOnboarding(ctx, msg, phoneWhatsApp, msg.Body, false, sbClient, &dummyWp, nil, &dummyLlm, historyManager)
	assert.True(t, handled)
	assert.True(t, res.Success)
	assert.Equal(t, "conta_vinculada_sms", res.Reason)
	assert.True(t, linkCalled, "LinkPhoneToUser deveria ter vinculado o WhatsApp atual à conta encontrada")
	assert.True(t, profilePatchCalled, "UpdateProfilePhone deveria ter persistido o WhatsApp atual em profiles")

	estado, _, _ = historyManager.GetFSMState(phoneWhatsApp)
	assert.Equal(t, "", estado, "estado deve ser zerado após o vínculo")
}
