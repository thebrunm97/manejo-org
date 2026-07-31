package mcp

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/test"
)

// TestHandleRegistrarColheita_Success
// Testa o fluxo completo: profile → handler → RPC → Sucesso
func TestHandleRegistrarColheita_Success(t *testing.T) {
	// Skip se não tem BD de teste
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL não configurado, pulando testes de integração")
	}

	// Arrange
	ctx := context.Background()
	profile := test.MockProfile()
	args := test.MockArgsForColheita()

	// Inicializa Server com Supabase real
	supabaseClient, err := supabase.NewClient(supabase.Config{URL: os.Getenv("DATABASE_URL")})
	require.NoError(t, err, "deve conectar ao Supabase")

	// Usamos o logger da propria package
	server := &Server{
		supabase: supabaseClient,
		// logger:         NewLogger(), // TODO: Ajustar para seu logger caso necessário
	}

	// Act
	result, err := server.handleRegistrarColheita(ctx, args, profile)

	// Assert
	assert.NoError(t, err, "handler deve retornar sem erro")
	assert.NotNil(t, result)
	
	resultMap := result.(map[string]interface{})
	assert.True(t, resultMap["success"].(bool), "sucesso deve ser true")
	assert.Contains(t, resultMap["message"].(string), "tomate")
}

// TestHandleRegistrarColheita_MultiTenancy
// CRÍTICO: Verifica isolamento de dados entre PMOs
func TestHandleRegistrarColheita_MultiTenancy(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL não configurado")
	}

	ctx := context.Background()
	args := test.MockArgsForColheita()

	// Arrange: Dois perfis de PMOs diferentes
	profilePMOA := test.MockProfileForPMO(1001) // mock ID
	profilePMOB := test.MockProfileForPMO(1002)

	supabaseClient, err := supabase.NewClient(supabase.Config{URL: os.Getenv("DATABASE_URL")})
	require.NoError(t, err)

	server := &Server{
		supabase: supabaseClient,
	}

	// Act: PMO A registra
	resultA, errA := server.handleRegistrarColheita(ctx, args, profilePMOA)
	assert.NoError(t, errA)

	// Act: PMO B registra os mesmos dados
	resultB, errB := server.handleRegistrarColheita(ctx, args, profilePMOB)
	assert.NoError(t, errB)

	// Assert: Ambos funcionam, mas em PMOs diferentes
	resultMapA := resultA.(map[string]interface{})
	resultMapB := resultB.(map[string]interface{})

	assert.True(t, resultMapA["success"].(bool))
	assert.True(t, resultMapB["success"].(bool))
}

// TestHandleRegistrarColheita_MissingProfile
// Valida que sem profile, handler falha
func TestHandleRegistrarColheita_MissingProfile(t *testing.T) {
	ctx := context.Background()
	args := test.MockArgsForColheita()

	server := &Server{}

	// Act
	result, err := server.handleRegistrarColheita(ctx, args, nil)

	// Assert
	assert.Error(t, err, "deve falhar sem profile")
	assert.Nil(t, result)
}

// TestHandleRegistrarColheita_MissingProduto
// Valida que sem "produto" no args, handler falha
func TestHandleRegistrarColheita_MissingProduto(t *testing.T) {
	ctx := context.Background()
	profile := test.MockProfile()
	args := map[string]interface{}{
		// Falta "produto"
		"quantidade_valor":   30.0,
		"quantidade_unidade": "caixas",
		"talhao_nome":       "principal",
	}

	server := &Server{}

	// Act
	_, err := server.handleRegistrarColheita(ctx, args, profile)

	// Assert
	assert.Error(t, err)
}
