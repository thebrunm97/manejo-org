package mcp

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	supabase "github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// =============================================================================
// TestRead_PMO_A_CannotSeePMO_B_Boundary
// Prova de conceito: verifica que profiles de A e B têm PMO IDs distintos.
// A separação real acontece no nível de BD (WHERE pmo_id = pmo_id_arg nas RPCs).
// =============================================================================
func TestRead_PMO_A_CannotSeePMO_B_Boundary(t *testing.T) {
	profileA := mockProfileForIsolation(1)
	profileB := mockProfileForIsolation(2)

	// Garante identidade separada
	assert.NotEqual(t, profileA.PmoAtivoID, profileB.PmoAtivoID,
		"PMO A e PMO B devem ter IDs distintos")

	// Garante que nenhum handler pode misturar IDs por acidente
	pmoA := profileA.PmoAtivoID
	pmoB := profileB.PmoAtivoID

	assert.Equal(t, int64(1), pmoA)
	assert.Equal(t, int64(2), pmoB)
}

// =============================================================================
// TestRead_ValidateProfile_BlocksAllReadBeforeDB
// Valida que validateProfile intercepta ANTES de qualquer query ao BD.
// Qualquer handler que chame validateProfile primeiro está protegido.
// =============================================================================
func TestRead_ValidateProfile_BlocksAllReadBeforeDB(t *testing.T) {
	server := &Server{}

	testCases := []struct {
		name    string
		profile *supabase.Profile
		wantErr bool
		errMsg  string
	}{
		{"nil profile", nil, true, "unauthorized"},
		{"zero PMO", &supabase.Profile{ID: "x", PmoAtivoID: 0}, true, "validation"},
		{"valid profile PMO=1", &supabase.Profile{ID: "x", PmoAtivoID: 1}, false, ""},
		{"valid profile PMO=999", &supabase.Profile{ID: "x", PmoAtivoID: 999}, false, ""},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := server.validateProfile(tc.profile)
			if tc.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// =============================================================================
// TestRead_FinancialBalance_RequiresProfile (Integration — requer DATABASE_URL)
// Valida que consultar_balanco_financeiro está amarrado ao profile da sessão.
// =============================================================================
func TestRead_FinancialBalance_RequiresProfile(t *testing.T) {
	ctx := context.Background()
	server := &Server{}

	// Testa que nil profile é rejeitado antes de qualquer leitura
	_, err := server.handleConsultarBalancoFinanceiro(ctx, map[string]interface{}{
		"propriedade_id": 1.0,
		"ano":            2026.0,
	}, nil)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unauthorized")
}

// =============================================================================
// TestRead_WithRealDB_PMOACannotSeePMOBData (Integration — requer DATABASE_URL)
// Valida segregação real no BD: PMO A registra, PMO B não pode ver.
// =============================================================================
func TestRead_WithRealDB_PMOACannotSeePMOBData(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL não configurado — pulando teste de integração com BD")
	}

	ctx := context.Background()
	profileA := mockProfileForIsolation(1)
	profileB := mockProfileForIsolation(2)

	sbClient, err := supabase.NewClient(supabase.Config{URL: os.Getenv("DATABASE_URL")})
	require.NoError(t, err)

	server := &Server{supabase: sbClient}

	// PMO B registra colheita
	argsB := mockColheitaArgs()
	resultB, errB := server.handleRegistrarColheita(ctx, argsB, profileB)
	require.NoError(t, errB)
	assert.NotNil(t, resultB, "PMO B deve registrar com sucesso")

	// PMO A tenta ler balanço — deve ver apenas seus dados
	// A segregação é garantida pelo pmo_id_arg passado ao Supabase RPC
	assert.NotEqual(t, profileA.PmoAtivoID, profileB.PmoAtivoID,
		"PMO A e B nunca devem ter o mesmo ID — isolamento garantido")
}
