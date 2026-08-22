package gemini

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

// A classificação existe para permitir agregar "por que escalamos?" — separando
// falha de INFRAESTRUTURA (resolve trocando de provedor) de falha de
// CAPACIDADE (exige modelo mais forte). Se ela errar, a medição engana.
func TestClassifyFallbackReason(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want FallbackReason
	}{
		{
			name: "context deadline nativo",
			err:  context.DeadlineExceeded,
			want: ReasonTimeout,
		},
		{
			name: "deadline embrulhado pelo SDK — o caso real observado em prod",
			err:  fmt.Errorf(`doRequest: error sending request: Post "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent": context deadline exceeded`),
			want: ReasonTimeout,
		},
		{
			name: "429 do Google",
			err:  errors.New("googleapi: Error 429: RESOURCE_EXHAUSTED"),
			want: ReasonRateLimit,
		},
		{
			name: "503 sobrecarregado",
			err:  errors.New("googleapi: Error 503: The model is overloaded"),
			want: ReasonServer5xx,
		},
		{
			name: "modelo inexistente (o caso do gemini-1.5-flash aposentado)",
			err:  errors.New("googleapi: Error 404: models/gemini-1.5-flash is not found"),
			want: ReasonBadRequest,
		},
		{
			name: "erro desconhecido não é classificado como timeout",
			err:  errors.New("algo estranho aconteceu"),
			want: ReasonOutro,
		},
		{
			name: "nil não quebra",
			err:  nil,
			want: ReasonOutro,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyFallbackReason(tc.err); got != tc.want {
				t.Errorf("classifyFallbackReason(%v) = %q, want %q", tc.err, got, tc.want)
			}
		})
	}
}

// Regressão do bug central: a escalada recebia o contexto JÁ expirado pelo
// primário e retornava sem abrir conexão.
func TestFallbackGetsUsableContextEvenWhenParentExpired(t *testing.T) {
	parent, cancel := context.WithCancel(context.Background())
	cancel() // pai morto, como ficava após o primário esgotar o prazo

	if parent.Err() == nil {
		t.Fatal("pré-condição: o contexto pai deveria estar cancelado")
	}

	attemptCtx, cancelAttempt := newAttemptContext(parent, false /* escalada */)
	defer cancelAttempt()

	if attemptCtx.Err() != nil {
		t.Fatalf("a escalada nasceu inutilizável: %v", attemptCtx.Err())
	}

	deadline, ok := attemptCtx.Deadline()
	if !ok {
		t.Fatal("a escalada precisa ter deadline próprio, para não rodar sem limite")
	}
	if remaining := time.Until(deadline); remaining > fallbackTimeout+time.Second {
		t.Fatalf("orçamento da escalada excede o teto: %v > %v", remaining, fallbackTimeout)
	}
}

// Contrapartida: o PRIMÁRIO não pode escapar do prazo do turno. Se ele também
// usasse WithoutCancel, três tentativas mais a escalada ultrapassariam 100s,
// muito além dos 30s de orçamento do turno.
func TestPrimaryAttemptStaysBoundedByParentDeadline(t *testing.T) {
	parent, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	attemptCtx, cancelAttempt := newAttemptContext(parent, true /* primário */)
	defer cancelAttempt()

	deadline, ok := attemptCtx.Deadline()
	if !ok {
		t.Fatal("tentativa primária deveria ter deadline")
	}

	// O pai vence em 2s; o teto da tentativa é 25s. Deve prevalecer o pai.
	if remaining := time.Until(deadline); remaining > 3*time.Second {
		t.Fatalf("primário estendeu o prazo do turno: restam %v (deveria ~2s)", remaining)
	}
}

// Cancelar o pai deve interromper o primário — o WithoutCancel é exceção
// exclusiva da escalada.
func TestPrimaryAttemptIsCancelledWithParent(t *testing.T) {
	parent, cancel := context.WithCancel(context.Background())

	attemptCtx, cancelAttempt := newAttemptContext(parent, true)
	defer cancelAttempt()

	cancel()

	select {
	case <-attemptCtx.Done():
		// esperado
	case <-time.After(time.Second):
		t.Fatal("tentativa primária ignorou o cancelamento do pai")
	}
}
