package state_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/prompt"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestAgenticMutationShootout(t *testing.T) {
	t.Skip("Pulando shootout em execuções de teste de unidade (evita falhas por instabilidade de LLM)")

	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		apiKey = "sk-or-v1-dummy"
	}

	sbURL := os.Getenv("SUPABASE_URL")
	sbKey := os.Getenv("SUPABASE_KEY")
	if sbURL == "" {
		sbURL = "https://hejewayflbuemnffrhae.supabase.co"
		sbKey = "sb_secret_dummy"
	}

	geminiAPIKey := os.Getenv("GEMINI_API_KEY")
	if geminiAPIKey == "" {
		geminiAPIKey = "AIzaSy_dummy"
	}

	sbClient, err := supabase.NewClient(supabase.Config{URL: sbURL, Key: sbKey})
	if err != nil {
		t.Fatalf("Erro ao inicializar supabase: %v", err)
	}

	geminiCfg := gemini.Config{
		APIKey: geminiAPIKey,
	}
	geminiClient, err := gemini.NewClient(geminiCfg)
	if err != nil {
		t.Fatalf("Erro ao inicializar gemini: %v", err)
	}

	models := []string{"tencent/hy3-preview", "deepseek/deepseek-chat"} // Skipped kimi because of timeout issues in Phase 1

	fmt.Println("\n=========================================================================================")
	fmt.Println("🏆 ARENA DE MUTAÇÃO (SHOOTOUT) - Agentic Loop")
	fmt.Println("=========================================================================================")
	fmt.Printf("%-30s | %-12s | %-20s\n", "Modelo (OpenRouter)", "Latência", "Resultado")
	fmt.Println("-----------------------------------------------------------------------------------------")

	for _, modelName := range models {
		t.Run(modelName, func(t *testing.T) {
			start := time.Now()
			ctx := context.Background()

			cfg := llm.FactoryConfig{
				ActiveProvider:   llm.ProviderOpenRouter,
				ActiveModel:      modelName,
				OpenRouterAPIKey: apiKey,
			}

			prompts := llm.PromptConfig{
				RouterPrompt:       prompt.RouterSystemPrompt(),
				VisionPrompt:       prompt.VisionPrompt(),
				MetaRAGJudgePrompt: prompt.MetaRAGJudgePrompt(),
			}

			provider, err := llm.NewOpenAICompatibleProvider(cfg, prompts)
			if err != nil {
				t.Fatalf("Erro ao criar provider para %s: %v", modelName, err)
			}

			agriRepo := ports.NewMockAgriculturalRepository[mcp.OperacaoLoteItem]()
			mcpServer := mcp.NewServer(sbClient, agriRepo, geminiClient.Embedder(), provider)
			mcpServer.InitializeTools()

			// MOCK DA FERRAMENTA DE MUTAÇÃO
			// Procurar a definição original e substituí-la
			var defRegistrarCompra llm.FerramentaAgnostica
			for _, tool := range mcpServer.ListTools() {
				if tool.Name == "registrar_compra_insumo" {
					defRegistrarCompra = tool
					break
				}
			}

			if defRegistrarCompra.Name == "" {
				t.Fatalf("Ferramenta registrar_compra_insumo não encontrada!")
			}

			toolCalled := false
			mcpServer.RegisterTool(mcp.Tool{
				Definition: defRegistrarCompra,
				Category:   mcp.CategoryDBWrite,
				Handler: func(args map[string]interface{}) (interface{}, error) {
					toolCalled = true
					// Validar se o LLM extraiu o produto e o valor corretamente
					produto, _ := args["produto"].(string)
					valorTotal, ok := args["valor_total"].(float64)
					if !ok || valorTotal <= 0 {
						return nil, fmt.Errorf("LLM falhou em extrair o valor total como numero: %v", args["valor_total"])
					}

					if produto == "" {
						return nil, fmt.Errorf("LLM falhou em extrair o produto")
					}

					return map[string]interface{}{
						"status":  "success",
						"message": fmt.Sprintf("Mock: Compra de %s registrada com valor %v", produto, valorTotal),
					}, nil
				},
			})

			orchestrator := state.NewOrchestrator(provider, sbClient, mcpServer)
			guard := mcp.NewLoopGuard(3)

			// Cenário simulado de mutação
			query := "Comprei 50kg de calcário da loja X por 100 reais."
			profile := &supabase.Profile{
				ID:                     "test-user-id",
				PmoAtivoID:             1,
				PropriedadeAtivaID:     1,
				ModalidadePredominante: "ORGÂNICO",
			}
			specPrompt := prompt.ForIntent(llm.IntentDatabase, profile.ModalidadePredominante, false)

			tools := mcpServer.GetToolsForIntent(string(llm.IntentDatabase))

			botResponse, _, _, _, _, err := orchestrator.ExecuteAgenticLoop(
				ctx,
				profile,
				specPrompt,
				query,
				tools,
				nil,
				guard,
				"general",
				"",
				state.RouterResult{},
			)

			lat := time.Since(start).Round(time.Millisecond)

			if err != nil {
				fmt.Printf("%-30s | %-12s | %-20s\n", modelName, lat, "FALHOU: "+err.Error())
				t.Errorf("Orchestrator falhou no modelo %s: %v", modelName, err)
				return
			}

			if !toolCalled {
				fmt.Printf("%-30s | %-12s | %-20s\n", modelName, lat, "FALHOU: Ferramenta não chamada")
				t.Errorf("A ferramenta registrar_compra_insumo não foi chamada pelo LLM %s. Resposta: %s", modelName, botResponse)
				return
			}

			fmt.Printf("%-30s | %-12s | %-20s\n", modelName, lat, "OK (Extraiu JSON e chamou)")
		})
	}
	fmt.Println("=========================================================================================")
}
