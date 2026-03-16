package tests

import (
	"log"
	"os"
	"testing"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
)

func TestExpertFallback(t *testing.T) {
	// 1. Setup Environment
	godotenv.Load("../.env")

	geminiKey := os.Getenv("GEMINI_API_KEY")
	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.0-flash"
	}

	if geminiKey == "" {
		t.Skip("Skipping test: GEMINI_API_KEY not found")
	}

	// 2. Initialize Client
	gemClient, err := gemini.NewClient(gemini.Config{
		APIKey: geminiKey,
		Model:  model,
	})
	if err != nil {
		t.Fatalf("Failed to create Gemini client: %v", err)
	}

	// 3. Test AskExpert (The one that failed for the user)
	question := "Quais melhores cultivares de cenoura organica?"
	log.Printf("🧪 Testando AskExpert com a pergunta: %s", question)
	
	answer, err := gemClient.AskExpert(question)
	if err != nil {
		t.Errorf("AskExpert failed: %v", err)
	} else {
		t.Logf("✅ Resposta recebida (Primeiros 100 caracteres): %.100s...", answer)
		if len(answer) < 20 {
			t.Errorf("Resposta muito curta: %s", answer)
		}
	}
}
