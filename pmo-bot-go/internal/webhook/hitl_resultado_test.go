package webhook

import (
	"strings"
	"testing"
)

// Visto em produção (2026-10-11): após o SIM, a instrução interna da trava de
// confirmação ("Você DEVE pedir permissão...") chegou ao produtor com ✅.
func TestMensagemDoResultadoAprovado(t *testing.T) {
	casos := []struct {
		nome   string
		result interface{}
		ok     bool
		contem string
	}{
		{"sucesso em texto", "Compra de 'adubo' registrada com sucesso.", true, "✅ Compra de 'adubo'"},
		{"erro em texto", "Erro no banco de dados: PMO 10 não pertence ao usuário", false, "❌"},
		{"trava de confirmação", map[string]interface{}{
			"status": "requires_user_input", "motivo": "confirmacao_pendente",
			"message": "Atenção: Esta é uma operação crítica... Você DEVE pedir permissão",
		}, false, "❌"},
		{"erro em mapa", map[string]interface{}{"status": "error", "message": "x"}, false, "❌"},
		{"sucesso em mapa", map[string]interface{}{"status": "success", "message": "Gravado."}, true, "✅ Gravado."},
		{"sem mensagem", nil, true, "✅"},
	}
	for _, c := range casos {
		msg, ok := mensagemDoResultadoAprovado(c.result)
		if ok != c.ok || !strings.Contains(msg, c.contem) {
			t.Errorf("%s: (%q, %v)", c.nome, msg, ok)
		}
		if strings.Contains(msg, "DEVE") {
			t.Errorf("%s: vazou instrução interna: %q", c.nome, msg)
		}
	}
}
