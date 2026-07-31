//go:build e2e

package e2e

import (
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
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

// SetupLLMProvider resolves the active LLM provider from environment, matching production behavior.
func SetupLLMProvider(t *testing.T) llm.LLMProvider {
	activekind, factoryCfg := llm.NewProviderFromEnv()
	promptCfg := llm.PromptConfig{} // Em testes E2E de sistema interno, prompts reais não são carregados daqui ou podemos deixá-los vazios

	if activekind == llm.ProviderGemini {
		geminiModel := factoryCfg.GeminiModel
		if geminiModel == "" {
			geminiModel = "gemini-2.0-flash"
		}
		geminiFallback := factoryCfg.GeminiFallback
		if geminiFallback == "" {
			geminiFallback = "gemini-1.5-flash"
		}
		client, err := gemini.NewClient(gemini.Config{
			APIKey:          factoryCfg.GeminiAPIKey,
			OpenRouterAPIKey: factoryCfg.OpenRouterAPIKey,
			Model:           geminiModel,
			FallbackModel:   geminiFallback,
			APIVersion:      "v1",
		})
		if err != nil {
			t.Fatalf("Erro ao inicializar Gemini: %v", err)
		}
		return client
	}

	oadapter, err := llm.NewOpenAICompatibleProvider(factoryCfg, promptCfg)
	if err != nil {
		t.Fatalf("Erro ao inicializar provider OpenAI-compatible (%s): %v", activekind, err)
	}
	return oadapter
}
