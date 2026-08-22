package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

func main() {
	_ = godotenv.Load(".env")
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		fmt.Println("Erro: OPENROUTER_API_KEY não definida")
		os.Exit(1)
	}

	cfg := llm.OpenAIAdapterConfig{
		APIKey:      apiKey,
		Model:       "nvidia/nemotron-3-ultra-550b-a55b:free",
		BaseURL:     "https://openrouter.ai/api/v1",
		HTTPReferer: "http://localhost:3000",
		AppTitle:    "Manejo Org Dev",
	}

	adapter, err := llm.NewOpenAIAdapter(cfg)
	if err != nil {
		fmt.Printf("Erro ao inicializar adapter: %v\n", err)
		os.Exit(1)
	}

	systemPrompt := `Você é o assistente financeiro do sistema Manejo Org. O ID da sua propriedade atual é 1.
EXECUÇÃO OBRIGATÓRIA DE TOOL FINANCEIRA: Se o usuário fizer qualquer pergunta sobre saldo, receita, despesas, balanço financeiro, DRE ou saúde financeira da fazenda, você DEVE OBRIGATORIAMENTE chamar a ferramenta de consulta (get_dre_mensal). NUNCA responda com texto livre ou estimativas financeiras sem antes extrair os dados reais usando a ferramenta.
NUNCA tente registrar dados quando o produtor está apenas perguntando.`

	userMessage := "Qual foi o meu resultado financeiro ao longo do ano de 2026? Quero ver mês a mês."

	tool := llm.FerramentaAgnostica{
		Name:        "get_dre_mensal",
		Description: "Retorna o DRE (Demonstrativo de Resultado) mensal de uma propriedade para um ano específico.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"p_propriedade_id": map[string]any{
					"type":        "integer",
					"description": "ID da propriedade do produtor",
				},
				"p_ano": map[string]any{
					"type":        "integer",
					"description": "Ano de referência para o DRE",
				},
			},
			"required": []string{"p_propriedade_id", "p_ano"},
		},
	}

	req := llm.ContentRequest{
		SystemInstruction: systemPrompt,
		History: []llm.MensagemAgnostica{
			{Role: llm.PapelUser, Content: userMessage},
		},
		Tools: []llm.FerramentaAgnostica{tool},
	}

	totalRuns := 15
	successCount := 0
	runsCompleted := 0

	fmt.Println("--- INICIANDO BASELINE NEMOTRON S3 ---")
	fmt.Printf("Objetivo: %d execuções válidas\n\n", totalRuns)

	for runsCompleted < totalRuns {
		fmt.Printf("[Run %d/%d] Executando... ", runsCompleted+1, totalRuns)
		
		start := time.Now()
		resp, err := adapter.GenerateContent(context.Background(), req)
		latency := time.Since(start)

		if err != nil {
			fmt.Printf("Erro/Rate Limit na API: %v. Ignorando run e aguardando 5s... (Latência: %v)\n", err, latency)
			time.Sleep(5 * time.Second)
			continue
		}

		runsCompleted++
		
		if len(resp.ToolCalls) > 0 {
			fmt.Printf("✅ TOOL CALL GERADA (Latência: %v)\n", latency)
			for i, tc := range resp.ToolCalls {
				fmt.Printf("   -> Tool %d: %s | Args: %v\n", i+1, tc.Nome, tc.Args)
			}
			successCount++
		} else {
			fmt.Printf("❌ SEM TOOL CALL (Latência: %v)\n", latency)
			fmt.Printf("   -> Resposta do modelo: %s\n", resp.Texto)
		}
		
		// Pequena pausa para evitar rate limit massivo
		time.Sleep(2 * time.Second)
	}

	fmt.Println("\n--- RESULTADOS DA BASELINE ---")
	fmt.Printf("Total Execuções Válidas: %d\n", runsCompleted)
	fmt.Printf("Sucessos (Tool Call): %d\n", successCount)
	fmt.Printf("Hit-rate: %.2f%%\n", float64(successCount)/float64(runsCompleted)*100)
}
