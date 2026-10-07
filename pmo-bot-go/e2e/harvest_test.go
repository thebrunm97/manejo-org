//go:build e2e

package e2e

import (
	"fmt"
	"testing"
)

// Colheita vai para caderno_campo (tabela unificada, rpc_registrar_operacao_campo),
// com quantidade em quantidade_valor — a tabela colheitas não existe mais.
func TestHarvestMutationE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	TeardownE2E(t, client)
	defer TeardownE2E(t, client)

	bot := novoBotE2E(t, client)
	bot.enviar(t, "Acabei de colher 30 caixas de tomate no talhao principal")

	consulta := fmt.Sprintf("caderno_campo?pmo_id=eq.%d&select=id,tipo_atividade,produto,quantidade_valor,quantidade_unidade", TestPMOID)
	registrouColheita := func() bool {
		for _, rec := range restGet(t, consulta) {
			if v, ok := rec["quantidade_valor"].(float64); ok && v == 30 {
				return true
			}
		}
		return false
	}

	confirmarSePedido(t, bot, registrouColheita)

	if !registrouColheita() {
		t.Fatalf("nenhum registro com quantidade_valor=30 em caderno_campo; registros: %v", restGet(t, consulta))
	}
}
