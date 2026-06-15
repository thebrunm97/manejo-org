package state

// ─── Agricultural Compliance Suite (Zero-Trust Multi-Modality) ────────────────
// Validates the FSM compliance engine against the 4 critical scenarios defined
// in MULTI_MODALITY_HARDENING_PLAN.md, Section 4 & Matrix Row E2E-02..07.
//
// Design notes:
//   - Uses package-internal access (same package "state") to call finalizeRegistration directly.
//   - Caso A/B/D use sbClient=nil → panic guarded by finalizeRegistration (compliance fires first).
//   - Caso C uses a stubSupabaseClient that returns a deterministic rpc_http_error after
//     compliance passes, confirming the compliance layer did NOT block the conventional producer.
//   - Table-Driven Tests (TDT) pattern for maximum coverage clarity.

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/testutil"
)

// ─── Stub Supabase (returns RPC error without network) ────────────────────────
// Simulates sbClient with a real supabase.Client backed by a httptest.Server
// that always returns HTTP 500, producing the "rpc_http_error" reason.
func newFailingSupabaseClient(t *testing.T) *supabase.Client {
	t.Helper()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, `{"message":"stub error"}`)
	}))
	t.Cleanup(ts.Close)
	client, err := supabase.NewClient(supabase.Config{URL: ts.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("failed to create stub supabase client: %v", err)
	}
	return client
}

// ─── Mock: MessageSender ──────────────────────────────────────────────────────

type mockSender struct {
	LastMessage string
	Sent        []string
}

func (m *mockSender) SendMessage(to, message string) error {
	m.LastMessage = message
	m.Sent = append(m.Sent, message)
	return nil
}
func (m *mockSender) SendVoice(to, audio string, isPtt bool) error        { return nil }
func (m *mockSender) SendReply(to, msg, replyTo string) error             { return nil }
func (m *mockSender) DownloadAudio(id string, raw []byte) ([]byte, error) { return nil, nil }
func (m *mockSender) DownloadImage(id string, raw []byte) ([]byte, string, error) {
	return nil, "", nil
}
func (m *mockSender) SetPresence(to, presence string) error { return nil }
func (m *mockSender) SendButton(to string, title, description, footer string, buttons []map[string]string) error {
	m.LastMessage = description
	m.Sent = append(m.Sent, description)
	return nil
}

// ─── Profile builders ─────────────────────────────────────────────────────────

func orgProfile() *supabase.Profile {
	return &supabase.Profile{
		ID:                     "user-org-1",
		ModalidadePredominante: "ORGANICO",
		TemProducaoParalela:    false,
		Talhoes: []supabase.Talhao{
			{ID: 1, Nome: "Talhão Norte", ModalidadeProducao: "ORGANICO"},
		},
	}
}

func conventionalProfile() *supabase.Profile {
	return &supabase.Profile{
		ID:                     "user-conv-1",
		ModalidadePredominante: "CONVENCIONAL",
		TemProducaoParalela:    false,
		Talhoes: []supabase.Talhao{
			{ID: 2, Nome: "Talhão Sul", ModalidadeProducao: "CONVENCIONAL"},
		},
	}
}

func parallelProfile() *supabase.Profile {
	return &supabase.Profile{
		ID:                     "user-mixed-1",
		ModalidadePredominante: "ORGANICO",
		TemProducaoParalela:    true,
		Talhoes: []supabase.Talhao{
			{ID: 3, Nome: "Talhão A", ModalidadeProducao: "ORGANICO"},
			{ID: 4, Nome: "Talhão B", ModalidadeProducao: "CONVENCIONAL"},
		},
	}
}

func transitionTalhaoProfile() *supabase.Profile {
	return &supabase.Profile{
		ID:                     "user-trans-1",
		ModalidadePredominante: "CONVENCIONAL",
		TemProducaoParalela:    true,
		Talhoes: []supabase.Talhao{
			{ID: 5, Nome: "Talhão Leste", ModalidadeProducao: "TRANSICAO"},
			{ID: 6, Nome: "Talhão Oeste", ModalidadeProducao: "CONVENCIONAL"},
		},
	}
}

// ─── Compliance Test Matrix (Table-Driven) ────────────────────────────────────

func TestFSMComplianceMatrix(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		id          string // mirrors MULTI_MODALITY_HARDENING_PLAN.md matrix ID
		desc        string
		profile     *supabase.Profile
		ext         groq.ExtractionResult
		useStubSB   bool   // true = use httptest stub (case C); false = nil sbClient (A/B/D exit in compliance)
		wantBlocked bool   // true = expect Success=false
		wantReason  string // exact ProcessResult.Reason
		wantMsgSnip string // substring expected in bot response
	}{
		// ─── Caso A / E2E-04 variant ─────────────────────────────────────────
		// Produtor 100% ORGÂNICO aplica GLIFOSATO.
		// Compliance DEVE bloquear antes de tocar qualquer RPC.
		{
			id:      "A",
			desc:    "100% Orgânico + Glifosato → BLOQUEIO de compliance",
			profile: orgProfile(),
			ext: groq.ExtractionResult{
				Intencao:       "registro",
				Atividade:      "Pulverização",
				InsumoCultura:  "Glifosato",
				InsumoAplicado: "Glifosato",
				AlertaOrganico: true,
				Quantidade:     50.0,
				Unidade:        "kg",
			},
			wantBlocked: true,
			wantReason:  "organic_compliance_block",
			wantMsgSnip: "ALERTA",
		},

		// ─── Caso B / E2E-04 ─────────────────────────────────────────────────
		// Talhão específico está em TRANSIÇÃO. NPK deve ser barrado.
		{
			id:      "B",
			desc:    "Talhão TRANSIÇÃO + NPK → BLOQUEIO de compliance",
			profile: transitionTalhaoProfile(),
			ext: groq.ExtractionResult{
				Intencao:       "registro",
				Atividade:      "Adubação",
				InsumoCultura:  "NPK",
				InsumoAplicado: "NPK",
				AlertaOrganico: true,
				Quantidade:     100.0,
				Unidade:        "kg",
				Localizacao: llm.Localizacao{
					Talhao:           "Talhão Leste",
					TalhoesAplicados: []string{"Talhão Leste"},
				},
			},
			wantBlocked: true,
			wantReason:  "organic_compliance_block",
			wantMsgSnip: "BLOQUEADO",
		},

		// ─── Caso C / E2E-02 ─────────────────────────────────────────────────
		// Produtor 100% CONVENCIONAL aplica Roundup.
		// Compliance DEVE passar. Como sbClient=nil, falha na RPC (esperado).
		// Critério de êxito: Reason é "rpc_http_error", NÃO "organic_compliance_block".
		{
			id:      "C",
			desc:    "100% Convencional + Roundup → PASS-THROUGH (compliance OK, falha de RPC esperada)",
			profile: conventionalProfile(),
			ext: groq.ExtractionResult{
				Intencao:       "registro",
				Atividade:      "Pulverização",
				InsumoCultura:  "Roundup",
				InsumoAplicado: "Roundup",
				AlertaOrganico: false,
				Quantidade:     2.5,
				Unidade:        "L",
				Localizacao: llm.Localizacao{
					Talhao:           "Talhão Sul",
					TalhoesAplicados: []string{"Talhão Sul"},
				},
			},
			wantBlocked: true,
			useStubSB:   true, // compliance passes → needs a real (stub) client to hit the RPC
			wantReason:  "rpc_http_error",
			wantMsgSnip: "Falha técnica",
		},

		// ─── Caso D / E2E-06 ─────────────────────────────────────────────────
		// Produção PARALELA (mista). Produtor diz "passei veneno" sem especificar talhão.
		// FSM deve SUSPENDER e solicitar desambiguação.
		{
			id:      "D",
			desc:    "Produção Paralela + Veneno sem talhão → SUSPENSÃO (pede desambiguação)",
			profile: parallelProfile(),
			ext: groq.ExtractionResult{
				Intencao:       "registro",
				Atividade:      "Pulverização",
				InsumoCultura:  "Veneno",
				InsumoAplicado: "Veneno",
				AlertaOrganico: true,
				Quantidade:     5.0,
				Unidade:        "L",
				// Localizacao intencionally empty — user did NOT specify talhão
			},
			wantBlocked: true,
			wantReason:  "parallel_prod_missing_context",
			wantMsgSnip: "talhão",
		},
	}

	for _, tc := range tests {
		t.Run(tc.id+": "+tc.desc, func(t *testing.T) {
			sender := &mockSender{}

			var sbClient *supabase.Client
			if tc.useStubSB {
				sbClient = newFailingSupabaseClient(t)
			}

			msg, result := finalizeRegistration(
				ctx,
				&tc.ext,
				tc.profile,
				sbClient,
				sender,
				nil, // ttsClient=nil
				"5511999999999",
				"original message body",
				false,
				time.Now(),
				nil, // historyManager=nil
				"5511999999999",
				"test-model",
			)

			// Assert: Reason
			if result.Reason != tc.wantReason {
				t.Errorf("[%s] Reason:\n  got  = %q\n  want = %q\n  msg  = %q",
					tc.id, result.Reason, tc.wantReason, msg)
			}

			// Assert: Success flag (wantBlocked=true means Success must be false)
			if result.Success == tc.wantBlocked {
				t.Errorf("[%s] Success flag: got Success=%v but wantBlocked=%v",
					tc.id, result.Success, tc.wantBlocked)
			}

			// Assert: Message contains expected snippet
			if tc.wantMsgSnip != "" && !strings.Contains(msg, tc.wantMsgSnip) {
				t.Errorf("[%s] Message missing snippet:\n  msg  = %q\n  want = %q",
					tc.id, msg, tc.wantMsgSnip)
			}

			t.Logf("[%s] ✓  Reason=%q | Success=%v | msg=%q",
				tc.id, result.Reason, result.Success, msg)
		})
	}
}

// ─── White-box: blacklist detection ──────────────────────────────────────────

func TestIsProibidoEscancarado(t *testing.T) {
	cases := []struct {
		input    string
		expected bool
	}{
		{"Glifosato", true},
		{"glifosato", true}, // case-insensitive
		{"ROUNDUP", true},
		{"Ureia", true},
		{"npk", true},
		{"veneno", true},
		{"agrotoxico", true},
		{"Composto Orgânico", false}, // allowed
		{"Sulfato de cobre", false},
		{"Calda Bordalesa", false},
		{"Bokashi", false},
		{"", false},
	}

	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			got := isProibidoEscancarado(tc.input)
			if got != tc.expected {
				t.Errorf("isProibidoEscancarado(%q) = %v, want %v", tc.input, got, tc.expected)
			}
		})
	}
}

// ─── Regression: Caso A com talhão explícito ─────────────────────────────────
// Garante que a verificação de talhão funciona mesmo quando especificado.

func TestOrganicoBlockWithExplicitTalhao(t *testing.T) {
	sender := &mockSender{}

	ext := groq.ExtractionResult{
		Intencao:       "registro",
		Atividade:      "Adubação",
		InsumoCultura:  "NPK",
		AlertaOrganico: true,
		Quantidade:     30.0,
		Unidade:        "kg",
		Localizacao: llm.Localizacao{
			Talhao:           "Talhão Norte",
			TalhoesAplicados: []string{"Talhão Norte"},
		},
	}

	_, result := finalizeRegistration(
		context.Background(), &ext, orgProfile(),
		nil, sender, nil,
		"5511999999999", "aplicação de npk no talhão norte",
		false, time.Now(), nil, "5511999999999", "test-model",
	)

	if result.Reason != "organic_compliance_block" {
		t.Errorf("Regression: expected organic_compliance_block, got %q", result.Reason)
	}
}

// ─── DI & Mocking Test ───────────────────────────────────────────────────────

func TestFinalizeRegistration_MockSuccess(t *testing.T) {
	// 1. Setup do Mock
	mockDB := new(testutil.MockDatabaseRepository)

	ctx := context.Background()
	profile := conventionalProfile() // Reuses profile from table tests

	ext := &groq.ExtractionResult{
		Intencao:       "registro",
		Atividade:      "Plantio",
		InsumoCultura:  "Alface",
		Quantidade:     "100",
		Unidade:        "mudas",
		Data:           "2026-06-13",
		AlertaOrganico: false,
		Localizacao: llm.Localizacao{
			Talhao: "Talhão Sul",
		},
	}

	// 2. Definindo as Expectativas do Mock
	// Esperamos que o RegistrarOperacaoCampoRPC seja chamado com os dados corretos
	mockDB.On("RegistrarOperacaoCampoRPC", ctx, mock.AnythingOfType("map[string]interface {}"), "2026-06-13").
		Return(map[string]interface{}{
			"id":     "rec_123",
			"lote":   "L-456",
			"status": "success",
		}, nil)

	// Esperamos que os logs sejam salvos
	mockDB.On("InsertLogProcessamento", mock.AnythingOfType("supabase.LogProcessamentoInsert")).Return(nil)
	mockDB.On("InsertLogConsumo", mock.AnythingOfType("supabase.LogConsumoInsert")).Return(nil)
	mockDB.On("InsertLogTreinamento", mock.AnythingOfType("supabase.LogTreinamentoInsert")).Return(nil)

	sender := &mockSender{}
	
	// 3. Execução
	respStr, res := finalizeRegistration(
		ctx,
		ext,
		profile,
		mockDB,
		sender, // wpClient
		nil,    // ttsClient
		"5511999999999",
		"Plantei 100 mudas de alface no Talhão Sul",
		false, // respondWithAudio
		time.Now(),
		nil, // historyManager
		"5511999999999",
		"mock-model",
	)

	// 4. Verificações
	if !res.Success {
		t.Errorf("O registro deveria ter sucesso, Reason: %s", res.Reason)
	}
	if res.Reason != "record_saved" {
		t.Errorf("Reason esperado 'record_saved', recebido: %s", res.Reason)
	}
	if !strings.Contains(respStr, "Registro com Sucesso") {
		t.Errorf("Resposta não contém sucesso: %s", respStr)
	}

	// Verifica se todas as expectativas do mock foram atendidas (Opcional, pois testify já faz assert mas não falha se faltar sem assertExpectations)
	mockDB.AssertExpectations(t)
}

