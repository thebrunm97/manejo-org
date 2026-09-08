package telemetry

import (
	"fmt"
	"log/slog"
	"time"
)

// RAGTelemetry armazena as métricas operacionais e de performance do pipeline RAG.
type RAGTelemetry struct {
	RetrieveMS         int64 // Tempo de busca vetorial no Supabase (Fase 1)
	RerankMS           int64 // Tempo do Reranker - Cohere (Fase 2)
	WindowMS           int64 // Tempo de expansão contextual no Supabase (Fase 3)
	LLMMS              int64 // Tempo de geração do LLM (Fase 4)
	CandidateCount     int   // Quantos chunks vieram do retrieval inicial
	RerankTopN         int   // Quantos passaram no Rerank
	ExpandedChunkCount int   // Quantos chunks finais foram para o prompt
	PromptTokensEst    int   // Estimativa aproximada de tokens do prompt final (caracteres / 4)
}

// Timer é um utilitário simples para medir tempo.
type Timer struct {
	start time.Time
}

// StartTimer inicia um novo cronómetro.
func StartTimer() *Timer {
	return &Timer{start: time.Now()}
}

// ElapsedMS retorna o tempo decorrido em milissegundos.
func (t *Timer) ElapsedMS() int64 {
	return time.Since(t.start).Milliseconds()
}

// PrintReport exibe um relatório formatado das métricas no terminal.
func (r *RAGTelemetry) PrintReport() {
	fmt.Println("\n=======================================================")
	fmt.Println("📊 RELATÓRIO DE TELEMETRIA RAG (Observabilidade)")
	fmt.Println("=======================================================")
	fmt.Printf("⏱️  Fase 1: Busca Vetorial (BGE-M3):   %d ms\n", r.RetrieveMS)
	fmt.Printf("⏱️  Fase 2: Rerank (Cohere):           %d ms\n", r.RerankMS)
	fmt.Printf("⏱️  Fase 3: Expansão de Contexto:      %d ms\n", r.WindowMS)
	fmt.Printf("⏱️  Fase 4: Geração LLM:               %d ms\n", r.LLMMS)
	fmt.Printf("📈 Tempo Total do Pipeline:            %d ms\n", r.RetrieveMS+r.RerankMS+r.WindowMS+r.LLMMS)
	fmt.Println("-------------------------------------------------------")
	fmt.Printf("📦 Candidatos Recuperados (Fase 1):    %d chunks\n", r.CandidateCount)
	fmt.Printf("🎯 Vencedores Rerank (Fase 2):         %d chunks\n", r.RerankTopN)
	fmt.Printf("🪟 Chunks Finais no Prompt (Fase 3):   %d chunks\n", r.ExpandedChunkCount)
	fmt.Printf("🧮 Estimativa de Tokens do Prompt:     ~%d tokens\n", r.PromptTokensEst)
	fmt.Println("=======================================================")

	// Emitir logs estruturados JSON
	slog.Info("RAG Pipeline Executed",
		slog.Int64("retrieve_ms", r.RetrieveMS),
		slog.Int64("rerank_ms", r.RerankMS),
		slog.Int64("window_ms", r.WindowMS),
		slog.Int64("llm_ms", r.LLMMS),
		slog.Int("candidate_count", r.CandidateCount),
		slog.Int("rerank_top_n", r.RerankTopN),
		slog.Int("expanded_chunk_count", r.ExpandedChunkCount),
		slog.Int("prompt_tokens_est", r.PromptTokensEst),
	)

	// Alimentar as métricas do Prometheus
	RagLatencyMS.WithLabelValues("retrieve").Observe(float64(r.RetrieveMS))
	RagLatencyMS.WithLabelValues("rerank").Observe(float64(r.RerankMS))
	RagLatencyMS.WithLabelValues("window").Observe(float64(r.WindowMS))
	RagLatencyMS.WithLabelValues("llm").Observe(float64(r.LLMMS))
}

// LLMCallTelemetry armazena métricas detalhadas de cada chamada ao LLM (DT-33).
type LLMCallTelemetry struct {
	RequestID        string
	Model            string
	InputTokens      int
	OutputTokens     int
	LatencyMS        int64
	TimeToFirstToken int64 // Use -1 para não medido
	StatusCode       int
	TimeoutStage     string // "retrieval", "classificacao", "geracao", etc., ou vazio se OK
	RetryCount       int
	RetrievedChunks  int
	PromptVersion    string
	CostEstimate     float64
}

// LogLLMCall emite as métricas de chamada do LLM em formato que pode ser indexado.
func LogLLMCall(t LLMCallTelemetry) {
	slog.Info("LLM Call Detailed",
		slog.String("event", "llm_call_detailed"),
		slog.String("request_id", t.RequestID),
		slog.String("model", t.Model),
		slog.Int("input_tokens", t.InputTokens),
		slog.Int("output_tokens", t.OutputTokens),
		slog.Int64("latency_ms", t.LatencyMS),
		slog.Int64("time_to_first_token", t.TimeToFirstToken),
		slog.Int("status_code", t.StatusCode),
		slog.String("timeout_stage", t.TimeoutStage),
		slog.Int("retry_count", t.RetryCount),
		slog.Int("retrieved_chunks", t.RetrievedChunks),
		slog.String("prompt_version", t.PromptVersion),
		slog.Float64("cost_estimate", t.CostEstimate),
	)
}
