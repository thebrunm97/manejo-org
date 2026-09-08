package whatsmeow_service

// Teste do DT-57 (correção): maskToken evita que o token de autenticação
// apareça em claro em "UserInfo cache cleared for token: %s" e variantes,
// achado ao rotacionar a chave da Evolution numa sessão real e ver o valor
// novo reaparecer no docker logs apesar do cuidado em não digitá-lo em
// nenhum outro lugar.

import "testing"

func TestMaskToken(t *testing.T) {
	cases := []struct {
		name  string
		token string
		want  string
	}{
		{"token normal de 64 chars (hex)", "89a03b942a8d280267e5908b447441eb80bf117aeed65d92d63932e447bc909", "89a03b94..."},
		{"token curto demais pra ter prefixo seguro", "abc123", "***"},
		{"token vazio", "", "***"},
		{"token com exatamente 8 chars", "12345678", "***"},
		{"token com 9 chars", "123456789", "12345678..."},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := maskToken(c.token)
			if got != c.want {
				t.Fatalf("maskToken(%q) = %q, esperava %q", c.token, got, c.want)
			}
			if got != "***" && len(got) > 11 {
				// 8 chars de prefixo + "..." = 11. Qualquer coisa maior
				// significa que o token inteiro vazou de novo.
				t.Fatalf("maskToken(%q) devolveu %q — mais longo que o prefixo mascarado esperado, token pode estar vazando", c.token, got)
			}
		})
	}
}
