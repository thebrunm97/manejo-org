package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

func main() {
	// 1. Carregar .env
	err := godotenv.Load("../../.env")
	if err != nil {
		log.Printf("⚠️ Erro ao carregar .env da raiz, tentando local...")
		godotenv.Load(".env")
	}

	apiKey := os.Getenv("OPENROUTER_API_KEY")
	model := os.Getenv("OPENROUTER_MODEL")

	if apiKey == "" {
		log.Fatal("❌ OPENROUTER_API_KEY não encontrada no ambiente")
	}

	fmt.Printf("🚀 Iniciando Teste OpenRouter\n")
	fmt.Printf("Modelo: %s\n\n", model)

	// 2. Inicializar Cliente
	cfg := gemini.Config{
		OpenRouterAPIKey: apiKey,
		OpenRouterModel:  model,
	}
	client, err := gemini.NewClient(cfg)
	if err != nil {
		log.Fatalf("❌ Erro ao criar cliente: %v", err)
	}

	// 3. Definir Ferramenta (A de adubação da Fase 2)
	toolAdubacao := llm.FerramentaAgnostica{
		Name:        "calcular_recomendacao_adubacao",
		Description: "Calcula a recomendação técnica de adubação para uma cultura e área específica.",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"cultura": map[string]interface{}{
					"type":        "string",
					"description": "Nome da cultura (ex: alface, milho, café)",
				},
				"area_hectares": map[string]interface{}{
					"type":        "number",
					"description": "Área do talhão em hectares",
				},
			},
			"required": []string{"cultura", "area_hectares"},
		},
	}

	// 4. Criar Histórico Agnóstico
	history := []llm.MensagemAgnostica{
		{
			Role:    llm.PapelUser,
			Content: "Vou plantar alface numa área de 3.5 hectares, qual a recomendação de adubo?",
		},
	}

	// 5. Chamada Isolada à OpenRouter
	fmt.Println("📡 Enviando pedido para OpenRouter...")
	resp, err := client.CallOpenRouter(context.Background(), "", history, []llm.FerramentaAgnostica{toolAdubacao}, nil)
	if err != nil {
		log.Fatalf("❌ Erro na chamada: %v", err)
	}

	// 6. Exibir Resultado
	fmt.Printf("\n--- RESULTADO DA API ---\n")
	fmt.Printf("Provedor: %s\n", resp.Provider)
	fmt.Printf("Modelo Efetivo: %s\n", resp.Model)
	fmt.Printf("Resposta Texto: %s\n", resp.Texto)
	fmt.Printf("Tokens: %+v\n", resp.Usage)

	if len(resp.ToolCalls) > 0 {
		fmt.Printf("\n🛠️ TOOL CALLS DETECTADAS (%d):\n", len(resp.ToolCalls))
		for i, tc := range resp.ToolCalls {
			fmt.Printf("[%d] Nome: %s\n", i+1, tc.Nome)
			fmt.Printf("    Args: %+v\n", tc.Args)
		}
	} else {
		fmt.Println("\n⚠️ Nenhuma Tool Call detectada. A IA respondeu apenas com texto.")
	}
}
