package main

import (
	"context"
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
)

func main() {
	godotenv.Load()
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		fmt.Println("No API key")
		return
	}
	
	client, err := gemini.NewClient(gemini.Config{
		APIKey:        apiKey,
		Model:         "gemini-2.5-flash",
		FallbackModel: "gemini-2.5-flash",
	})
	if err != nil {
		panic(err)
	}
	
	s := mcp.NewServer(nil, nil, nil, nil)
	s.InitializeTools()
	tools := s.GetToolsForIntent("DATABASE")
	
	for i, tool := range tools {
		fmt.Printf("Testing tool %d: %s\n", i, tool.Name)
		req := llm.ContentRequest{
			SystemInstruction: "You are a test bot.",
			History: []llm.MensagemAgnostica{
				{Role: llm.PapelUser, Content: "Hello. Do not call any tools. Just say ok."},
			},
			Tools: []llm.FerramentaAgnostica{tool},
		}
		_, err := client.GenerateContent(context.Background(), req)
		if err != nil {
			fmt.Printf("ERROR on tool %d (%s): %v\n", i, tool.Name, err)
		} else {
			fmt.Printf("SUCCESS on tool %d (%s)\n", i, tool.Name)
		}
	}
}
