//go:build e2e

package e2e

import (
	"strings"
	"testing"
)

// Produtor de Moçambique pergunta quando semear milho. Sem ZARC lá, o bot
// precisa responder com a janela de referência da zona agroecológica (R1,
// Boane), dizendo que é referência — e sem percentual de risco, que é coisa
// do ZARC brasileiro.
func TestJanelaSementeiraMocambiqueE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	TeardownE2E(t, client)
	defer TeardownE2E(t, client)

	bot := novoBotE2E(t, client)
	bot.enviarDe(t, TestPhoneMZ, "Quando é a melhor época para semear milho na minha machamba?")

	msgs := bot.esperarResposta(t, 1)
	if len(msgs) == 0 {
		t.Fatalf("o bot não respondeu em %s", esperaProcessamento)
	}
	resposta := strings.ToLower(msgs[len(msgs)-1])

	citaReferencia := false
	for _, termo := range []string{"fao", "referência", "referencia", "zona agroecol"} {
		if strings.Contains(resposta, termo) {
			citaReferencia = true
		}
	}
	if !citaReferencia {
		t.Errorf("a resposta deveria dizer que é referência (FAO/zona agroecológica): %s", resposta)
	}
	if strings.Contains(resposta, "zarc") && !strings.Contains(resposta, "não") {
		t.Errorf("não pode apresentar o dado de Moçambique como ZARC: %s", resposta)
	}
	if strings.Contains(resposta, "%") {
		t.Errorf("não há percentual de risco em Moçambique; a resposta inventou um: %s", resposta)
	}
}
