package state

import (
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

func TestTextoPedidoConfirmacao(t *testing.T) {
	txt := textoPedidoConfirmacao(llm.ChamadaFerramentaAgnostica{
		Nome: "registrar_colheita",
		Args: map[string]interface{}{
			"cultura":         "tomate",
			"quantidade":      30,
			"unidade":         "caixas",
			"idempotency_key": "abc",
			"raw_payload_id":  "xyz",
			"lote":            "",
		},
	})

	for _, esperado := range []string{"Confirma o registro de colheita?", "• cultura: tomate", "• quantidade: 30", "• unidade: caixas", "SIM", "Ainda não salvei nada"} {
		if !strings.Contains(txt, esperado) {
			t.Errorf("faltou %q em:\n%s", esperado, txt)
		}
	}
	for _, proibido := range []string{"idempotency", "raw payload", "lote", "✅"} {
		if strings.Contains(txt, proibido) {
			t.Errorf("não deveria conter %q:\n%s", proibido, txt)
		}
	}
}
