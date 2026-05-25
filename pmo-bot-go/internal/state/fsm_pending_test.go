package state

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// newSuccessSupabaseClient returns a stub supabase client that always succeeds.
func newSuccessSupabaseClient(t *testing.T) *supabase.Client {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if strings.Contains(r.URL.Path, "produtos_proibidos") {
			w.Write([]byte(`[]`))
			return
		}
		w.Write([]byte(`{"id": 123, "lote": "LOTE-TEST-123"}`))
	}))
	t.Cleanup(ts.Close)
	client, err := supabase.NewClient(supabase.Config{URL: ts.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("failed to create success supabase client: %v", err)
	}
	return client
}

func TestFSMPendingEntitiesIntegration(t *testing.T) {
	sbClient := newSuccessSupabaseClient(t)
	historyManager := history.NewManager(5*time.Minute, 10)
	sender := &mockSender{}
	phone := "5511999999999"

	// Mock profile (100% conventional to bypass compliance checks for simplicity)
	profile := &supabase.Profile{
		ID:                     "test-user-1",
		PropriedadeAtivaID:     1,
		PmoAtivoID:             2,
		ModalidadePredominante: "CONVENCIONAL",
		TemProducaoParalela:    false,
	}

	// 1. Initial State setup for Turn-2:
	// Current active entity is Tomato, waiting for quantity.
	currentActiveExtraction := map[string]interface{}{
		"intencao":       "registro",
		"atividade":      "Adubação",
		"insumo_cultura": "Tomate",
		"quantidade":     "0", // needs quantity
		"unidade":        "kg",
		"localizacao":    map[string]interface{}{"talhao": "Talhão Norte"},
	}

	// Pending queue contains:
	// - Entity 1: Lettuce (complete, quantity = 10) -> should be processed & saved automatically.
	// - Entity 2: Potato (incomplete, quantity = 0) -> should suspend FSM and ask.
	// - Entity 3: Onion (should remain in queue).
	pendingEntities := []llm.AcaoEstruturada{
		{
			Intencao:       "registro",
			Atividade:      "Adubação",
			InsumoCultura:  "Alface",
			Quantidade:     "10",
			Unidade:        "kg",
			AlertaOrganico: false,
		},
		{
			Intencao:       "registro",
			Atividade:      "Pulverização",
			InsumoCultura:  "Batata",
			Quantidade:     "0", // incomplete
			Unidade:        "L",
			AlertaOrganico: false,
		},
		{
			Intencao:       "registro",
			Atividade:      "Adubação",
			InsumoCultura:  "Cebola",
			Quantidade:     "5",
			Unidade:        "kg",
			AlertaOrganico: false,
		},
	}

	historyManager.SetFSMState(phone, StateAguardandoQuantidade, currentActiveExtraction, pendingEntities)

	// 2. Execute handleActiveState to resolve the Tomato interview.
	// We simulate the user inputting the quantity "250" for Tomato.
	res := handleActiveState(
		StateAguardandoQuantidade,
		currentActiveExtraction,
		"250", // user reply
		phone,
		phone,
		profile,
		false,
		sbClient,
		sender,
		nil,
		historyManager,
		time.Now(),
		"test-model",
		nil, // gemClient not needed for registration
		nil, // mcpServer not needed for registration
	)

	// Assert process result is false since we suspended on Batata
	if res.Success {
		t.Fatalf("expected active state resolution to suspend (Success: false), got success=true")
	}
	if res.Reason != "missing_quantity" {
		t.Errorf("expected reason to be 'missing_quantity', got %q", res.Reason)
	}

	// 3. Assert mock sender received the accumulated message responses.
	// Expected:
	// - Tomato success message
	// - Alface success message
	// - Batata question prompt
	if len(sender.Sent) == 0 {
		t.Fatal("expected bot to send messages, got 0")
	}

	lastSent := sender.LastMessage
	t.Logf("Last sent message:\n%s", lastSent)

	if !strings.Contains(lastSent, "Tomate") || !strings.Contains(lastSent, "250") {
		t.Error("expected tomato success response to be in the final message")
	}
	if !strings.Contains(lastSent, "Alface") || !strings.Contains(lastSent, "10") {
		t.Error("expected alface (pending complete) success response to be in the final message")
	}
	if !strings.Contains(lastSent, "Batata") || !strings.Contains(lastSent, "Agora, em relação ao registro de Batata") {
		t.Error("expected batata (pending incomplete) prompt and transition to be in the final message")
	}

	// 4. Verify FSM State after execution.
	// Expected:
	// - FSM state is StateAguardandoQuantidade (waiting for Batata's quantity)
	// - FSM context has Batata's extraction map
	// - Remaining queue (Cebola) is preserved in history
	state, ctxState, pending := historyManager.GetFSMState(phone)
	if state != StateAguardandoQuantidade {
		t.Errorf("expected final FSM state to be %q, got %q", StateAguardandoQuantidade, state)
	}

	if ctxState == nil || ctxState["insumo_cultura"] != "Batata" {
		t.Errorf("expected FSM context to target Batata, got: %v", ctxState)
	}

	if len(pending) != 1 || pending[0].InsumoCultura != "Cebola" {
		t.Errorf("expected Cebola to be preserved in the pending queue, got: %v", pending)
	}
}
