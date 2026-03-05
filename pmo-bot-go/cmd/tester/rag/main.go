package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func main() {
	godotenv.Load(".env")

	gemKey := os.Getenv("GEMINI_API_KEY")
	sbURL := os.Getenv("SUPABASE_URL")
	sbKey := os.Getenv("SUPABASE_KEY")

	gemClient, err := gemini.NewClient(gemini.Config{APIKey: gemKey})
	if err != nil {
		log.Fatalf("Failed to init Gemini: %v", err)
	}

	sbClient, err := supabase.NewClient(supabase.Config{URL: sbURL, Key: sbKey})
	if err != nil {
		log.Fatalf("Failed to init Supabase: %v", err)
	}

	farmA := int64(999991)
	farmB := int64(999992)
	globalID := int64(0) // 0 maps to NULL in our implementation

	fmt.Println("🧪 Starting HYBRID RAG Verification Test...")

	// 1. Ingest Global Knowledge
	contentGlobal := "DICA GLOBAL: O manejo orgânico exige certificação anual."
	embGlobal, err := gemClient.GenerateEmbedding(contentGlobal)
	if err != nil {
		log.Fatalf("Failed to gen embedding Global: %v", err)
	}
	err = sbClient.InsertFarmDocument(globalID, "guia_geral.pdf", contentGlobal, embGlobal)
	if err != nil {
		log.Fatalf("Failed to insert Global doc: %v", err)
	}
	fmt.Println("✅ Documento GLOBAL inserido.")

	// 2. Ingest for Farm A
	contentA := "PRIVADO A: O segredo da Fazenda A é plantar sob a lua cheia."
	embA, err := gemClient.GenerateEmbedding(contentA)
	if err != nil {
		log.Fatalf("Failed to gen embedding A: %v", err)
	}
	err = sbClient.InsertFarmDocument(farmA, "segredo_a.pdf", contentA, embA)
	if err != nil {
		log.Fatalf("Failed to insert doc A: %v", err)
	}
	fmt.Println("✅ Documento da Fazenda A inserido.")

	// 3. Search as Farm A
	fmt.Println("\n🔍 Buscando como Fazenda A: 'Como funciona o manejo e qual o segredo?'")
	queryEmb, err := gemClient.GenerateEmbedding("Como funciona o manejo e qual o segredo?")
	if err != nil {
		log.Fatalf("Failed to gen query embedding: %v", err)
	}
	resultsA, err := sbClient.MatchFarmDocuments(farmA, queryEmb, 0.3, 5)
	if err != nil {
		log.Fatalf("Failed to match docs A: %v", err)
	}

	foundGlobal := false
	foundPrivate := false
	foundB := false
	for _, res := range resultsA {
		typeStr := "PRIVADO"
		if res.IsGlobal {
			typeStr = "GLOBAL"
			foundGlobal = true
		} else if res.DocumentName == "segredo_a.pdf" {
			foundPrivate = true
		} else if res.DocumentName == "segredo_b.pdf" {
			foundB = true
		}
		fmt.Printf("   - [%.2f] [%s] %s: %s\n", res.Similarity, typeStr, res.DocumentName, res.Content)
	}

	if foundGlobal && foundPrivate {
		fmt.Println("🛡️  SUCESSO: Fazenda A acessou conhecimento GLOBAL e PRIVADO.")
	} else {
		fmt.Printf("❌ ERRO: Faltou algo. Global: %v, Private: %v\n", foundGlobal, foundPrivate)
	}

	if foundB {
		fmt.Println("❌ ERRO: Vazamento! Fazenda A viu documentos da Fazenda B.")
	}

	// 4. Search as Farm B
	fmt.Println("\n🔍 Buscando como Fazenda B: 'Qual o segredo?'")
	resultsB, err := sbClient.MatchFarmDocuments(farmB, queryEmb, 0.3, 5)
	if err != nil {
		log.Fatalf("Failed to match docs B: %v", err)
	}

	foundAInB := false
	for _, res := range resultsB {
		if res.DocumentName == "segredo_a.pdf" {
			foundAInB = true
		}
	}

	if foundAInB {
		fmt.Println("❌ ERRO: Vazamento! Fazenda B viu documentos da Fazenda A.")
	} else {
		fmt.Println("🛡️  SUCESSO: Fazenda B não acessou dados privados da Fazenda A.")
	}
}
