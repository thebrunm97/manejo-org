//go:build e2e

package e2e

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
)

// Smoke de conectividade com o banco: grava e lê de volta uma mensagem em
// messages, a tabela que o bot usa para o histórico de conversa
// (supabase.Client.InsertMessage). Antes usava memoria_llm, tabela órfã que
// nenhuma migration cria.
func TestSmokeE2E(t *testing.T) {
	client := SetupSupabaseClient(t)
	TeardownE2E(t, client)
	defer TeardownE2E(t, client)

	body, _ := json.Marshal(map[string]interface{}{
		"phone":   TestPhone,
		"role":    "user",
		"content": "SMOKE TEST MESSAGE",
	})
	resp := restRequest(t, http.MethodPost, "messages", body)
	corpo, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("insert em messages retornou %d: %s", resp.StatusCode, corpo)
	}

	for _, rec := range restGet(t, fmt.Sprintf("messages?phone=eq.%s&select=content", TestPhone)) {
		if rec["content"] == "SMOKE TEST MESSAGE" {
			return
		}
	}
	t.Fatal("a mensagem de smoke test não foi encontrada em messages")
}
