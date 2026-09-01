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
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/auditvault"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/embedcache"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/rabbitmq"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/redisstore"
	"github.com/thebrunm97/pmo-bot-go/internal/api"
	"github.com/thebrunm97/pmo-bot-go/internal/config"
	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/gateway"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/geo"
	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/jobs"
	"github.com/thebrunm97/pmo-bot-go/internal/knowledge"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/middleware"
	"github.com/thebrunm97/pmo-bot-go/internal/notify"
	"github.com/thebrunm97/pmo-bot-go/internal/okf"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/proactivity"
	"github.com/thebrunm97/pmo-bot-go/internal/prompt"
	"github.com/thebrunm97/pmo-bot-go/internal/queue"
	"github.com/thebrunm97/pmo-bot-go/internal/selfheal"
	"github.com/thebrunm97/pmo-bot-go/internal/state"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
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

// parseEnvDuration segue o mesmo padrão já usado inline para
// AUDIT_GC_INTERVAL/REAPER_INTERVAL/REAPER_STUCK_AFTER: valor ausente ou
// inválido cai no default, com aviso no segundo caso — nunca erro fatal na
// subida por causa de uma env var mal formatada.
func parseEnvDuration(key string, defaultVal time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	parsed, err := time.ParseDuration(v)
	if err != nil {
		log.Printf("⚠️ %s=%q inválido, usando default de %s: %v", key, v, defaultVal, err)
		return defaultVal
	}
	return parsed
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

	// --- Cofre de Auditoria Efêmero (DT-42) ---
	//
	// Ativado apenas com cliente Supabase disponível. Sem ele o campo fica nil,
	// que é contrato válido no worker de mídia e significa "cofre desativado":
	// o áudio segue sendo transcrito e descartado, sem cópia de auditoria.
	var auditVault queue.AudioArchiver
	if sbClient != nil {
		vaultAdapter := auditvault.New(sbClient)
		auditVault = vaultAdapter
		log.Println("🔐 [Cofre] Auditoria Efêmera ativa — retenção de 90 dias em bucket privado")

		// Triturador do cofre (expurgo de registros vencidos).
		//
		// Ticker em Go, não pg_cron: decisão do time porque o destino final é
		// uma VPS 24/7 rodando o próprio binário, e a regra de exclusão deve
		// ficar tipada e centralizada no repositório, não em SQL agendado fora
		// do controle de versão do código.
		//
		// Intervalo configurável via AUDIT_GC_INTERVAL (ex: "1h" em teste),
		// default 24h em produção — sem isso, validar o expurgo exigiria
		// esperar um dia inteiro.
		gcInterval := 24 * time.Hour
		if v := os.Getenv("AUDIT_GC_INTERVAL"); v != "" {
			if parsed, err := time.ParseDuration(v); err == nil {
				gcInterval = parsed
			} else {
				log.Printf("⚠️ [Cofre-GC] AUDIT_GC_INTERVAL=%q inválido, usando default de 24h: %v", v, err)
			}
		}
		gcTicker := domain.NewAuditGCTicker(vaultAdapter, gcInterval)
		go gcTicker.Run(context.Background())
	} else {
		log.Println("⚠️ [Cofre] Desativado (sem cliente Supabase) — áudios não terão prova de não-repúdio")
	}
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

	// --- Autenticação das rotas do painel (DT-59, fatia 1) ---
	//
	// Até aqui /admin/* e /api/v1/admin/* eram públicos: qualquer um que
	// alcançasse a porta podia apagar documento da base de conhecimento ou
	// disparar o playground de RAG (que gasta crédito de LLM). Só não vazou
	// porque a stack roda em localhost — o corte para VPS (DT-38) acabaria
	// com essa proteção acidental.
	// sbURL já foi validada lá em cima (main.go aborta se estiver vazia), então
	// aqui o verificador sempre nasce configurado. O RequireAuth ainda trata
	// verificador nil recusando tudo — falha fechada, caso essa garantia mude.
	jwtVerifier := middleware.NewJWKSVerifier(sbURL)
	log.Println("🔐 [Auth] Verificador de JWT (JWKS/ES256) inicializado")

	var adminChecker middleware.AdminChecker
	if sbClient != nil {
		adminChecker = sbClient.IsAdmin
	}

	// --- Admin Endpoints ---
	legacyAdmin := r.Group("/admin")
	legacyAdmin.Use(middleware.RequireAuth(jwtVerifier), middleware.RequireAdmin(adminChecker))
	legacyAdmin.POST("/reload-knowledge", func(c *gin.Context) {
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
	adminGroup.Use(middleware.RequireAuth(jwtVerifier), middleware.RequireAdmin(adminChecker))
	knowledgeHandler.RegisterRoutes(adminGroup)
	log.Println("✅ [KnowledgeOps] Rotas /api/v1/admin/knowledge/* registradas (autenticadas)")

	// --- Earth Engine Auth & API ---
	var mapHandler *api.MapHandler
	geeCredPath := os.Getenv("GEE_CREDENTIALS_PATH")
	geeAuth, err := geo.NewGEEAuth(context.Background(), geeCredPath)
	if err != nil {
		log.Printf("⚠️ [GEE] Falha ao inicializar autenticação Earth Engine: %v", err)
	} else {
		log.Printf("✅ [GEE] Autenticado com sucesso no projeto: %s", geeAuth.ProjectID)
		geeClient := geo.NewGEEClient(geeAuth)
		mapHandler = api.NewMapHandler(geeClient)

		// Rota para diagnóstico do GEE
		adminGroup.GET("/maps/diagnostics", mapHandler.DiagnosticsHandler)
		log.Println("✅ [GEE] Rota /api/v1/admin/maps/diagnostics registrada")
	}

	// --- Gateway REST para o pmo-frontend (DT-59, fatia 3) ---
	//
	// Encaminha um allowlist fechado de RPCs (talhão/caderno/propriedade/PMO)
	// com o JWT do PRODUTOR, não a chave de serviço — ver o comentário no
	// topo de internal/gateway/rpc_proxy.go para o porquê. Qualquer usuário
	// autenticado pode chamar; quem decide o que ele pode fazer com cada RPC
	// continua sendo o auth.uid() dentro da função, como já era antes desta
	// rota existir.
	gatewayHandler := gateway.NewHandler(sbURL, sbKey)
	producerGroup := r.Group("/api/v1")
	producerGroup.Use(middleware.RequireAuth(jwtVerifier))
	gatewayHandler.RegisterRoutes(producerGroup)

	// Rota para tiles do GEE (Fase 3 - acessível pelo produtor no app)
	if mapHandler != nil {
		producerGroup.GET("/maps/tiles", mapHandler.GenerateTiles)
		producerGroup.POST("/maps/zonal", mapHandler.ZonalStats)
	}

	log.Println("✅ [Gateway] Rotas /api/v1/* registradas (autenticadas)")

	// --- Initialize TTS Provider ---
	// Único ponto do sistema que conhece um fornecedor concreto de TTS. Todo o
	// resto depende apenas de ports.TTSProvider, então trocar Piper por Google
	// Cloud TTS/ElevenLabs é mudar TTS_PROVIDER — nada de lógica de negócio.
	rawTTS, err := tts.NewFromEnv()
	if err != nil {
		log.Fatalf("❌ [TTS] Configuração inválida: %v", err)
	}
	var ttsClient ports.Synthesizer
	if rawTTS != nil {
		// Adapta o Piper (ou Google Translate legado) para a interface Synthesizer
		localSynth := tts.NewLegacyTTSAdapter(rawTTS)
		// Limita a concorrência a 1 para evitar CPU Starvation no Piper
		localLimited := tts.NewConcurrencyLimiter(localSynth, 1)
		// O Roteador gerencia Cache -> Local -> Cloud. Por enquanto Cloud é nil.
		ttsClient = tts.NewRouter(nil, localLimited, nil)
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

		// Coalescência de mensagens picotadas (DT-68): agrupa fragmentos do
		// mesmo produtor num único turno de IA. MESSAGE_BUFFER_WINDOW=0 desliga
		// por completo (kill-switch), preservando o comportamento anterior ao
		// DT-68 sem exigir redeploy de código, só a env var.
		queueManager.SetBufferConfig(
			parseEnvDuration("MESSAGE_BUFFER_WINDOW", queue.DefaultMessageBufferWindow),
			parseEnvDuration("MESSAGE_BUFFER_MAX", queue.DefaultMessageBufferMax),
		)

		// Reaper de jobs presos.
		//
		// `claim_next_message_job` marca o job como em processamento e so o
		// proprio worker o tira desse estado. Se o worker morre no meio — deploy,
		// crash, container reiniciado — ninguem devolve o job, e como o Claim so
		// busca `pending`/`ai_pending`, nenhum worker futuro o enxerga. Para o
		// produtor, a mensagem nunca recebeu resposta.
		//
		// Medido em 2026-08-23: 8 jobs presos, o mais antigo desde 2026-06-07.
		//
		// A primeira varredura roda na subida, e nao so apos o primeiro tick: o
		// momento em que o processo sobe e exatamente quando existem orfaos do
		// processo que acabou de morrer.
		reaperInterval := 5 * time.Minute
		if v := os.Getenv("REAPER_INTERVAL"); v != "" {
			if parsed, err := time.ParseDuration(v); err == nil {
				reaperInterval = parsed
			} else {
				log.Printf("⚠️ [Reaper] REAPER_INTERVAL=%q invalido, usando default de 5min: %v", v, err)
			}
		}
		reaperStuckAfter := queue.DefaultStuckAfter
		if v := os.Getenv("REAPER_STUCK_AFTER"); v != "" {
			if parsed, err := time.ParseDuration(v); err == nil {
				reaperStuckAfter = parsed
			} else {
				log.Printf("⚠️ [Reaper] REAPER_STUCK_AFTER=%q invalido, usando default de %s: %v", v, queue.DefaultStuckAfter, err)
			}
		}
		go queue.NewStuckJobReaper(queueManager, reaperInterval, reaperStuckAfter).Run(context.Background())

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
				// Cofre de Auditoria Efêmero (DT-42): guarda a gravação por 90
				// dias em bucket privado, para que o produtor possa contestar um
				// registro que a IA tenha alucinado. Sem isto o áudio é apenas
				// transcrito e descartado — o que protege a privacidade e
				// desprotege o produtor.
				AudioVault: auditVault,
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

	// --- Redis: rate limiting de entrada ---
	//
	// O Redis já subia no docker-compose.prod.yml sem nenhum consumidor. Este é
	// o primeiro uso real dele. Sem REDIS_URL, ou com o Redis fora do ar, o bot
	// sobe assim mesmo com um limiter que permite tudo: a proteção contra abuso
	// não vale interromper o recebimento de mensagens (ver ports.RateLimiter).
	var inboundLimiter ports.RateLimiter = ports.NoopRateLimiter{}
	var warningLimiter ports.RateLimiter = ports.NoopRateLimiter{}
	if cfg.RedisURL == "" {
		log.Println("⚠️  [RateLimit] REDIS_URL não definida — rate limiting de entrada DESLIGADO")
		log.Println("⚠️  [RateLimit] Sem Redis, as rotas de satélite ficam SEM teto de cota do Earth Engine")
	} else if redisClient, err := redisstore.New(context.Background(), cfg.RedisURL); err != nil {
		log.Printf("⚠️  [RateLimit] Redis indisponível (%v) — rate limiting de entrada DESLIGADO", err)
	} else {
		defer redisClient.Close()

		limitPerMin := parseEnvInt("RATE_LIMIT_PER_MINUTE", 20)
		inboundLimiter = redisstore.NewRateLimiter(redisClient, "ratelimit:phone", limitPerMin, time.Minute)
		warningLimiter = redisstore.NewRateLimiter(redisClient, "ratelimit:warning", 1, 5*time.Minute)
		log.Printf("✅ [RateLimit] Redis conectado — %d mensagens/min por telefone", limitPerMin)

		// Cota do Earth Engine: teto baixo de propósito. Uma chamada zonal
		// custa uma consulta POR TALHÃO, então o limite é por usuário e conta
		// chamadas, não talhões — o teto de talhões por chamada fica no
		// próprio handler.
		if mapHandler != nil {
			geeLimitPerMin := parseEnvInt("GEE_RATE_LIMIT_PER_MINUTE", 6)
			mapHandler.SetRateLimiter(redisstore.NewRateLimiter(redisClient, "ratelimit:gee", geeLimitPerMin, time.Minute))
			log.Printf("✅ [RateLimit] Earth Engine protegido — %d consultas/min por usuário", geeLimitPerMin)
		}
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
		InboundLimiter:         inboundLimiter,
		WarningLimiter:         warningLimiter,
	})
	handler.RegisterRoutes(r)

	// --- Initialize RabbitMQ Consumer ---
	var rabbitmqConsumer *rabbitmq.Consumer
	rmqURL := os.Getenv("RABBITMQ_URL")
	if rmqURL != "" {
		rabbitmqConsumer = rabbitmq.NewConsumer(rmqURL, "evolution_events", "pmo_bot_events")
		if err := rabbitmqConsumer.Connect(); err != nil {
			log.Printf("⚠️ [RabbitMQ] Falha ao iniciar consumidor: %v", err)
		} else {
			if err := rabbitmqConsumer.Consume(handler.ProcessMessageFromQueue); err != nil {
				log.Printf("⚠️ [RabbitMQ] Falha ao registrar fila: %v", err)
			}
		}
	} else {
		log.Println("⚠️ [RabbitMQ] RABBITMQ_URL não definida — operando apenas com webhooks HTTP")
	}

	// --- Canal de alerta fora de banda (DT-53) ---
	// Fora de banda porque o primeiro uso é avisar que o WhatsApp caiu — avisar
	// pelo WhatsApp seria telefonar para dizer que o telefone não funciona.
	notificador, temCanal := notify.NewFromEnv()
	if temCanal {
		log.Println("📣 [Alerta] Notificação de incidentes ATIVA")
	} else {
		log.Println("⚠️  [Alerta] Nenhum canal configurado — quedas do WhatsApp só aparecerão no log (ver DT-53)")
	}
	rastreador := selfheal.NewRastreador(cfg.EvoInstance, parseEnvInt("SELF_HEAL_DOWN_THRESHOLD", selfheal.LimiarPadrao))

	// Prova, na subida, que o alerta consegue sair do container. Vale mais que
	// qualquer teste unitário do notificador: o compose fixa DNS externo e já
	// vimos resolução de DNS falhar de dentro deste host (incidente 2026-08-23).
	if os.Getenv("SELF_HEAL_TEST_ALERT") == "true" {
		notify.Disparar(context.Background(), notificador, ports.Alerta{
			Chave:      ports.ChaveTeste,
			Severidade: ports.SeveridadeRecuperado,
			Titulo:     "Teste de alerta (" + cfg.EvoInstance + ")",
			Corpo:      "Se você recebeu isto, o canal de alerta do DT-53 funciona ponta a ponta.",
			Em:         time.Now(),
		})
	}

	// --- Self-healing (Estágio 1, DT-53) ---
	// SELF_HEAL_ENABLED=false por padrão: rollback é essa flag + restart, mesmo
	// desenho do HARNESS_ENABLED. SELF_HEAL_DRY_RUN=true por padrão mesmo quando
	// ligado: percorre a máquina de estados inteira, emite toda telemetria e
	// todo alerta, mas nunca chama forcereconnect — todo o valor de detecção
	// contra a sessão real, com risco zero à sessão. Só desligar o dry-run
	// depois de observar o estado sendo classificado corretamente ao vivo.
	selfHealEnabled := os.Getenv("SELF_HEAL_ENABLED") == "true"
	if selfHealEnabled {
		dryRun := os.Getenv("SELF_HEAL_DRY_RUN") != "false" // default true
		healer := selfheal.NewHealer(wpClient, notificador, selfheal.Options{
			Instance:      cfg.EvoInstance,
			Interval:      parseEnvDuration("SELF_HEAL_INTERVAL", 60*time.Second),
			DownThreshold: parseEnvInt("SELF_HEAL_DOWN_THRESHOLD", selfheal.LimiarPadrao),
			MaxAttempts:   parseEnvInt("SELF_HEAL_MAX_ATTEMPTS", 4),
			Cooldown:      parseEnvDuration("SELF_HEAL_COOLDOWN", 6*time.Hour),
			DailyCap:      parseEnvInt("SELF_HEAL_DAILY_CAP", 10),
			DryRun:        dryRun,
		})
		modo := "ATIVO"
		if dryRun {
			modo = "DRY-RUN (nenhuma reconexão real será tentada)"
		}
		log.Printf("🩺 [SelfHeal] SELF_HEAL_ENABLED=true — self-healing %s", modo)

		// Contexto cancelável, mesma convenção já usada para o harness e o
		// worker de knowledge neste arquivo: o encerramento é implícito quando o
		// processo termina (SIGINT → main retorna), não precisa de um cancel()
		// explícito no desligamento gracioso.
		healerCtx, healerCancel := context.WithCancel(context.Background())
		_ = healerCancel
		go healer.Run(healerCtx)

		// Estágio 2: liga o detector por webhook — eventos de CONNECTION
		// (Disconnected, LoggedOut, QRCode...) acordam a sondagem em segundos em
		// vez de esperar até 60s pelo próximo tick. handler já existe e está
		// registrado nas rotas neste ponto; SetConnectionEventNotifier segue o
		// mesmo padrão do SetWhatsAppClient logo acima.
		handler.SetConnectionEventNotifier(healer)
	} else {
		log.Println("⚠️  [SelfHeal] SELF_HEAL_ENABLED=false — heartbeat continua só detectando e alertando (DT-53 Estágio 0), sem tentar reconectar sozinho")
	}

	// --- Ping periódico de uptime (DT-63) ---
	// Confirma no canal de alerta que o processo segue de pé, mesmo sem
	// incidente — sem isso, silêncio é ambíguo entre "tudo bem" e "ninguém
	// saberia se caísse". Marcos crescentes (1h, 3h, 6h, 12h, 24h) para não
	// virar spam logo na subida; depois do último marco, repete a cada 24h.
	// Uma queda real ainda dispara ChaveWhatsAppCaiu a qualquer momento, fora
	// deste cronograma — os dois mecanismos são independentes.
	if temCanal {
		go pingDeUptime(context.Background(), notificador, cfg.EvoInstance)
	}

	// --- Heartbeat goroutine ---
	// Also checks if webhook is still registered after reconnections.
	// evolution-go loses webhook config on disconnect/reconnect cycles.
	go func() {
		bater := func() {
			isConnected := sendHeartbeat(cfg.EvoInstance, wpClient, sbClient, notificador, rastreador)
			if isConnected && cfg.WebhookURL != "" {
				if err := wpClient.ConfigureWebhooks(cfg.WebhookURL); err != nil {
					log.Printf("⚠️ [Heartbeat] Falha ao reconfigurar webhook: %v", err)
				} else {
					log.Printf("🔁 [Heartbeat] Webhook reconfigurado: %s", cfg.WebhookURL)
				}
			}
		}

		// Run immediate heartbeat at startup
		bater()

		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			bater()
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

	if rabbitmqConsumer != nil {
		rabbitmqConsumer.Close()
		log.Println("✅ RabbitMQ consumidor encerrado.")
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

// pingDeUptime manda uma confirmação de "estou de pé" pelo canal de alerta em
// marcos crescentes de tempo de processo (DT-63): 1h, 3h, 6h, 12h, 24h e, dali
// em diante, a cada 24h. Existe porque o self-heal (DT-53) só fala quando algo
// dá errado — sem isto, um canal calado é ambíguo entre "tudo bem" e "ninguém
// saberia se caísse". Roda até o contexto ser cancelado (processo encerrando).
func pingDeUptime(ctx context.Context, notificador ports.Notifier, instance string) {
	marcos := []time.Duration{1 * time.Hour, 3 * time.Hour, 6 * time.Hour, 12 * time.Hour, 24 * time.Hour}
	inicio := time.Now()
	decorrido := time.Duration(0)

	for _, marco := range marcos {
		espera := marco - decorrido
		select {
		case <-ctx.Done():
			return
		case <-time.After(espera):
		}
		decorrido = marco
		notify.Disparar(ctx, notificador, ports.Alerta{
			Chave:      ports.ChavePingUptime,
			Severidade: ports.SeveridadeRecuperado, // fura cooldown: confirmação de rotina, não deve ser suprimida
			Titulo:     fmt.Sprintf("✅ %s online há %s", instance, formatarDuracaoPing(marco)),
			Corpo:      fmt.Sprintf("pmo-bot-go segue no ar desde %s, sem interrupção detectada.", inicio.Format("02/01 15:04")),
			Em:         time.Now(),
		})
	}

	// Depois do último marco, repete a cada 24h enquanto o processo viver.
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			decorrido += 24 * time.Hour
			notify.Disparar(ctx, notificador, ports.Alerta{
				Chave:      ports.ChavePingUptime,
				Severidade: ports.SeveridadeRecuperado,
				Titulo:     fmt.Sprintf("✅ %s online há %s", instance, formatarDuracaoPing(decorrido)),
				Corpo:      fmt.Sprintf("pmo-bot-go segue no ar desde %s, sem interrupção detectada.", inicio.Format("02/01 15:04")),
				Em:         time.Now(),
			})
		}
	}
}

// formatarDuracaoPing traduz marcos de hora para um rótulo legível ("1h",
// "24h") sem depender do formato default do Go (que escreveria "24h0m0s").
func formatarDuracaoPing(d time.Duration) string {
	horas := int(d.Hours())
	if horas < 24 {
		return fmt.Sprintf("%dh", horas)
	}
	dias := horas / 24
	if dias == 1 {
		return "24h (1 dia)"
	}
	return fmt.Sprintf("%dh (%d dias)", horas, dias)
}

// sendHeartbeat checks WhatsApp connection state and updates the bot status in Supabase.
// Returns true if the instance is currently connected.
//
// O rastreador e o notificador são o Estágio 0 do DT-53: esta função já detectava
// a queda e apenas escrevia no log, o que deixou o bot fora do ar por 24 minutos
// (DT-52) e por 36 minutos em 2026-08-23 sem que ninguém soubesse. Agora ela
// continua só detectando — a ação corretiva é o Estágio 1 —, mas o silêncio
// acabou.
func sendHeartbeat(instance string, wp ports.MessageSender, sb *supabase.Client, notificador ports.Notifier, rastreador *selfheal.Rastreador) bool {
	checkClockSync()

	obs := selfheal.Observacao{}
	defer func() {
		if alerta := rastreador.Observar(time.Now(), obs); alerta != nil {
			notify.Disparar(context.Background(), notificador, *alerta)
		}
		if obs.Conectado {
			telemetry.WhatsAppConnected.Set(1)
		} else {
			telemetry.WhatsAppConnected.Set(0)
		}
	}()

	if wp == nil {
		slog.Error("Heartbeat: Adapter NOT Initialized")
		obs.Erro = "adapter não inicializado"
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
			obs.Erro = err.Error()

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
			obs.Detalhe = evoState
			if evoState == "open" {
				status = "CONNECTED"
				isConnected = true
				obs.Conectado = true
			} else {
				status = "DISCONNECTED"
				// slog.Warn, e não log.Printf: slog.SetDefault roteia o pacote log
				// pelo handler JSON com nível fixo INFO, então esta linha saía como
				// "level":"INFO" e nenhum alerta baseado em nível conseguia vê-la.
				slog.Warn("Heartbeat: WhatsApp DISCONNECTED",
					slog.String("evolution_state", evoState),
					slog.String("instance", instance),
				)
			}
		}
	} else {
		status = "CONNECTED"
		isConnected = true
		obs.Conectado = true
		details = map[string]interface{}{"note": "generic sender"}
	}

	if err := sb.UpsertBotStatus(instance, status, details); err != nil {
		log.Printf("❌ Heartbeat upsert falhou: %v", err)
	} else if status == "CONNECTED" {
		log.Printf("✅ Heartbeat: WhatsApp %s", status)
	}
	return isConnected
}
