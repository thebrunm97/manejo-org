package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

func main() {
	_ = godotenv.Load(".env")
	apiKey := os.Getenv("GEMINI_API_KEY")

	ctx := context.Background()
	client, err := genai.NewClient(ctx, 
		option.WithAPIKey(apiKey),
		option.WithEndpoint("https://generativelanguage.googleapis.com/v1beta"),
	)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	fmt.Println("Listing models in v1beta...")
	iter := client.ListModels(ctx)
	for {
		m, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("- %s (Methods: %v)\n", m.Name, m.SupportedGenerationMethods)
	}
}
