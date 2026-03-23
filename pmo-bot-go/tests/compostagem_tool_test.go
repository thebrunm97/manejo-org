package tests

import (
	"encoding/json"
	"testing"
)

// Dummy test format. To fully run this we need the actual mcp.Server instance
// Here we just test the JSON unmarshaling and arg mapping logic to ensure it doesn't panic.

func TestCompostagemArguments(t *testing.T) {
	fakeToolCallArgs := `{
		"identificador_pilha": "Pilha Teste",
		"acao": "Nova Pilha",
		"ingredientes": "Folhas e restos",
		"responsavel": "Tester"
	}`

	var args map[string]interface{}
	err := json.Unmarshal([]byte(fakeToolCallArgs), &args)
	if err != nil {
		t.Fatalf("falha no unmarshall: %v", err)
	}

	// Validate presence of required keys usually mapped by Groq
	if args["identificador_pilha"] != "Pilha Teste" {
		t.Errorf("expected identificador_pilha = Pilha Teste")
	}

	if args["acao"] != "Nova Pilha" {
		t.Errorf("expected acao = Nova Pilha")
	}
}
