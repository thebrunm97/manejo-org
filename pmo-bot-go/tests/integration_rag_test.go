package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/webhook"
)

func TestRAGIntegration(t *testing.T) {
	// 1. Setup Environment
	godotenv.Load("../.env")

	sbURL := os.Getenv("SUPABASE_URL")
	sbKey := os.Getenv("SUPABASE_KEY")
	geminiKey := os.Getenv("GEMINI_API_KEY")
	token := os.Getenv("WPPCONNECT_TOKEN")

	if sbURL == "" || sbKey == "" || geminiKey == "" {
		t.Skip("Skipping integration test: missing environment variables")
	}

	// 2. Initialize Clients & Handler
	sbClient, err := supabase.NewClient(supabase.Config{URL: sbURL, Key: sbKey})
	if err != nil {
		t.Fatalf("Failed to create Supabase client: %v", err)
	}

	gemClient, err := gemini.NewClient(gemini.Config{APIKey: geminiKey})
	if err != nil {
		t.Fatalf("Failed to create Gemini client: %v", err)
	}

	handler := webhook.NewHandler(webhook.Config{
		SupabaseClient: sbClient,
		GeminiClient:   gemClient,
		Token:          token,
	})

	router := gin.New()
	handler.RegisterRoutes(router)

	// 3. Prepare Test PDF (using existing small one)
	testFile := "../docs/knowledge_base/INC_17_28052009_EXTRATIVISMOSUSTENTVEL.pdf"
	pmoID := int64(999999) // Isolated test ID
	docName := "integration_test_doc.pdf"

	file, err := os.Open(testFile)
	if err != nil {
		t.Fatalf("Failed to open test file: %v", err)
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", docName)
	if err != nil {
		t.Fatalf("Failed to create form file: %v", err)
	}
	io.Copy(part, file)
	writer.WriteField("pmo_id", fmt.Sprintf("%d", pmoID))
	writer.Close()

	// 4. Test Upload (Async)
	req, _ := http.NewRequest("POST", "/knowledge/upload?token="+token, body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202, got %d. Response: %s", w.Code, w.Body.String())
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "processing" {
		t.Errorf("Expected status 'processing', got '%s'", resp["status"])
	}

	t.Logf("✅ Upload accepted. Starting polling for PMO %d...", pmoID)

	// 5. Database Polling (Wait for goroutine)
	found := false
	maxAttempts := 15

	// Create a real query for polling
	queryText := "extrativismo"
	pollEmb, _ := gemClient.GenerateEmbedding(queryText)

	for i := 0; i < maxAttempts; i++ {
		t.Logf("Attempt %d/%d: Checking Supabase for chunks with query '%s'...", i+1, maxAttempts, queryText)

		results, err := sbClient.MatchFarmDocuments(pmoID, pollEmb, 0.1, 1) // Using 0.1 threshold

		if err == nil && len(results) > 0 {
			found = true
			t.Logf("✅ Successfully found %d chunks in Supabase!", len(results))
			break
		}

		time.Sleep(2 * time.Second)
	}

	if !found {
		t.Fatal("❌ Timeout: Chunks were not inserted after 30 seconds.")
	}

	// 6. Test Hybrid Retrieval
	t.Log("🔍 Testing Hybrid Retrieval...")
	queryEmb, _ := gemClient.GenerateEmbedding("extrativismo sustentável")
	matches, err := sbClient.MatchFarmDocuments(pmoID, queryEmb, 0.5, 3)
	if err != nil {
		t.Errorf("Search failed: %v", err)
	}

	if len(matches) == 0 {
		t.Error("Search returned 0 results, expected at least one.")
	} else {
		t.Logf("✅ Match found: %s (Similarity: %f)", matches[0].DocumentName, matches[0].Similarity)
		if matches[0].DocumentName != docName {
			t.Errorf("Expected document name %s, got %s", docName, matches[0].DocumentName)
		}
	}

	// 7. Cleanup (Optional but recommended)
	// We'll leave it for now to let the user see the data,
	// or we could add a DELETE RPC in Supabase.
	t.Log("⚠️ Remember to cleanup PMO_ID 999999 in Supabase later.")
}
