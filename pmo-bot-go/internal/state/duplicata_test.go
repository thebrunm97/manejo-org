package state

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// hitlFalso registra o pedido de aprovação; o resto da interface não é usado.
type hitlFalso struct {
	guardrails.HITLHandler
	pedidos []guardrails.HITLRecord
}

func (h *hitlFalso) RequestApproval(_ context.Context, rec guardrails.HITLRecord) (string, error) {
	h.pedidos = append(h.pedidos, rec)
	return "tok", nil
}

func TestChaveDuplicata(t *testing.T) {
	p, q, tipo, ok := chaveDuplicata("registrar_compra_insumo", map[string]interface{}{"produto": " adubo ", "quantidade_valor": "3"})
	if !ok || p != "adubo" || q != 3 || tipo != "compra" {
		t.Fatalf("compra: %q %v %q %v", p, q, tipo, ok)
	}
	if _, _, _, ok := chaveDuplicata("registrar_colheita", map[string]interface{}{"cultura": "tomate"}); ok {
		t.Fatal("sem quantidade não dá para comparar")
	}
	if p, q, _, ok := chaveDuplicata("registrar_avicultura", map[string]interface{}{"evento": "postura", "quantidade": 40.0}); !ok || p != "Ovos" || q != 40 {
		t.Fatalf("avicultura: %q %v %v", p, q, ok)
	}
	if _, _, _, ok := chaveDuplicata("consultar_registros", map[string]interface{}{"produto": "x", "quantidade_valor": 1.0}); ok {
		t.Fatal("ferramenta de leitura não entra")
	}
}

func TestTextoDuplicata_MZ(t *testing.T) {
	agora := time.Date(2026, 10, 28, 12, 30, 0, 0, time.FixedZone("BRT", -3*3600))
	quando := agora.Add(-20 * time.Minute) // 12:10 BRT = 17:10 em Maputo
	got := guardrails.TextoDuplicata("+258840000000", "adubo", 1.5, "compra", quando, agora)
	for _, want := range []string{"compra de adubo (1,5)", "hoje às 17:10", "registo repetido"} {
		if !strings.Contains(got, want) {
			t.Errorf("falta %q em %q", want, got)
		}
	}
}

func TestHITLMiddleware_DuplicataPedeConfirmacao(t *testing.T) {
	ctrl := &hitlFalso{}
	var hist []llm.MensagemAgnostica
	var trace []TraceEvent
	m := &HITLMiddleware{
		Controller:    ctrl,
		Phone:         "+5511999999999",
		Profile:       &supabase.Profile{ID: "u1", PmoAtivoID: 7},
		HitlRequested: map[string]bool{},
		BuscarDuplicata: func(_ context.Context, produto string, qtd float64, _ time.Time) (time.Time, bool) {
			return time.Now().Add(-10 * time.Minute), produto == "adubo" && qtd == 3
		},
	}
	req := &ToolRequest{ToolName: "registrar_compra_insumo", RawArgs: map[string]interface{}{"produto": "adubo", "quantidade_valor": 3.0, "valor_total": 10.0}, History: &hist, TraceEvents: &trace}

	if _, err := m.Process(context.Background(), req); err == nil || err.Error() != "hitl_pending" {
		t.Fatalf("duplicata devia pedir confirmação, err=%v", err)
	}
	if len(ctrl.pedidos) != 1 || !strings.Contains(ctrl.pedidos[0].ActionLabel, "Já anotei") {
		t.Fatalf("pedido sem o aviso de duplicata: %+v", ctrl.pedidos)
	}

	// Outro produto: segue direto, sem confirmação.
	req2 := &ToolRequest{ToolName: "registrar_compra_insumo", RawArgs: map[string]interface{}{"produto": "calcário", "quantidade_valor": 3.0, "valor_total": 10.0}, History: &hist, TraceEvents: &trace}
	if _, err := m.Process(context.Background(), req2); err != nil {
		t.Fatalf("registro novo não devia pedir confirmação: %v", err)
	}
}
