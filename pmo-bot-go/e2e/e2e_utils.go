//go:build e2e

package e2e

import (
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

const TestPMOID int64 = 9999

func SetupSupabaseClient(t *testing.T) *supabase.Client {
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	if url == "" || key == "" {
		t.Fatalf("SUPABASE_URL e SUPABASE_KEY sao obrigatorios para testes E2E")
	}

	cfg := supabase.Config{
		URL: url,
		Key: key,
	}

	client, err := supabase.NewClient(cfg)
	if err != nil {
		t.Fatalf("Erro ao inicializar supabase client: %v", err)
	}

	return client
}

func TeardownE2E(t *testing.T, client *supabase.Client) {
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_KEY")

	tables := []string{
		"memoria_llm",
		"operacoes_agronomicas",
		"transacoes_financeiras",
		"colheitas",
		"farm_documents_chunks",
		"farm_documents",
	}

	httpClient := &http.Client{}

	for _, table := range tables {
		reqURL := fmt.Sprintf("%s/rest/v1/%s?pmo_id=eq.%d", url, table, TestPMOID)
		req, err := http.NewRequest(http.MethodDelete, reqURL, nil)
		if err != nil {
			t.Errorf("Erro ao criar request de DELETE para tabela %s: %v", table, err)
			continue
		}

		req.Header.Set("apikey", key)
		req.Header.Set("Authorization", "Bearer "+key)

		resp, err := httpClient.Do(req)
		if err != nil {
			t.Errorf("Erro ao executar DELETE na tabela %s: %v", table, err)
			continue
		}
		
		if resp.StatusCode >= 400 {
			t.Errorf("Falha ao limpar tabela %s. StatusCode: %d", table, resp.StatusCode)
		} else {
			t.Logf("Tabela %s limpa com sucesso (Status %d)", table, resp.StatusCode)
		}
		resp.Body.Close()
	}
}
