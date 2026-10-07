//go:build e2e

package e2e

import (
	"strings"
	"testing"
)

func TestRAGQueryE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	TeardownE2E(t, client)
	defer TeardownE2E(t, client)

	bot := novoBotE2E(t, client)
	bot.enviar(t, "Quais são as melhores práticas para a adubação orgânica do tomate?")

	msgs := bot.esperarResposta(t, 1)
	if len(msgs) == 0 {
		t.Fatalf("o bot não respondeu em %s", esperaProcessamento)
	}

	resposta := msgs[len(msgs)-1]
	if strings.TrimSpace(resposta) == "" {
		t.Fatal("a resposta do bot veio vazia")
	}
	if strings.Contains(strings.ToLower(resposta), "erro crítico") {
		t.Fatalf("o bot respondeu com erro do sistema: %s", resposta)
	}
}
