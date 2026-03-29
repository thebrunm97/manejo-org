package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
)

func main() {
	err := godotenv.Load("c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/pmo-bot-go/.env")
	if err != nil {
		log.Printf("Warning: .env not found, using environment variables")
	}

	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		log.Fatal("GROQ_API_KEY is required")
	}

	client, err := groq.NewClient(apiKey)
	if err != nil {
		log.Fatal(err)
	}

	userMessage := "Fiz a adubação de cobertura hoje cedo. Apliquei 2 sacos daquele Yoorin no Talhão 4, ali nos canteiros 1 e 2."
	
	fmt.Printf("Testing Message: %s\n", userMessage)
	
	result, err := client.Extract(userMessage)
	if err != nil {
		log.Fatal(err)
	}

	prettyJSON, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println("Extraction Result:")
	fmt.Println(string(prettyJSON))

	if result.Atividade == "Manejo" && result.InsumoAplicado == "YOORIN" {
		fmt.Println("\n✅ Verification Successful: Fields extracted correctly.")
	} else {
		fmt.Println("\n❌ Verification Failed: Some fields are missing or incorrect.")
	}
}
