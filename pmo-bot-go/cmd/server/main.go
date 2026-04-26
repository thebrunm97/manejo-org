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
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/jobs"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/queue"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
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
	geminiFallback := os.Getenv("GEMINI_FALLBACK_MODEL")
	if geminiFallback == "" {
		geminiFallback = "gemini-1.5-flash"
	}

	geminiClient, err := gemini.NewClient(gemini.Config{
		APIKey:           geminiKey,
		OpenRouterAPIKey: cfg.OpenRouterKey,
		Model:            geminiModel,
		OpenRouterModel:  cfg.OpenRouterModel,
		FallbackModel:    geminiFallback,
		APIVersion:       geminiVersion,
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

	// --- Configure Evolution Webhooks (async with retry) ---
	// Runs in a goroutine to avoid blocking server startup if Evolution API is not yet ready.
	if cfg.WebhookURL != "" {
		go func(webhookURL string) {
			// Wait a few seconds so the server itself is up before first attempt
			time.Sleep(5 * time.Second)
			if err := wpClient.ConfigureWebhooksWithRetry(webhookURL, 10, 5*time.Second); err != nil {
				log.Printf("❌ [Evolution] Falha permanente ao configurar webhook: %v", err)
			}
		}(cfg.WebhookURL)
		log.Printf("⏳ [Evolution] Configuração de webhook agendada em background (10 tentativas × 5s).")
	}

	// --- Initialize Flagsmith client ---
	var flagsmithClient *flagsmith.Client
	if cfg.FlagsmithKey != "" {
		flagsmithClient = flagsmith.NewClient(
			cfg.FlagsmithKey,
			flagsmith.WithBaseURL(cfg.FlagsmithURL),
			flagsmith.WithEnvironmentRefreshInterval(1*time.Minute),
		)
		log.Printf("✅ Cliente Flagsmith inicializado (Refresh: 1m, URL: %s)", cfg.FlagsmithURL)
	} else {
		log.Println("⚠️ FLAGSMITH_ENV_KEY não definida. Rodando sem feature flags (fallback seguro).")
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

	// --- Harness de Produção (Feature Flag: HARNESS_ENABLED) ---
	// HARNESS_ENABLED=true  → PostgreSQL queue + 3 Media Workers + 2 AI Workers
	// HARNESS_ENABLED=false → comportamento legado (goroutines diretas, sem persistência)
	//
	// Para rollback imediato em produção: HARNESS_ENABLED=false + restart
	harnessEnabled := os.Getenv("HARNESS_ENABLED") == "true"

	var harnessQueue interface {
		Enqueue(ctx context.Context, msg ports.IncomingMessage) error
	}

	// Declare guardrail dependencies at outer scope so the webhook handler can access them.
	var hitlController guardrails.HITLHandler

	if harnessEnabled {
		log.Println("🚀 [Harness] HARNESS_ENABLED=true — iniciando modo produção com fila PostgreSQL")

		queueManager := queue.NewManager(sbURL, sbKey)
		harnessQueue = queueManager

		// ── Guardrails: Input Pipeline + Output Judge ─────────────────────────
		violationLogger := guardrails.NewSupabaseViolationLogger(sbURL, sbKey)
		guardrailPipeline := guardrails.NewDefaultPipeline(violationLogger)

		outputJudge := guardrails.NewGeminiFlashJudge(
			func(prompt, sys string) (string, error) {
				resp, _, err := geminiClient.AskExpert(prompt, sys)
				return resp, err
			},
			violationLogger,
		)
		hitlController = guardrails.NewHITLController(sbURL, sbKey)
		state.SetOutputJudge(outputJudge)
		state.SetHITL(hitlController)
		log.Println("✅ [Guardrails] Pipeline de Entrada + Output Judge + HITL ativados")
		// ─────────────────────────────────────────────────────────────────────

		harnessCtx, harnessCancel := context.WithCancel(context.Background())
		_ = harnessCancel // O shutdown ocorre quando o processo termina (SIGINT → Gin.Run retorna)

		h := queue.NewHarness(queue.HarnessConfig{
			Concurrency: queue.HarnessConcurrency{
				MediaWorkers: 3,
				AIWorkers:    2,
				CleanupEvery: 6 * time.Hour,
			},
			Media: queue.MediaWorkerConfig{
				Queue:    queueManager,
				WhatsApp: wpClient,
				Groq:     groqClient,
				Gemini:   geminiClient,
			},
			AI: queue.AIWorkerConfig{
				Queue:             queueManager,
				Supabase:          sbClient,
				WhatsApp:          wpClient,
				Gemini:            geminiClient,
				TTS:               ttsClient,
				MCP:               mcpServer,
				History:           historyManager,
				GuardrailPipeline: guardrailPipeline,
			},
		})
		go h.Start(harnessCtx)
		log.Printf("✅ [Harness] 3 Media Workers + 2 AI Workers iniciados")
	} else {
		log.Println("⚠️  [Harness] HARNESS_ENABLED=false — rodando em modo legado (goroutines diretas)")
	}

	// --- Register webhook routes ---
	handler := webhook.NewHandler(webhook.Config{
		Token:           cfg.WebhookToken,
		MaxMessageAge:   600,
		GroqClient:      groqClient,
		SupabaseClient:  sbClient,
		WhatsAppClient:  wpClient,
		GeminiClient:    geminiClient,
		TtsClient:       ttsClient,
		MCPServer:       mcpServer,
		HistoryManager:  historyManager,
		FlagsmithClient: flagsmithClient,
		HarnessQueue:    harnessQueue,    // nil quando HARNESS_ENABLED=false (modo legado)
		HITLController:  hitlController,  // nil quando HARNESS_ENABLED=false
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
		log.Println("❌ Heartbeat: Adapter NOT Initialized")
		_ = sb.UpsertBotStatus(instance, "DISCONNECTED", nil)
		return
	}

	state := "DISCONNECTED"
	var details map[string]interface{}

	if adapter, ok := wp.(*evolution.EvolutionAdapter); ok {
		// Call Evolution API to get real connection state
		evoState, err := adapter.GetConnectionState()
		if err != nil {
			log.Printf("⚠️ Heartbeat: Failed to get connection state: %v", err)
			state = "ERROR"
			details = map[string]interface{}{"error": err.Error()}
		} else {
			details = map[string]interface{}{"instance": adapter.InstanceName, "evolution_state": evoState}
			if evoState == "open" {
				state = "CONNECTED"
			} else {
				state = "DISCONNECTED"
				log.Printf("❌ Heartbeat: WhatsApp DISCONNECTED (State: %s)", evoState)
			}
		}
	} else {
		// Generic fallback
		state = "CONNECTED"
		details = map[string]interface{}{"note": "generic sender"}
	}

	if err := sb.UpsertBotStatus(instance, state, details); err != nil {
		log.Printf("❌ Heartbeat upsert falhou: %v", err)
	} else if state == "CONNECTED" {
		log.Printf("✅ Heartbeat: WhatsApp %s", state)
	}
}
