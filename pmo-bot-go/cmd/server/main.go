package main

import (
	"log"
	"os"

	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/webhook"
	"github.com/thebrunm97/pmo-bot-go/internal/whatsapp"
)

func main() {
	godotenv.Load(".env")
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		log.Printf("⚠️ Erro ao carregar timezone America/Sao_Paulo: %v. Usando UTC.", err)
	} else {
		time.Local = loc
	}
	log.Printf("⏰ Horário de Brasília configurado: %v", time.Now().Format(time.RFC1123))
	// --- Config from environment (fail-fast) ---
	token := os.Getenv("WPPCONNECT_TOKEN")
	if token == "" {
		log.Println("⚠️  WPPCONNECT_TOKEN não definido — todas as requests serão rejeitadas")
	}

	wppURL := os.Getenv("WPPCONNECT_URL")
	if wppURL == "" {
		log.Fatal("❌ WPPCONNECT_URL não definida")
	}

	wppSession := os.Getenv("WPP_SESSION")
	if wppSession == "" {
		log.Fatal("❌ WPP_SESSION não definida (ex: thebrum97)")
	}

	groqKey := os.Getenv("GROQ_API_KEY")
	if groqKey == "" {
		log.Fatal("❌ GROQ_API_KEY não definida — impossível iniciar sem a chave da Groq")
	}

	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		log.Fatal("❌ GEMINI_API_KEY não definida — especialista não vai funcionar")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// --- Initialize Groq client ---
	groqClient, err := groq.NewClient(groqKey)
	if err != nil {
		log.Fatalf("❌ Falha ao criar cliente Groq: %v", err)
	}
	log.Println("✅ Cliente Groq inicializado")

	// --- Initialize Gemini client ---
	geminiClient, err := gemini.NewClient(gemini.Config{
		APIKey: geminiKey,
	})
	if err != nil {
		log.Fatalf("❌ Falha ao criar cliente Gemini: %v", err)
	}
	log.Println("✅ Cliente Gemini inicializado (modelo: gemini-2.5-pro)")

	// --- Initialize Supabase client ---
	sbURL := os.Getenv("SUPABASE_URL")
	if sbURL == "" {
		log.Fatal("❌ SUPABASE_URL não definida")
	}
	sbKey := os.Getenv("SUPABASE_KEY")
	if sbKey == "" {
		log.Fatal("❌ SUPABASE_KEY não definida")
	}

	sbClient, err := supabase.NewClient(supabase.Config{
		URL: sbURL,
		Key: sbKey,
	})
	if err != nil {
		log.Fatalf("❌ Falha ao criar cliente Supabase: %v", err)
	}
	log.Println("✅ Cliente Supabase inicializado")

	// --- Initialize WhatsApp client ---
	wpClient, err := whatsapp.NewClient(whatsapp.Config{
		URL:     wppURL,
		Token:   token,
		Session: wppSession,
	})
	if err != nil {
		log.Fatalf("❌ Falha ao criar cliente WhatsApp: %v", err)
	}
	log.Println("✅ Cliente WhatsApp Outbound inicializado")

	// --- Gin setup ---
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery()) // Recover from panics without crashing

	// --- Initialize TTS Orchestrator ---
	ttsClient := tts.NewOrchestrator()
	log.Println("✅ TTS Orchestrator inicializado")

	// --- Register webhook routes ---
	handler := webhook.NewHandler(webhook.Config{
		Token:          token,
		MaxMessageAge:  600,
		GroqClient:     groqClient,
		SupabaseClient: sbClient,
		WhatsAppClient: wpClient,
		GeminiClient:   geminiClient,
		TtsClient:      ttsClient,
	})
	handler.RegisterRoutes(r)

	// --- Heartbeat goroutine (updates bot_status in Supabase every 60s) ---
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()

		// Run immediately on startup
		sendHeartbeat(wppSession, wpClient, sbClient)

		for range ticker.C {
			sendHeartbeat(wppSession, wpClient, sbClient)
		}
	}()

	// --- Start ---
	log.Printf("🚀 PMO-Bot-Go v0.3.0 listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}

// sendHeartbeat checks WPPConnect session and upserts bot_status in Supabase.
func sendHeartbeat(session string, wp *whatsapp.Client, sb *supabase.Client) {
	connected, details, err := wp.CheckConnection()

	status := "UNKNOWN"
	if err != nil {
		status = "DISCONNECTED"
		log.Printf("💓 Heartbeat: DISCONNECTED (erro: %v)", err)
	} else if connected {
		status = "CONNECTED"
	} else {
		status = "DISCONNECTED"
	}

	if err := sb.UpsertBotStatus(session, status, details); err != nil {
		log.Printf("❌ Heartbeat upsert falhou: %v", err)
	} else {
		log.Printf("💓 Heartbeat: %s", status)
	}
}
