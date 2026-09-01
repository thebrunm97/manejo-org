package mcp

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Os casos "Missing Profile" que existiam aqui antes do DT-67 testavam uma
// checagem que vivia dentro de cada handler (if profile == nil {...}) — essa
// checagem não existe mais: TenantCtx é sempre resolvido e validado por
// buildTenantCtx ANTES de qualquer handler rodar, então não há como um
// handler ser chamado com um "tenant ausente" para testar aqui. Esse portão
// já está coberto em multitenancy_test.go e cross_tenancy_test.go. O que
// resta testar neste arquivo é só a validação de negócio de cada handler.

func TestHandleCadastrarPropriedade_Validation(t *testing.T) {
	server := &Server{}
	ctx := context.Background()
	tenant := TenantCtx{UserID: "user-123"}

	res, err := server.handleCadastrarPropriedade(ctx, map[string]interface{}{"area_total_ha": 15.0}, tenant)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "nome da propriedade é obrigatório")
}

func TestHandleRegistrarManejoCampo_Validation(t *testing.T) {
	server := &Server{}
	ctx := context.Background()
	tenant := TenantCtx{UserID: "user-123", PmoID: 10, PropriedadeID: 5}

	res, err := server.handleRegistrarManejoCampo(ctx, map[string]interface{}{"tipo_manejo": "Adubação"}, tenant)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "talhao_nome é obrigatório")
}

func TestHandleRegistrarCotaCooperativa_Validation(t *testing.T) {
	server := &Server{}
	ctx := context.Background()
	tenant := TenantCtx{UserID: "user-123", PropriedadeID: 5}

	res, err := server.handleRegistrarCotaCooperativa(ctx, map[string]interface{}{"quantidade_comprometida": 100.0}, tenant)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "demanda_id é obrigatório")

	// Invalid Quantidade (<= 0)
	res, err = server.handleRegistrarCotaCooperativa(ctx, map[string]interface{}{"demanda_id": "1", "quantidade_comprometida": -5.0}, tenant)
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "maior que zero")
}
