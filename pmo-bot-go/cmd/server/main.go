package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Flagsmith/flagsmith-go-client/v3"
	"github.com/getsentry/sentry-go"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/agriculture"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/embedcache"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/config"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/jobs"
	"github.com/thebrunm97/pmo-bot-go/internal/knowledge"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/middleware"
	"github.com/thebrunm97/pmo-bot-go/internal/okf"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/proactivity"
	"github.com/thebrunm97/pmo-bot-go/internal/prompt"
	"github.com/thebrunm97/pmo-bot-go/internal/queue"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
	"github.com/thebrunm97/pmo-bot-go/internal/weather"
	"github.com/thebrunm97/pmo-bot-go/internal/webhook"
)

// parseEnvInt helper
func parseEnvInt(key string, defaultVal int) int {
	if valStr := os.Getenv(key); valStr != "" {
		if val, err := strconv.Atoi(valStr); err == nil {
			return val
		}
	}
	return defaultVal
}

func main() {
	godotenv.Load(".env")
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		log.Printf("⚠️ Erro ao carregar timezone America/Sao_Paulo: %v. Usando UTC.", err)
	} else {
		time.Local = loc
	}
	log.Printf("⏰ Horário de Brasília configurado: %v", time.Now().Format(time.RFC1123))

	// --- Sentry Observability ---
	if dsn := os.Getenv("SENTRY_DSN"); dsn != "" {
		err := sentry.Init(sentry.ClientOptions{
			Dsn:              dsn,
			EnableTracing:    true,
			TracesSampleRate: 1.0,
		})
		if err != nil {
			log.Fatalf("Sentry initialization failed: %v", err)
		}
		// Garante que os eventos em buffer sejam enviados antes do programa fechar
		defer sentry.Flush(2 * time.Second)
		log.Println("✅ Sentry tracking enabled!")
	}

	// --- Configurar slog global (JSON) ---
	slogHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	slog.SetDefault(slog.New(slogHandler))
	slog.Info("Observabilidade estruturada (slog) iniciada")

	// --- Centralized Configuration ---
	cfg := config.LoadConfig()

	// --- Initialize OKF (Open Knowledge Format) Static Base ---
	if err := okf.InitGlobalLoader("knowledge"); err != nil {
		log.Fatalf("❌ Falha ao inicializar OKF: %v", err)
	}

	// --- Groq client (always needed for audio transcription / Whisper) ---
	groqKey := os.Getenv("GROQ_API_KEY")
	if groqKey == "" {
		log.Fatal("❌ GROQ_API_KEY não definida")
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

	// --- LLM Provider Factory (Plug & Play) ---
	// ACTIVE_LLM_PROVIDER controls which adapter is active:
	//   "gemini"      (default) — Google GenAI SDK + OpenRouter fallback
	//   "openrouter"             — OpenRouter via go-openai (any model)
	//   "groq"                   — Groq via go-openai
	//   "openai"                 — OpenAI via go-openai
	//
	// All downstream code receives the llm.LLMProvider interface — it never
	// knows (or cares) which concrete adapter is running.
	activekind, factoryCfg := llm.NewProviderFromEnv()

	// Build prompt config once here: main.go is the ONLY package that can
	// legally import both internal/llm and internal/prompt without a cycle.
	promptCfg := llm.PromptConfig{
		RouterPrompt:       prompt.RouterSystemPrompt(),
		VisionPrompt:       prompt.VisionPrompt(),
		MetaRAGJudgePrompt: prompt.MetaRAGJudgePrompt(),
	}

	var llmProvider llm.LLMProvider

	if activekind == llm.ProviderGemini {
		// ── Gemini path (default) ──────────────────────────────────────────────
		geminiKey := os.Getenv("GEMINI_API_KEY")
		if geminiKey == "" {
			log.Fatal("❌ GEMINI_API_KEY não definida (required when ACTIVE_LLM_PROVIDER=gemini)")
		}
		geminiModel := factoryCfg.GeminiModel
		if geminiModel == "" {
			geminiModel = "gemini-2.0-flash"
		}
		geminiVersion := os.Getenv("GEMINI_API_VERSION")
		if geminiVersion == "" {
			geminiVersion = "v1"
		}
		// Sem default embutido: "gemini-1.5-flash" já foi descontinuado pela API
		// (confirmado — não consta mais em /v1beta/models) e um default morto é
		// pior que nenhum, porque desvia a escalada para um modelo inexistente.
		//
		// Vazio é intencional: withFallback então escala para a OpenRouter, que é
		// OUTRO provedor. Falha de infraestrutura (timeout/5xx/429) se resolve
		// trocando de provedor, não de modelo — trocar de modelo dentro do mesmo
		// provedor indisponível não resolve nada.
		geminiFallback := factoryCfg.GeminiFallback
		geminiClient, gemErr := gemini.NewClient(gemini.Config{
			APIKey:           geminiKey,
			OpenRouterAPIKey: cfg.OpenRouterKey,
			Model:            geminiModel,
			OpenRouterModel:  cfg.OpenRouterModel,
			FallbackModel:    geminiFallback,
			APIVersion:       geminiVersion,
		})
		if gemErr != nil {
			log.Fatalf("❌ Falha ao criar cliente Gemini: %v", gemErr)
		}
		log.Printf("✅ LLM Provider: Gemini (modelo: %s, versão: %s)", geminiModel, geminiVersion)
		llmProvider = geminiClient
	} else {
		// ── OpenAI-compatible path (openrouter / groq / openai) ────────────────
		factoryCfg2 := factoryCfg
		factoryCfg2.GroqAPIKey = groqKey // reuse the already-validated Groq key
		oadapter, oaErr := llm.NewOpenAICompatibleProvider(factoryCfg2, promptCfg)
		if oaErr != nil {
			log.Fatalf("❌ Falha ao criar LLM provider (%s): %v", activekind, oaErr)
		}
		log.Printf("✅ LLM Provider: %s (modelo: %s)", activekind, oadapter.ModelName())
		llmProvider = oadapter
	}

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
	agriRepo := agriculture.NewSupabaseAgriculturalRepository(sbClient)
	cachedEmbedder := embedcache.NewCachedEmbedder(llmProvider.Embedder(), 15*time.Minute)
	mcpServer := mcp.NewServer(sbClient, agriRepo, cachedEmbedder, llmProvider)
	mcpServer.InitializeTools()
	log.Println("✅ Servidor MCP (Internal) inicializado com Tool RAG")

	// --- Gin setup ---
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.CORS())
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// --- Prometheus Metrics Endpoint ---
	promToken := os.Getenv("PROMETHEUS_AUTH_TOKEN")
	if promToken != "" {
		r.GET("/metrics", gin.BasicAuth(gin.Accounts{"admin": promToken}), gin.WrapH(promhttp.Handler()))
	} else {
		r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	}

	// --- Admin Endpoints ---
	r.POST("/admin/reload-knowledge", func(c *gin.Context) {
		if okf.GlobalLoader != nil {
			if err := okf.GlobalLoader.Load(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"status": "OKF reloaded successfully"})
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "OKF Loader not initialized"})
		}
	})

	// --- Knowledge Ops Panel API ---
	knowledgeHandler := knowledge.NewHandler(sbClient, cfg.OpenRouterKey, groqKey)
	adminGroup := r.Group("/api/v1/admin")
	knowledgeHandler.RegisterRoutes(adminGroup)
	log.Println("✅ [KnowledgeOps] Rotas /api/v1/admin/knowledge/* registradas")

	// --- Initialize TTS Provider ---
	// Único ponto do sistema que conhece um fornecedor concreto de TTS. Todo o
	// resto depende apenas de ports.TTSProvider, então trocar Piper por Google
	// Cloud TTS/ElevenLabs é mudar TTS_PROVIDER — nada de lógica de negócio.
	ttsClient, err := tts.NewFromEnv()
	if err != nil {
		log.Fatalf("❌ [TTS] Configuração inválida: %v", err)
	}

	// --- Harness de Produção (Feature Flag: HARNESS_ENABLED) ---
	// HARNESS_ENABLED=true  → PostgreSQL queue + 3 Media Workers + 2 AI Workers
	// HARNESS_ENABLED=false → comportamento legado (goroutines diretas, sem persistência)
	//
	// Para rollback imediato em produção: HARNESS_ENABLED=false + restart
	harnessEnabled := os.Getenv("HARNESS_ENABLED") == "true"

	var harnessQueue interface {
		Enqueue(ctx context.Context, msg ports.IncomingMessage) error
	}

	// ── HITL Controller (independente do Harness) ─────────────────────────
	// Inicializado incondicionalmente: o intercept de SIM/NÃO no webhook
	// deve funcionar tanto no modo legado quanto no modo Harness.
	hitlController := guardrails.NewHITLController(sbURL, sbKey)
	state.SetHITL(hitlController)
	log.Println("✅ [HITL] Controller inicializado (SIM/NÃO intercept ativo)")

	// Inicialização do Avaliador Global Determinístico (Guardrails de Negócio)
	businessEvaluator := guardrails.NewDeterministicEvaluator(sbClient)
	state.SetBusinessEvaluator(businessEvaluator)
	log.Println("✅ [Guardrail] Business Evaluator determinístico inicializado")
	// ────────────────────────────────────────────────────────────────────────

	// Declare guardrail dependencies at outer scope so the webhook handler can access them.

	if harnessEnabled {
		log.Println("🚀 [Harness] HARNESS_ENABLED=true — iniciando modo produção com fila PostgreSQL")

		queueManager := queue.NewManager(sbURL, sbKey)
		harnessQueue = queueManager

		// ── Guardrails: Input Pipeline + Output Judge ─────────────────────────
		violationLogger := guardrails.NewSupabaseViolationLogger(sbURL, sbKey)
		guardrailPipeline := guardrails.NewDefaultPipeline(violationLogger)

		outputJudge := guardrails.NewGeminiFlashJudge(
			func(prompt, sys string) (string, error) {
				resp, _, err := llmProvider.AskSimple(context.Background(), prompt, sys)
				return resp, err
			},
			violationLogger,
		)
		// hitlController already initialized above (unconditionally).
		state.SetOutputJudge(outputJudge)
		// Re-wire HITL in state package (already done above, this is a no-op re-assignment).
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
				LLM:      llmProvider,
			},
			AI: queue.AIWorkerConfig{
				Queue:             queueManager,
				Supabase:          sbClient,
				WhatsApp:          wpClient,
				LLM:               llmProvider,
				TTS:               ttsClient,
				MCP:               mcpServer,
				History:           historyManager,
				GuardrailPipeline: guardrailPipeline,
				RouterConfig: state.RouterConfig{
					EnableFastRouter:       os.Getenv("ENABLE_FAST_ROUTER") == "true",
					EnableFastRouterShadow: os.Getenv("ENABLE_FAST_ROUTER_SHADOW") == "true",
					FastRouterTimeoutMS:    parseEnvInt("FAST_ROUTER_TIMEOUT_MS", 3000),
				},
			},
		})
		go h.Start(harnessCtx)
		log.Printf("✅ [Harness] 3 Media Workers + 2 AI Workers iniciados")
	} else {
		log.Println("⚠️  [Harness] HARNESS_ENABLED=false — rodando em modo legado (goroutines diretas)")
	}

	// --- Register webhook routes ---
	handler := webhook.NewHandler(webhook.Config{
		Token:                  cfg.WebhookToken,
		MaxMessageAge:          600,
		GroqClient:             groqClient,
		SupabaseClient:         sbClient,
		WhatsAppClient:         wpClient,
		LLMClient:              llmProvider,
		TtsClient:              ttsClient,
		MCPServer:              mcpServer,
		HistoryManager:         historyManager,
		FlagsmithClient:        flagsmithClient,
		HarnessQueue:           harnessQueue,   // nil quando HARNESS_ENABLED=false (modo legado)
		HITLController:         hitlController, // nil quando HARNESS_ENABLED=false
		EnableFastRouter:       os.Getenv("ENABLE_FAST_ROUTER") == "true",
		EnableFastRouterShadow: os.Getenv("ENABLE_FAST_ROUTER_SHADOW") == "true",
		FastRouterTimeoutMS:    parseEnvInt("FAST_ROUTER_TIMEOUT_MS", 3000),
	})
	handler.RegisterRoutes(r)

	// --- Heartbeat goroutine ---
	// Also checks if webhook is still registered after reconnections.
	// evolution-go loses webhook config on disconnect/reconnect cycles.
	go func() {
		// Run immediate heartbeat at startup
		isConnected := sendHeartbeat(cfg.EvoInstance, wpClient, sbClient)
		if isConnected && cfg.WebhookURL != "" {
			if err := wpClient.ConfigureWebhooks(cfg.WebhookURL); err != nil {
				log.Printf("⚠️ [Heartbeat] Falha ao reconfigurar webhook: %v", err)
			} else {
				log.Printf("🔁 [Heartbeat] Webhook reconfigurado: %s", cfg.WebhookURL)
			}
		}

		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			isConnected = sendHeartbeat(cfg.EvoInstance, wpClient, sbClient)
			if isConnected && cfg.WebhookURL != "" {
				if err := wpClient.ConfigureWebhooks(cfg.WebhookURL); err != nil {
					log.Printf("⚠️ [Heartbeat] Falha ao reconfigurar webhook: %v", err)
				} else {
					log.Printf("🔁 [Heartbeat] Webhook reconfigurado: %s", cfg.WebhookURL)
				}
			}
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

	// --- Knowledge Worker Pool (async ingestion pipeline) ---
	// Concurrency is configurable via KNOWLEDGE_WORKER_CONCURRENCY (default: 2).
	knowledgeWorkerConcurrency := parseEnvInt("KNOWLEDGE_WORKER_CONCURRENCY", 2)
	knowledgeWorker := knowledge.NewWorkerPool(sbClient, knowledgeWorkerConcurrency)
	knowledgeWorkerCtx, knowledgeWorkerCancel := context.WithCancel(context.Background())
	_ = knowledgeWorkerCancel // cancelled implicitly when main exits
	go knowledgeWorker.Start(knowledgeWorkerCtx)
	log.Printf("✅ [KnowledgeWorker] Worker pool iniciado (%d workers)", knowledgeWorkerConcurrency)

	// --- Motor Proativo (PMO Autônomo) ---
	proactiveEngine := proactivity.NewProactiveEngine(sbClient, wpClient, llmProvider)
	proactiveEngine.Start()

	// --- Start ---
	srv := &http.Server{
		Addr:    "0.0.0.0:" + port,
		Handler: r,
	}

	go func() {
		log.Printf("🚀 PMO-Bot-Go listening on 0.0.0.0:%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server failed: %v", err)
		}
	}()

	// Aguardar sinal de interrupção (SIGINT/SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("⚠️ Recebido sinal de parada. Iniciando desligamento gracioso...")

	// Timeout de 60 segundos para processar requisições ativas e workers
	ctxShutdown, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Printf("❌ Servidor forçado a encerrar: %v", err)
	}

	if err := handler.Shutdown(ctxShutdown); err != nil {
		log.Printf("❌ Falha no desligamento do Handler/WorkerPool: %v", err)
	}

	log.Println("✅ Servidor desligado com sucesso.")
}

// checkClockSync makes a lightweight HTTP request to check if the local server clock
// has drifted from internet time. Clock drift > 2s causes WhatsApp/Evolution to reject signatures (401).
func checkClockSync() {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Head("https://google.com")
	if err != nil {
		log.Printf("⚠️ ClockSync: Falha ao checar NTP/Google: %v", err)
		return
	}
	defer resp.Body.Close()

	dateStr := resp.Header.Get("Date")
	if dateStr != "" {
		t, err := time.Parse(time.RFC1123, dateStr)
		if err == nil {
			drift := time.Since(t)
			if drift < 0 {
				drift = -drift
			}
			if drift > 2*time.Second {
				log.Printf("CRITICAL: Clock Drift detected! Drift is %v. This will cause WhatsApp API 401 Signature Failures.", drift)
			}
		}
	}
}

// sendHeartbeat checks WhatsApp connection state and updates the bot status in Supabase.
// Returns true if the instance is currently connected.
func sendHeartbeat(instance string, wp ports.MessageSender, sb *supabase.Client) bool {
	checkClockSync()

	if wp == nil {
		log.Println("❌ Heartbeat: Adapter NOT Initialized")
		_ = sb.UpsertBotStatus(instance, "DISCONNECTED", nil)
		return false
	}

	status := "DISCONNECTED"
	var details map[string]interface{}
	isConnected := false

	if adapter, ok := wp.(*evolution.EvolutionAdapter); ok {
		evoState, err := adapter.GetConnectionState()
		if err != nil {
			log.Printf("⚠️ Heartbeat: Failed to get connection state: %v", err)
			status = "ERROR"
			details = map[string]interface{}{"error": err.Error()}

			// Detect 401 Unauthorized from Evolution API
			if strings.Contains(err.Error(), "status 401") {
				log.Printf("CRITICAL: Evolution API retornado 401. Sessão ou token inválido.")
				go func() {
					if err := os.MkdirAll("logs", 0755); err == nil {
						if f, err := os.OpenFile("logs/auth_errors.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
							f.WriteString(fmt.Sprintf("[%s] 401 Evolution API Auth Error (instance/status)\n", time.Now().Format(time.RFC3339)))
							f.Close()
						}
					}
				}()
			}
		} else {
			details = map[string]interface{}{"instance": adapter.InstanceName, "evolution_state": evoState}
			if evoState == "open" {
				status = "CONNECTED"
				isConnected = true
			} else {
				status = "DISCONNECTED"
				log.Printf("❌ Heartbeat: WhatsApp DISCONNECTED (State: %s)", evoState)
			}
		}
	} else {
		status = "CONNECTED"
		isConnected = true
		details = map[string]interface{}{"note": "generic sender"}
	}

	if err := sb.UpsertBotStatus(instance, status, details); err != nil {
		log.Printf("❌ Heartbeat upsert falhou: %v", err)
	} else if status == "CONNECTED" {
		log.Printf("✅ Heartbeat: WhatsApp %s", status)
	}
	return isConnected
}
