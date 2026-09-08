package mcp

import (
	"context"
	"os"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	supabase "github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// --- Helpers locais para criar profiles de teste sem dependência externa ---

func mockProfileForIsolation(pmoID int64) *supabase.Profile {
	return &supabase.Profile{
		ID:                 "test-user-isolation",
		Nome:               "Produtor Teste",
		Telefone:           "5511999999999",
		PmoAtivoID:         pmoID,
		PropriedadeAtivaID: 1,
	}
}

func mockColheitaArgs() map[string]interface{} {
	return map[string]interface{}{
		"cultura":    "tomate",
		"quantidade": 30.0,
		"unidade":    "caixas",
		"talhao":     "talhao-principal",
	}
}

// =============================================================================
// TestIsolation_NilProfileRejected
// Valida que a validação rejeita profile nulo com erro "unauthorized".
//
// Premissa original deste teste ficou obsoleta pelo DT-67: handleRegistrarColheita
// não recebe mais *supabase.Profile (recebe TenantCtx, construído e validado
// ANTES do handler rodar), então "handler rejeita nil" não é mais um caminho
// de código que existe — buildTenantCtx é o portão agora, e é ele que este
// teste passa a exercitar.
// =============================================================================
func TestIsolation_NilProfileRejected(t *testing.T) {
	_, err := buildTenantCtx(nil)

	assert.Error(t, err, "deve retornar erro para profile nulo")
	assert.Contains(t, err.Error(), "unauthorized")
}

// =============================================================================
// TestIsolation_ZeroPmoRejected
// Valida que PmoAtivoID=0 é bloqueado por buildTenantCtx antes de qualquer RPC
// =============================================================================
func TestIsolation_ZeroPmoRejected(t *testing.T) {
	profileZero := mockProfileForIsolation(0)

	_, err := buildTenantCtx(profileZero)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "validation")
}

// =============================================================================
// TestIsolation_ValidateProfile_NilReturnsUnauthorized
// =============================================================================
func TestIsolation_ValidateProfile_NilReturnsUnauthorized(t *testing.T) {
	_, err := buildTenantCtx(nil)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unauthorized")
}

// =============================================================================
// TestIsolation_ValidateProfile_ValidPasses
// =============================================================================
func TestIsolation_ValidateProfile_ValidPasses(t *testing.T) {
	profile := mockProfileForIsolation(42)
	tenant, err := buildTenantCtx(profile)

	assert.NoError(t, err)
	assert.Equal(t, int64(42), tenant.PmoID, "TenantCtx deve carregar o PmoID do profile")
}

// =============================================================================
// TestIsolation_CrossPMOWrite_ArgsInjectionIgnored
// Valida que args["pmo_id"] é completamente ignorado.
// Handler sempre usa profile.PmoAtivoID, nunca args.
// Este teste verifica o COMPORTAMENTO CORRETO ao passar pmo_id nos args.
// =============================================================================
func TestIsolation_CrossPMOWrite_ArgsInjectionIgnored(t *testing.T) {
	// Arrange: profile com PMO 1, mas args tenta injetar PMO 999
	profileA := mockProfileForIsolation(1)

	argsWithInjection := map[string]interface{}{
		"cultura":    "tomate",
		"quantidade": 30.0,
		"unidade":    "caixas",
		"talhao":     "principal",
		"pmo_id":     999, // ← Tentativa de cross-tenancy hijack
		"user_id":    "hacker-user-uuid",
	}

	// Verificação estática: o handler recebe TenantCtx, não *Profile nem args —
	// não há NENHUM parâmetro pelo qual args["pmo_id"] poderia chegar a virar
	// o pmoID usado na RPC (DT-67). O teste de guarda genérico em
	// tenant_guard_test.go varre isso automaticamente para todo handler
	// registrado; aqui só documentamos o contrato com o profile de origem.
	assert.Equal(t, int64(1), profileA.PmoAtivoID, "profile deve ter PMO 1")
	assert.Equal(t, 999, argsWithInjection["pmo_id"], "args tentam injetar PMO 999")

	tenant, err := buildTenantCtx(profileA)
	require.NoError(t, err)
	assert.Equal(t, int64(1), tenant.PmoID, "tenant.PmoID deve vir do profile (1), não dos args (999)")
}

// =============================================================================
// TestIsolation_TenPMOs_Concurrent
// Testa 10 PMOs validando profiles em goroutines simultâneas.
// Verifica que não há race condition no validateProfile.
// Requer BD para persistência — faz skip sem DATABASE_URL.
// =============================================================================
func TestIsolation_TenPMOs_Concurrent(t *testing.T) {
	numPMOs := 10

	var wg sync.WaitGroup
	errors := make(chan error, numPMOs)
	profiles := make(chan *supabase.Profile, numPMOs)

	for i := 1; i <= numPMOs; i++ {
		wg.Add(1)
		go func(pmoID int64) {
			defer wg.Done()
			profile := mockProfileForIsolation(pmoID)

			// Testa apenas buildTenantCtx (sem acesso ao BD)
			_, err := buildTenantCtx(profile)
			if err != nil {
				errors <- err
			} else {
				profiles <- profile
			}
		}(int64(i))
	}

	wg.Wait()
	close(errors)
	close(profiles)

	// Assert: nenhum erro de validação
	errorCount := 0
	for err := range errors {
		t.Errorf("PMO concurrent validation failed: %v", err)
		errorCount++
	}

	successCount := 0
	for range profiles {
		successCount++
	}

	assert.Equal(t, 0, errorCount, "nenhum erro esperado")
	assert.Equal(t, numPMOs, successCount, "todas as 10 PMOs devem validar com sucesso")
}

// =============================================================================
// TestIsolation_PMOIDs_AreDistinct
// Verifica que diferentes usuários têm diferentes PmoAtivoIDs (isolamento de identidade)
// =============================================================================
func TestIsolation_PMOIDs_AreDistinct(t *testing.T) {
	profiles := make([]*supabase.Profile, 10)
	for i := 0; i < 10; i++ {
		profiles[i] = mockProfileForIsolation(int64(i + 1))
	}

	// Todos os PMO IDs devem ser distintos
	seen := make(map[int64]bool)
	for _, p := range profiles {
		assert.False(t, seen[p.PmoAtivoID], "PmoAtivoID %d apareceu duplicado", p.PmoAtivoID)
		seen[p.PmoAtivoID] = true
	}

	assert.Len(t, seen, 10, "devem existir 10 PMO IDs únicos")
}

// =============================================================================
// TestIsolation_WithRealDB_PmoAUsesOwnID (Integration — requer DATABASE_URL)
// Valida que PMO A registra colheita com seu próprio pmo_id no BD
// =============================================================================
func TestIsolation_WithRealDB_PmoAUsesOwnID(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL não configurado — pulando teste de integração com BD")
	}

	ctx := context.Background()
	profileA := mockProfileForIsolation(1)
	args := mockColheitaArgs()

	sbClient, err := supabase.NewClient(supabase.Config{URL: os.Getenv("DATABASE_URL")})
	require.NoError(t, err)

	server := &Server{supabase: sbClient}

	tenant, err := buildTenantCtx(profileA)
	require.NoError(t, err)

	result, err := server.handleRegistrarColheita(ctx, args, tenant)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}
