//go:build ignore

package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load(".env")
	godotenv.Load("../.env")

	if len(os.Args) < 2 {
		fmt.Println("Uso: go run scripts/count_chunks.go <source_document_id>")
		fmt.Println("Exemplo: go run scripts/count_chunks.go IN_13_28052015_CPOrg_e_STPOrg")
		os.Exit(1)
	}

	sourceDocID := os.Args[1]
	sbURL := os.Getenv("SUPABASE_URL")
	sbKey := os.Getenv("SUPABASE_KEY")
	if sbKey == "" {
		sbKey = os.Getenv("SUPABASE_SERVICE_KEY")
	}

	if sbURL == "" || sbKey == "" {
		log.Fatal("❌ SUPABASE_URL ou SUPABASE_KEY não definidos")
	}

	// GET com filtro exato por source_document_id e count=exact via header
	url := fmt.Sprintf("%s/rest/v1/farm_documents?select=id&source_document_id=eq.%s",
		sbURL, sourceDocID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Fatal(err)
	}
	req.Header.Set("apikey", sbKey)
	req.Header.Set("Authorization", "Bearer "+sbKey)
	req.Header.Set("Prefer", "count=exact")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("❌ Erro HTTP: %v", err)
	}
	defer resp.Body.Close()

	// Ler o body para depurar erros se necessário
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		log.Fatalf("❌ Supabase retornou status %d: %s", resp.StatusCode, string(body))
	}

	// O total exato vem em Content-Range: 0-N/TOTAL
	contentRange := resp.Header.Get("Content-Range")
	if contentRange == "" {
		log.Fatalf("❌ Header Content-Range ausente. Body: %s", string(body))
	}

	// Parsear o total: formato é "0-18/19" ou "*/19"
	total := "?"
	parts := strings.Split(contentRange, "/")
	if len(parts) == 2 {
		total = parts[1]
	}

	fmt.Printf("📊 source_document_id=%q → %s chunks no banco\n", sourceDocID, total)
}
