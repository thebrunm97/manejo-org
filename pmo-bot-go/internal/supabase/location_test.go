package supabase

import "testing"

func TestModalidadeEnum(t *testing.T) {
	casos := map[string]string{
		"Organico": "ORGANICO", "orgânico": "ORGANICO", "": "ORGANICO",
		"Agroecologico": "ORGANICO", "Permacultura": "ORGANICO",
		"convencional": "CONVENCIONAL", "Em transição": "TRANSICAO", "TRANSICAO": "TRANSICAO",
	}
	for in, want := range casos {
		if got := ModalidadeEnum(in); got != want {
			t.Errorf("ModalidadeEnum(%q) = %q, queria %q", in, got, want)
		}
	}
}
