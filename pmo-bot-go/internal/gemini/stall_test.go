package gemini

import (
	"context"
	"errors"
	"fmt"
	"testing"
)

// Um stall (conexão muda) NÃO deve ser repetido no mesmo endpoint: custava
// ~79s (3 × 25s + backoffs) antes de escalar. Já um 429/503 é o servidor
// dizendo "estou cheio", e aí repetir com backoff faz sentido.
func TestStallVsOverloadAreDistinguished(t *testing.T) {
	cases := []struct {
		name       string
		err        error
		stall      bool
		overloaded bool
		explicacao string
	}{
		{
			name:       "deadline nativo",
			err:        context.DeadlineExceeded,
			stall:      true,
			overloaded: false,
			explicacao: "conexão travada — escalar direto",
		},
		{
			name:       "deadline embrulhado pelo SDK (caso real de produção)",
			err:        fmt.Errorf(`doRequest: Post "https://...:generateContent": context deadline exceeded`),
			stall:      true,
			overloaded: false,
			explicacao: "conexão travada — escalar direto",
		},
		{
			name:       "timeout do http.Client",
			err:        errors.New("Client.Timeout exceeded while awaiting headers"),
			stall:      true,
			overloaded: false,
			explicacao: "conexão travada — escalar direto",
		},
		{
			name:       "429 rate limit",
			err:        errors.New("googleapi: Error 429: RESOURCE_EXHAUSTED"),
			stall:      false,
			overloaded: true,
			explicacao: "servidor cheio — vale repetir com backoff",
		},
		{
			name:       "503 sobrecarregado",
			err:        errors.New("googleapi: Error 503: The model is overloaded"),
			stall:      false,
			overloaded: true,
			explicacao: "servidor cheio — vale repetir com backoff",
		},
		{
			name:       "400 requisição inválida",
			err:        errors.New("googleapi: Error 400: invalid argument"),
			stall:      false,
			overloaded: false,
			explicacao: "erro permanente — não repetir nem insistir",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isStallError(tc.err); got != tc.stall {
				t.Errorf("isStallError = %v, want %v (%s)", got, tc.stall, tc.explicacao)
			}
			if got := isOverloadedError(tc.err); got != tc.overloaded {
				t.Errorf("isOverloadedError = %v, want %v (%s)", got, tc.overloaded, tc.explicacao)
			}
		})
	}
}

// Regressão do bug corrigido: timeout NÃO pode mais contar como "overloaded",
// senão volta a ser repetido 3x no mesmo endpoint travado.
func TestTimeoutIsNoLongerTreatedAsOverload(t *testing.T) {
	err := fmt.Errorf("context deadline exceeded")
	if isOverloadedError(err) {
		t.Fatal("timeout voltou a ser classificado como overload — os retries de ~79s retornariam")
	}
	if !isStallError(err) {
		t.Fatal("timeout deveria ser classificado como stall")
	}
}
