//go:build e2e

package e2e

import (
	"fmt"
	"testing"
)

// Despesa vai para transacoes_financeiras com o valor em valor_total (não
// valor/amount).
func TestExpenseMutationE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	TeardownE2E(t, client)
	defer TeardownE2E(t, client)

	bot := novoBotE2E(t, client)
	bot.enviar(t, "Comprei 10 sacos de adubo por 500 reais")

	consulta := fmt.Sprintf("transacoes_financeiras?pmo_id=eq.%d&select=id,tipo,valor_total", TestPMOID)
	registrouDespesa := func() bool {
		for _, rec := range restGet(t, consulta) {
			if v, ok := rec["valor_total"].(float64); ok && v == 500 {
				return true
			}
		}
		return false
	}

	confirmarSePedido(t, bot, registrouDespesa)

	if !registrouDespesa() {
		t.Fatalf("nenhuma transação com valor_total=500; registros: %v", restGet(t, consulta))
	}
}

// confirmarSePedido espera o bot reagir à primeira mensagem. Ferramentas que
// gravam dados exigem confirmação explícita do produtor (middleware do MCP,
// RequiresConfirmation): se nada foi gravado depois da primeira resposta, o
// teste confirma uma vez e espera de novo. Não dá para detectar o pedido pelo
// texto — o LLM reescreve a frase a cada execução.
func confirmarSePedido(t *testing.T, bot *botE2E, gravou func() bool) {
	t.Helper()
	esperarAte(esperaProcessamento, func() bool { return gravou() || len(bot.whatsapp.Mensagens()) > 0 })
	if gravou() {
		return
	}

	msgs := bot.esperarResposta(t, 1)
	if len(msgs) == 0 {
		t.Fatalf("o bot não respondeu nem gravou nada em %s", esperaProcessamento)
	}

	t.Log("Nada gravado ainda — confirmando como o produtor faria")
	bot.enviar(t, "Sim, confirmo")
	esperarAte(esperaProcessamento, gravou)
	bot.esperarResposta(t, len(msgs)+1)
}
