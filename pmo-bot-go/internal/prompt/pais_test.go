package prompt

import (
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

func TestPaisDoTelefone(t *testing.T) {
	casos := map[string]string{
		"258851259612":  "MZ",
		"+258851259612": "MZ",
		"5534997317545": "BR",
		"":              "BR",
	}
	for tel, quer := range casos {
		if got := PaisDoTelefone(tel); got != quer {
			t.Errorf("PaisDoTelefone(%q) = %q, queria %q", tel, got, quer)
		}
	}
}

func TestForIntentPaisPreencheOPais(t *testing.T) {
	mz := ForIntentPais(llm.IntentChat, "ORGÂNICO", false, "258851259612")
	if !strings.Contains(mz, "País do produtor: MZ.") {
		t.Error("prompt de Moçambique deveria trazer País do produtor: MZ")
	}
	if strings.Contains(mz, "{{PAIS}}") {
		t.Error("placeholder {{PAIS}} não foi substituído")
	}

	br := ForIntentPais(llm.IntentChat, "ORGÂNICO", false, "5534997317545")
	if !strings.Contains(br, "País do produtor: BR.") {
		t.Error("prompt do Brasil deveria trazer País do produtor: BR")
	}
}
