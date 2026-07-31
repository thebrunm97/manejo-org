package state

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/test"
)

// TestOrchestratorColheitaFlow
// Testa fluxo COMPLETO: perfil → orquestrador → handlers → RPC
func TestOrchestratorColheitaFlow(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL não configurado")
	}

	ctx := context.Background()
	profile := test.MockProfile()

	// Simula mensagem de áudio transcrita
	userMessage := "Ô bot, colhi 30 caixas de tomate no talhão principal"

	// Arrange: Inicializa orquestrador com Supabase real
	supabaseClient, err := supabase.NewClient(supabase.Config{URL: os.Getenv("DATABASE_URL")})
	require.NoError(t, err)

	mcpServer := mcp.NewServer(supabaseClient, nil, nil, nil)
	orchestrator := NewOrchestrator(nil, supabaseClient, mcpServer)

	// Act
	response, _, _, _, _, err := orchestrator.ExecuteAgenticLoop(ctx, profile, "", userMessage, nil, nil, nil, "", "", RouterResult{})

	// Assert
	assert.NoError(t, err, "orquestrador não deve retornar erro")
	assert.NotEmpty(t, response, "deve retornar resposta")
	
	// Resposta deve confirmar sucesso
	assert.Contains(t, response, "sucesso", "resposta deve confirmar")
	assert.Contains(t, response, "tomate", "resposta deve mencionar produto")
}

// TestOrchestratorSlotFilling
// Testa quando faltam dados (LLM faz slot filling)
func TestOrchestratorSlotFilling(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL não configurado")
	}

	ctx := context.Background()
	profile := test.MockProfile()

	// Mensagem incompleta (sem quantidade)
	userMessage := "Colhi tomate no talhão"

	supabaseClient, err := supabase.NewClient(supabase.Config{URL: os.Getenv("DATABASE_URL")})
	require.NoError(t, err)

	mcpServer := mcp.NewServer(supabaseClient, nil, nil, nil)
	orchestrator := NewOrchestrator(nil, supabaseClient, mcpServer)

	// Act
	response, _, _, _, _, err := orchestrator.ExecuteAgenticLoop(ctx, profile, "", userMessage, nil, nil, nil, "", "", RouterResult{})

	// Assert: Pode ser erro ou LLM pedindo dados
	// A crítico é que NÃO falhe silenciosamente
	assert.True(t, err != nil || response != "", "deve retornar erro ou resposta")
}
