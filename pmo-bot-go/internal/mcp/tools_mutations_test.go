package mcp

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestHandleCadastrarPropriedade_Validation(t *testing.T) {
	server := &Server{}
	ctx := context.Background()

	// 1. Missing Profile
	res, err := server.handleCadastrarPropriedade(ctx, map[string]interface{}{"nome": "Fazenda Sol"}, nil)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "unauthorized")

	// 2. Missing Nome
	profile := &supabase.Profile{ID: "user-123", Telefone: "5511999999999"}
	res, err = server.handleCadastrarPropriedade(ctx, map[string]interface{}{"area_total_ha": 15.0}, profile)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "nome da propriedade é obrigatório")
}

func TestHandleRegistrarManejoCampo_Validation(t *testing.T) {
	server := &Server{}
	ctx := context.Background()

	// 1. Missing Profile
	res, err := server.handleRegistrarManejoCampo(ctx, map[string]interface{}{"talhao_nome": "Talhao 1"}, nil)
	assert.Error(t, err)
	assert.Nil(t, res)

	// 2. Missing Talhao
	profile := &supabase.Profile{ID: "user-123", PmoAtivoID: 10, PropriedadeAtivaID: 5}
	res, err = server.handleRegistrarManejoCampo(ctx, map[string]interface{}{"tipo_manejo": "Adubação"}, profile)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "talhao_nome é obrigatório")
}

func TestHandleRegistrarCotaCooperativa_Validation(t *testing.T) {
	server := &Server{}
	ctx := context.Background()

	// 1. Missing Profile
	res, err := server.handleRegistrarCotaCooperativa(ctx, map[string]interface{}{"demanda_id": "1"}, nil)
	assert.Error(t, err)
	assert.Nil(t, res)

	// 2. Missing Demanda ID
	profile := &supabase.Profile{ID: "user-123", PropriedadeAtivaID: 5}
	res, err = server.handleRegistrarCotaCooperativa(ctx, map[string]interface{}{"quantidade_comprometida": 100.0}, profile)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "demanda_id é obrigatório")

	// 3. Invalid Quantidade (<= 0)
	res, err = server.handleRegistrarCotaCooperativa(ctx, map[string]interface{}{"demanda_id": "1", "quantidade_comprometida": -5.0}, profile)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "maior que zero")
}
