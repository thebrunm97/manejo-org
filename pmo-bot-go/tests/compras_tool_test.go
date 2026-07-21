package tests

import (
	"encoding/json"
	"testing"
)

func TestComprasArguments(t *testing.T) {
	fakeToolCallArgs := `{
		"produto": "Semente de Alface",
		"fornecedor": "Agro B",
		"nota_fiscal": "112233",
		"quantidade_valor": 10,
        "quantidade_unidade": "unid"
	}`

	var args map[string]interface{}
	err := json.Unmarshal([]byte(fakeToolCallArgs), &args)
	if err != nil {
		t.Fatalf("falha no unmarshall: %v", err)
	}

	if args["produto"] != "Semente de Alface" {
		t.Errorf("expected produto = Semente de Alface")
	}

	if args["fornecedor"] != "Agro B" {
		t.Errorf("expected fornecedor = Agro B")
	}

	if args["quantidade_valor"].(float64) != 10 {
		t.Errorf("expected quantidade_valor = 10")
	}
}
