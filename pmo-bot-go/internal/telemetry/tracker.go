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
