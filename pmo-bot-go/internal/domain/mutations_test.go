package domain

import (
	"encoding/json"
	"testing"
)

func TestDeriveOperationIdempotencyKey(t *testing.T) {
	draftID := "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
	
	key0 := DeriveOperationIdempotencyKey(draftID, 0)
	if key0 != "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d-op-0" {
		t.Fatalf("Esperava key0 correta, obteve: %s", key0)
	}

	key1 := DeriveOperationIdempotencyKey(draftID, 1)
	if key1 != "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d-op-1" {
		t.Fatalf("Esperava key1 correta, obteve: %s", key1)
	}
}

func TestBatchMutationPayloadSerialization(t *testing.T) {
	jsonInput := `{
		"operacoes": [
			{
				"type": "compra_insumo",
				"payload": {
					"produto": "Adubo Orgânico",
					"quantidade_valor": 10,
					"quantidade_unidade": "sacos",
					"valor_total": 500
				}
			},
			{
				"type": "caderno_campo",
				"tipo_operacao": "plantio",
				"payload": {
					"produto": "Tomate",
					"quantidade_valor": 2,
					"quantidade_unidade": "sacos",
					"talhao_nome": "Talhão 1"
				}
			}
		],
		"resumo_amigavel": "Compra de adubo e plantio de tomate"
	}`

	var payload ProposeBatchMutationsPayload
	err := json.Unmarshal([]byte(jsonInput), &payload)
	if err != nil {
		t.Fatalf("Erro ao deserializar payload: %v", err)
	}

	if len(payload.Operacoes) != 2 {
		t.Fatalf("Esperava 2 operações, obteve %d", len(payload.Operacoes))
	}

	if payload.Operacoes[0].Type != "compra_insumo" {
		t.Errorf("Esperava compra_insumo, obteve %s", payload.Operacoes[0].Type)
	}

	if payload.Operacoes[1].TipoOperacao != "plantio" {
		t.Errorf("Esperava plantio, obteve %s", payload.Operacoes[1].TipoOperacao)
	}
}
