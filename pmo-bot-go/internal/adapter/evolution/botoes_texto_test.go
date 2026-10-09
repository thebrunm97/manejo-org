package evolution

import (
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

func TestTextoDosBotoes(t *testing.T) {
	// Formato do HITL: corpo em Text, rótulo em displayText.
	got := textoDosBotoes(ports.OutboundEnvelope{
		Title:  "Confirmação Necessária",
		Text:   "Registrar colheita de 10 kg?",
		Footer: "Esta confirmação expira em 10 minutos",
		Buttons: []map[string]string{
			{"type": "reply", "displayText": "SIM", "id": "SIM"},
			{"type": "reply", "displayText": "NÃO", "id": "NÃO"},
		},
	})
	for _, trecho := range []string{"*Confirmação Necessária*", "Registrar colheita de 10 kg?", "Responda *SIM* ou *NÃO*.", "_Esta confirmação expira em 10 minutos_"} {
		if !strings.Contains(got, trecho) {
			t.Errorf("faltou %q em:\n%s", trecho, got)
		}
	}

	// Corpo em Description tem precedência; rótulo em "title".
	got = textoDosBotoes(ports.OutboundEnvelope{
		Description: "Confere?",
		Text:        "ignorado",
		Buttons:     []map[string]string{{"id": "A", "title": "Um"}, {"id": "B", "title": "Dois"}, {"id": "C", "title": "Três"}},
	})
	if got != "Confere?\n\nResponda *Um*, *Dois* ou *Três*." {
		t.Errorf("veio %q", got)
	}
}
