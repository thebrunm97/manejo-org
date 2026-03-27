package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
)

func main() {
	godotenv.Load(".env")
	apiKey := os.Getenv("GROQ_API_KEY")

	client, err := groq.NewClient(apiKey)
	if err != nil {
		log.Fatalf("Failed to create Groq client: %v", err)
	}

	farmerMessage := `[11:12, 24/03/2026] Hortiflora HF: CALCARIO DOLOMITICO SUPER 100 25KG CZG R$22,00
[11:12, 24/03/2026] Hortiflora HF: YOORIN TERMOFOSFATO MASTER 40 KG R$212,00
[11:12, 24/03/2026] Hortiflora HF: YOORIN TERMOF.MAGNESIANO 40 KG R$198,00

o que me diz sobre cada opção de insumo?`

	fmt.Println("🚀 Running the 'Test of Fire'...")
	fmt.Printf("Message:\n%s\n\n", farmerMessage)

	result, err := client.Extract(farmerMessage)
	if err != nil {
		log.Fatalf("Extraction failed: %v", err)
	}

	fmt.Println("══════════════════════════════════════════════════════════")
	fmt.Printf("🤖 Groq Result:\n")
	fmt.Printf("   - Intencao: %q (Expected: \"duvida\")\n", result.Intencao)
	fmt.Printf("   - Alerta Organico: %v\n", result.AlertaOrganico)
	
	if result.Intencao == "duvida" {
		fmt.Println("✅ SUCCESS: Intent correctly classified as 'duvida'!")
	} else {
		fmt.Printf("❌ FAILURE: Intent was %q, expected 'duvida'.\n", result.Intencao)
	}
	fmt.Println("══════════════════════════════════════════════════════════")
}
