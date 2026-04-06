package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/config"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/jobs"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/weather"
	"github.com/thebrunm97/pmo-bot-go/internal/webhook"
	"github.com/Flagsmith/flagsmith-go-client/v3"
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

	// --- Centralized Configuration ---
	cfg := config.LoadConfig()

	// --- Groq client ---
	groqKey := os.Getenv("GROQ_API_KEY")
	if groqKey == "" {
		log.Fatal("❌ GROQ_API_KEY não definida")
	}

	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		log.Fatal("❌ GEMINI_API_KEY não definida")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// --- Initialize History Manager ---
	historyManager := history.NewManager(45*time.Minute, 10)
	log.Println("✅ Gerenciador de Histórico (In-Memory) inicializado")

	// --- Initialize Groq client ---
	groqClient, err := groq.NewClient(groqKey)
	if err != nil {
		log.Fatalf("❌ Falha ao criar cliente Groq: %v", err)
	}
	log.Println("✅ Cliente Groq inicializado")

	// --- Initialize Gemini client ---
	geminiModel := os.Getenv("GEMINI_MODEL")
	if geminiModel == "" {
		geminiModel = "gemini-2.0-flash"
	}
	geminiVersion := os.Getenv("GEMINI_API_VERSION")
	if geminiVersion == "" {
		geminiVersion = "v1"
	}

	geminiClient, err := gemini.NewClient(gemini.Config{
		APIKey:     geminiKey,
		Model:      geminiModel,
		APIVersion: geminiVersion,
	})
	if err != nil {
		log.Fatalf("❌ Falha ao criar cliente Gemini: %v", err)
	}
	log.Printf("✅ Cliente Gemini inicializado (modelo: %s, versão: %s)", geminiModel, geminiVersion)

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

	// --- Initialize WhatsApp client via Evolution Adapter ---
	if cfg.EvoBaseURL == "" {
		log.Fatal("❌ EVOLUTION_BASE_URL não definida")
	}
	wpClient := evolution.NewEvolutionAdapter(
		cfg.EvoBaseURL,
		cfg.EvoInstance,
		cfg.EvoKey,
	)
	log.Println("✅ Cliente Evolution API (Go) inicializado")

	// --- Initialize Flagsmith client ---
	var flagsmithClient *flagsmith.Client
	if cfg.FlagsmithKey != "" {
		flagsmithClient = flagsmith.NewClient(cfg.FlagsmithKey, flagsmith.WithBaseURL(cfg.FlagsmithURL))
		log.Println("✅ Cliente Flagsmith inicializado")
	} else {
		log.Println("⚠️ FLAGSMITH_ENV_KEY não definida. Rodando sem feature flags.")
	}

	// --- Initialize MCP Server ---
	mcpServer := mcp.NewServer(sbClient, geminiClient)
	mcpServer.InitializeTools()
	log.Println("✅ Servidor MCP (Internal) inicializado com Tool RAG")

	// --- Gin setup ---
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// --- Initialize TTS Orchestrator ---
	ttsClient := tts.NewOrchestrator()
	log.Println("✅ TTS Orchestrator inicializado")

	// --- Register webhook routes ---
	handler := webhook.NewHandler(webhook.Config{
		Token:          cfg.EvoKey,
		MaxMessageAge:  600,
		GroqClient:     groqClient,
		SupabaseClient: sbClient,
		WhatsAppClient: wpClient,
		GeminiClient:   geminiClient,
		TtsClient:      ttsClient,
		MCPServer:      mcpServer,
		HistoryManager: historyManager,
		FlagsmithClient: flagsmithClient,
	})
	handler.RegisterRoutes(r)

	// --- Heartbeat goroutine ---
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			sendHeartbeat(cfg.EvoInstance, wpClient, sbClient)
		}
	}()

	// --- Blacklist Auto-Refresh ---
	go sbClient.StartBlacklistAutoRefresh(context.Background(), 24*time.Hour)

	// --- Weather Fetch goroutine ---
	weatherAPIKey := os.Getenv("WEATHER_API_KEY")
	if weatherAPIKey != "" {
		go weather.StartWeatherJob(context.Background(), sbClient, weatherAPIKey)
	}

	// --- Planting Reminders Job ---
	go jobs.StartPlantioReminderJob(sbClient, wpClient)

	// --- Start ---
	log.Printf("🚀 PMO-Bot-Go listening on 0.0.0.0:%s", port)
	if err := r.Run("0.0.0.0:" + port); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}

func sendHeartbeat(instance string, wp ports.MessageSender, sb *supabase.Client) {
	if wp == nil {
		log.Println("💓 Heartbeat: DISCONNECTED")
		_ = sb.UpsertBotStatus(instance, "DISCONNECTED", nil)
		return
	}

	var connected bool
	var details map[string]interface{}

	if adapter, ok := wp.(*evolution.EvolutionAdapter); ok {
		connected = true
		details = map[string]interface{}{"instance": adapter.InstanceName}
	} else {
		connected = true
		details = map[string]interface{}{"note": "generic sender"}
	}

	status := "CONNECTED"
	if !connected {
		status = "DISCONNECTED"
	}

	if err := sb.UpsertBotStatus(instance, status, details); err != nil {
		log.Printf("❌ Heartbeat upsert falhou: %v", err)
	} else {
		log.Printf("💓 Heartbeat: %s", status)
	}
}
