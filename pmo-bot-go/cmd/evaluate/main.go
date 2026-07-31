package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/knowledge"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env if present
	_ = godotenv.Load()

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	openRouterKey := os.Getenv("OPENROUTER_API_KEY")

	if supabaseURL == "" || supabaseKey == "" || openRouterKey == "" {
		log.Fatal("Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY)")
	}

	sb, err := supabase.NewClient(supabase.Config{
		URL: supabaseURL,
		Key: supabaseKey,
	})
	if err != nil {
		log.Fatalf("Failed to initialize Supabase client: %v", err)
	}

	judgeProvider, err := llm.NewOpenAIAdapter(llm.OpenAIAdapterConfig{
		APIKey:  openRouterKey,
		BaseURL: "https://openrouter.ai/api/v1",
		Model:   "openai/gpt-4o-mini", // overridden by AutomatedEvaluator anyway
	})
	if err != nil {
		log.Fatalf("Failed to initialize LLM provider: %v", err)
	}

	evaluator := knowledge.NewAutomatedEvaluator(sb, judgeProvider)

	ctx := context.Background()

	log.Println("Starting RAG Judgment Evaluation Batch Processing...")

	limit := 10 // process 10 at a time
	totalProcessed := 0
	totalFailed := 0

	for {
		judgments, err := sb.GetPendingRagExperimentEvaluations(ctx, limit)
		if err != nil {
			log.Fatalf("Failed to fetch pending judgments: %v", err)
		}

		if len(judgments) == 0 {
			log.Println("No pending judgments found. Exiting.")
			break
		}

		log.Printf("Found %d pending judgments. Processing...", len(judgments))

		for _, j := range judgments {
			log.Printf("Evaluating judgment for run: %s", j.RunID)
			err := evaluator.EvaluateRun(ctx, j)
			if err != nil {
				log.Printf("Failed to evaluate run %s: %v", j.RunID, err)
				totalFailed++
			} else {
				log.Printf("Successfully evaluated run %s", j.RunID)
				totalProcessed++
			}
			
			// Optional: slight sleep to avoid rate limits
			time.Sleep(1 * time.Second)
		}
	}

	log.Printf("Batch processing complete. Processed: %d, Failed: %d", totalProcessed, totalFailed)
}
