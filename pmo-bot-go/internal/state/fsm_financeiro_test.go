package state

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// newMockFinanceiroSupabaseClient intercepts financial RPC requests
func newMockFinanceiroSupabaseClient(t *testing.T, expectedURLPath string) *supabase.Client {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, expectedURLPath) && !strings.Contains(r.URL.Path, "categorias_financeiras") {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"id": 123}]`))
			return
		}

		if strings.Contains(r.URL.Path, "categorias_financeiras") {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"id": "00000000-0000-0000-0000-000000000001"}]`))
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "success", "id": "uuid-123", "transacao_id": "uuid-456", "message": "Success"}`))
	}))
	t.Cleanup(ts.Close)

	client, err := supabase.NewClient(supabase.Config{URL: ts.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("failed to create success supabase client: %v", err)
	}
	return client
}

func TestFSM_ScenarioA_FinanceiroPuro(t *testing.T) {
	sbClient := newMockFinanceiroSupabaseClient(t, "rpc_registrar_transacao_com_rateio")
	sender := &mockSender{}
	phone := "5511999999999"

	profile := &supabase.Profile{
		ID:                 "test-user-1",
		PropriedadeAtivaID: 1,
		PmoAtivoID:         2,
	}

	ext := &groq.ExtractionResult{
		Intencao:   "registro_financeiro",
		Atividade:  "Manutenção Trator",
		ValorTotal: "500.50",
		Fornecedor: "Oficina do João",
	}

	msg, res := handleRegistroFinanceiro(context.Background(), ext, profile, sbClient, sender, nil, phone, false, nil)

	if !res.Success {
		t.Fatalf("Expected financial registration to succeed, got false with reason: %s", res.Reason)
	}

	if !strings.Contains(msg, "500.50") {
		t.Errorf("Expected response message to contain the value 500.50, got: %s", msg)
	}

	if !strings.Contains(msg, "Oficina do João") {
		t.Errorf("Expected response message to contain the supplier, got: %s", msg)
	}
}

func TestFSM_ScenarioB_ManejoComCusto(t *testing.T) {
	sbClient := newMockFinanceiroSupabaseClient(t, "rpc_registrar_operacao_campo")
	sender := &mockSender{}
	phone := "5511999999999"

	profile := &supabase.Profile{
		ID:                     "test-user-1",
		PropriedadeAtivaID:     1,
		PmoAtivoID:             2,
		ModalidadePredominante: "CONVENCIONAL",
	}

	ext := &groq.ExtractionResult{
		Intencao:      "registro",
		Atividade:     "Adubação",
		InsumoCultura: "Tomate",
		Quantidade:    "10",
		Unidade:       "kg",
		ValorTotal:    "150.00", // The hybrid cost!
		Localizacao: llm.Localizacao{
			Talhao: "Talhão 1",
		},
	}

	msg, res := finalizeRegistration(
		context.Background(),
		ext,
		profile,
		sbClient,
		sender,
		nil,
		phone,
		"Apliquei 10kg de adubo no Talhão 1 e paguei 150 reais",
		false,
		time.Now(),
		nil,
		phone,
		"test-model",
	)

	if !res.Success {
		t.Fatalf("Expected hybrid registration to succeed, got false with reason: %s\nmsg: %s", res.Reason, msg)
	}

	if !strings.Contains(msg, "10") || !strings.Contains(msg, "Tomate") {
		t.Errorf("Expected response to confirm operation details, got: %s", msg)
	}
}
