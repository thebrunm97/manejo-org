package test

import (
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// MockProfile cria um perfil de teste com dados realistas
func MockProfile() *supabase.Profile {
	return &supabase.Profile{
		ID:                 "test-user-" + randomID(),
		PmoAtivoID:         6, 
		PropriedadeAtivaID: 1, 
		Nome:               "Usuário Teste",
		// Adicione outros campos conforme sua struct Profile
	}
}

// MockProfileForPMO cria um profile para uma PMO específica
func MockProfileForPMO(pmoID int64) *supabase.Profile {
	p := MockProfile()
	p.PmoAtivoID = pmoID
	return p
}

// MockArgs retorna argumentos para teste de Colheita
func MockArgsForColheita() map[string]interface{} {
	return map[string]interface{}{
		"cultura":    "tomate",
		"quantidade": 30.0,
		"unidade":    "caixas",
		"talhao":     "talhao-principal",
	}
}

// MockArgsForDespesa retorna argumentos para teste de Despesa
func MockArgsForDespesa() map[string]interface{} {
	return map[string]interface{}{
		"tipo_despesa":  "insumo",
		"valor":         150.50,
		"descricao":     "Adubo para tomateiro",
		"categoria":     "agrícola",
	}
}

// Utilitário
func randomID() string {
	// Implementar com crypto/rand ou simplesmente usar timestamp
	return "123456789"
}
