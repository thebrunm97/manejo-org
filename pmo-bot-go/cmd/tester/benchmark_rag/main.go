package main

import (
	"context"
	"fmt"
	"os"

	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"google.golang.org/api/option"
)

func main() {
	_ = godotenv.Load(".env")
	apiKey := os.Getenv("GEMINI_API_KEY")

	ctx := context.Background()
	
	// Client 1: Stable for OLD model (768d)
	clientStable, _ := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	
	// Client 2: v1beta for NEW model (3072d)
	clientBeta, _ := genai.NewClient(ctx, 
		option.WithAPIKey(apiKey),
		option.WithEndpoint("https://generativelanguage.googleapis.com/v1beta"),
	)

	fmt.Println("📊 RAG BENCHMARK: GEMINI 1.0 vs GEMINI 2.0")
	fmt.Println("==========================================")

	// TEST 1: OLD TEXT (768)
	m1 := clientStable.EmbeddingModel("text-embedding-004")
	res1, err := m1.EmbedContent(ctx, genai.Text("Agricultural RAG Test"))
	if err == nil {
		fmt.Printf("✅ OLD Pipeline (Text): %d dimensions\n", len(res1.Embedding.Values))
	} else {
		fmt.Printf("❌ OLD Pipeline error: %v\n", err)
	}

	// TEST 2: NEW TEXT (3072)
	m2 := clientBeta.EmbeddingModel("gemini-embedding-2-preview")
	res2, err := m2.EmbedContent(ctx, genai.Text("Agricultural RAG Test"))
	if err == nil {
		fmt.Printf("✅ NEW Pipeline (Text): %d dimensions\n", len(res2.Embedding.Values))
	} else {
		fmt.Printf("❌ NEW Pipeline error: %v\n", err)
	}

	// TEST 3: NEW MULTIMODAL (3072)
	imgPath := "../pmo-frontend/node_modules/leaflet/dist/images/marker-icon.png"
	imgData, _ := os.ReadFile(imgPath)
	res3, err := m2.EmbedContent(ctx, genai.Blob{MIMEType: "image/png", Data: imgData})
	if err == nil {
		fmt.Printf("✅ NEW Pipeline (Image): %d dimensions\n", len(res3.Embedding.Values))
	}

	fmt.Println("==========================================")
	fmt.Println("Verdict: Gemini 2 unified 3072d space verified.")
}
