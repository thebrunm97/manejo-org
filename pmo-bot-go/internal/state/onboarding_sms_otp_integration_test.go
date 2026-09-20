package state

import (
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

var reCodigoSMS = regexp.MustCompile(`\d{6}`)

// TestOnboardingSMSOTP_Integration percorre o vínculo alternativo por SMS
// (pensado pra mercados com baixo acesso a e-mail, ex. Moçambique) de ponta a
// ponta: escolha do canal -> telefone cadastrado -> OTP por SMS -> vínculo do
// WhatsApp atual à conta encontrada. Só roda com SMS_OTP_ENABLED=true; sem a
// env, o fluxo é idêntico ao de antes (só e-mail) — ver TestOnboardingOTP_Integration.
//
// O código é gerado e verificado localmente (não via /auth/v1/otp do
// GoTrue — ver comentário em SMSSender, internal/state/sms_otp.go, sobre por
// que isso foi trocado), então o teste substitui SMSSender por um dublê que
// captura a mensagem em vez de mandar SMS de verdade.
func TestOnboardingSMSOTP_Integration(t *testing.T) {
	t.Setenv("SMS_OTP_ENABLED", "true")

	smsOriginal := SMSSender
	var mensagemCapturada string
	SMSSender = func(ctx context.Context, telefone, mensagem string) error {
		mensagemCapturada = mensagem
		return nil
	}
	defer func() { SMSSender = smsOriginal }()

	var linkCalled, profilePatchCalled bool

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

		// LinkPhoneToUser
		case r.URL.Path == "/auth/v1/admin/users/test-user-id" && r.Method == http.MethodPut:
			linkCalled = true
			w.WriteHeader(http.StatusOK)

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
	codigo := reCodigoSMS.FindString(mensagemCapturada)
	require.NotEmpty(t, codigo, "SMSSender deveria ter recebido uma mensagem com um código de 6 dígitos, recebeu: %q", mensagemCapturada)
	estado, _, _ = historyManager.GetFSMState(phoneWhatsApp)
	assert.Equal(t, StateAguardandoOTPSMS, estado)

	// 2b. Código errado não deve vincular nem avançar o estado.
	msg = ports.IncomingEnvelope{From: phoneWhatsApp, Body: "000000"}
	res, handled = HandleOnboarding(ctx, msg, phoneWhatsApp, msg.Body, false, sbClient, &dummyWp, nil, &dummyLlm, historyManager)
	assert.True(t, handled)
	assert.False(t, res.Success)
	assert.Equal(t, "otp_sms_invalido", res.Reason)
	assert.False(t, linkCalled, "código errado não deveria ter vinculado nada ainda")

	// 3. Digita o código certo, capturado do SMSSender.
	msg = ports.IncomingEnvelope{From: phoneWhatsApp, Body: codigo}
	res, handled = HandleOnboarding(ctx, msg, phoneWhatsApp, msg.Body, false, sbClient, &dummyWp, nil, &dummyLlm, historyManager)
	assert.True(t, handled)
	assert.True(t, res.Success)
	assert.Equal(t, "conta_vinculada_sms", res.Reason)
	assert.True(t, linkCalled, "LinkPhoneToUser deveria ter vinculado o WhatsApp atual à conta encontrada")
	assert.True(t, profilePatchCalled, "UpdateProfilePhone deveria ter persistido o WhatsApp atual em profiles")

	estado, _, _ = historyManager.GetFSMState(phoneWhatsApp)
	assert.Equal(t, "", estado, "estado deve ser zerado após o vínculo")
}

// TestOnboardingSMSOTP_SemProvedorConfigurado confirma que, sem SMSSender
// configurado (o padrão), o produtor recebe um erro claro em vez de achar
// que um código foi enviado quando não foi.
func TestOnboardingSMSOTP_SemProvedorConfigurado(t *testing.T) {
	t.Setenv("SMS_OTP_ENABLED", "true")
	// Não sobrescreve SMSSender — usa o padrão (retorna erro).

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/profiles" && r.Method == http.MethodGet {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"id": "test-user-id", "telefone": "258841234567"}]`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	sbClient, err := supabase.NewClient(supabase.Config{URL: server.URL, Key: "test-key"})
	require.NoError(t, err)

	historyManager := history.NewManager(45*time.Minute, 1000)
	ctx := context.Background()
	phoneWhatsApp := "5511999999998"

	dummyWp := dummyMessageSender{}
	dummyLlm := dummyLLMClient{}

	historyManager.SetFSMState(phoneWhatsApp, StateAguardandoTelefoneVinculo, nil, nil)
	msg := ports.IncomingEnvelope{From: phoneWhatsApp, Body: "258841234567"}
	res, handled := HandleOnboarding(ctx, msg, phoneWhatsApp, msg.Body, false, sbClient, &dummyWp, nil, &dummyLlm, historyManager)
	assert.True(t, handled)
	assert.False(t, res.Success)
	assert.Equal(t, "sms_envio_falhou", res.Reason)
}
