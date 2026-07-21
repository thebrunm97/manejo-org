package state_test

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/prompt"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestAgenticShootout(t *testing.T) {
	t.Skip("Pulando teste de shootout devido a timeouts da API externa")

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

	// Precisamos do Gemini real apenas para Embeddings
	geminiCfg := gemini.Config{
		APIKey: geminiAPIKey,
	}
	geminiClient, err := gemini.NewClient(geminiCfg)
	if err != nil {
		t.Fatalf("Erro ao inicializar gemini: %v", err)
	}

	models := []string{"tencent/hy3-preview", "deepseek/deepseek-v4-flash", "moonshotai/kimi-k2.6"}

	fmt.Println("\n=========================================================================================")
	fmt.Println("🏆 ARENA DE MODELOS (SHOOTOUT) - RAG Agentic Loop")
	fmt.Println("=========================================================================================")
	fmt.Printf("%-30s | %-12s | %-10s | %-20s\n", "Modelo (OpenRouter)", "Latência", "Turnos", "Resultado")
	fmt.Println("-----------------------------------------------------------------------------------------")

	for _, modelName := range models {
		// Run synchronously inside the loop to measure time clearly
		t.Run(modelName, func(t *testing.T) {
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

			// Injetar o Embedder real do Gemini no MCP Server
			agriRepo := ports.NewMockAgriculturalRepository[mcp.OperacaoLoteItem]()
			mcpServer := mcp.NewServer(sbClient, agriRepo, geminiClient.Embedder(), provider)
			mcpServer.InitializeTools()

			// Setup Orquestrador
			orchestrator := state.NewOrchestrator(provider, sbClient, mcpServer)

			// Configurar Loop Guard
			guard := mcp.NewLoopGuard(3)

			// Cenário simulado
			query := "Vou aplicar esterco. O que diz a lei?"
			profile := &supabase.Profile{
				ID:                     "test-user-id",
				PmoAtivoID:             0, // Usar global
				ModalidadePredominante: "ORGÂNICO",
			}
			specPrompt := prompt.ForIntent(llm.IntentRAG, profile.ModalidadePredominante, false)
			
			// Filtrar ferramentas do MCP
			tools := mcpServer.GetToolsForIntent(string(llm.IntentRAG))
			
			// Execução do orquestrador
			botResponse, _, _, usage, _, err := orchestrator.ExecuteAgenticLoop(
				ctx,
				profile,
				specPrompt,
				query,
				tools,
				nil, // Sem histórico anterior
				guard,
				"general",
				"",
			)

			// Em caso de err
			if err != nil {
				fmt.Printf("%-30s | %-12s | %-10s | %-20s\n", modelName, "FALHA", "N/A", err.Error())
				t.Errorf("Orchestrator falhou no modelo %s: %v", modelName, err)
				return
			}
			
			// Se sucesso, contamos turnos (aproximando pelo total de tokens vs turnos)
			// Mas nós não temos o count de "turnos" retornado. Vamos apenas imprimir o usage
			
			// Para o terminal:
			resStr := "Sucesso"
			if len(botResponse) < 10 {
				resStr = "Resposta Vazia"
			}
			
			fmt.Printf("%-30s | %-12s | %-10d | %-20s\n", modelName, "OK", usage.TotalTokens, resStr)
		})
	}
	fmt.Println("=========================================================================================")
}
