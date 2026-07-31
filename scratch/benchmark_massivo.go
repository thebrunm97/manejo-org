// benchmark_massivo.go - Benchmark BGE-M3 (Ollama) vs Gemini Embeddings
// Uso: go run scratch/benchmark_massivo.go
// Requer: GEMINI_API_KEY no .env (raiz ou pmo-bot-go/) e Ollama rodando em localhost:11434

package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// ─── Estruturas de dados ───────────────────────────────────────────────────────

type Chunk struct {
	ID    string `json:"id"`
	Tipo  string `json:"tipo"`
	Titulo string `json:"titulo"`
	Text  string `json:"text"`
}

type Question struct {
	Pergunta        string `json:"pergunta"`
	ChunkEsperadoID string `json:"chunk_esperado_id"`
}

type ScoredChunk struct {
	ID    string
	Score float64
}

// ─── Ollama (BGE-M3) ──────────────────────────────────────────────────────────

type OllamaEmbedRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

type OllamaEmbedResponse struct {
	Embedding []float64 `json:"embedding"`
}

func getOllamaEmbedding(text string) ([]float64, error) {
	reqBody := OllamaEmbedRequest{Model: "bge-m3", Prompt: text}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal ollama request: %w", err)
	}

	resp, err := http.Post("http://localhost:11434/api/embeddings", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("ollama http post: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read ollama body: %w", err)
	}

	var embResp OllamaEmbedResponse
	if err := json.Unmarshal(body, &embResp); err != nil {
		return nil, fmt.Errorf("unmarshal ollama response: %w", err)
	}
	if len(embResp.Embedding) == 0 {
		return nil, fmt.Errorf("ollama returned empty embedding - body: %s", string(body))
	}
	return embResp.Embedding, nil
}

// ─── Gemini Embeddings ────────────────────────────────────────────────────────

type GeminiEmbedRequest struct {
	Model                string        `json:"model"`
	Content              GeminiContent `json:"content"`
	OutputDimensionality int           `json:"outputDimensionality,omitempty"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiEmbedResponse struct {
	Embedding struct {
		Values []float64 `json:"values"`
	} `json:"embedding"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func getGeminiEmbedding(text, apiKey string) ([]float64, error) {
	model := "gemini-embedding-001"
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent?key=%s",
		model, apiKey,
	)

	reqBody := GeminiEmbedRequest{
		Model: "models/" + model,
		Content: GeminiContent{
			Parts: []GeminiPart{{Text: text}},
		},
		OutputDimensionality: 3072,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal gemini request: %w", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("gemini http post: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read gemini body: %w", err)
	}

	var embResp GeminiEmbedResponse
	if err := json.Unmarshal(body, &embResp); err != nil {
		return nil, fmt.Errorf("unmarshal gemini response: %w", err)
	}
	if embResp.Error != nil {
		return nil, fmt.Errorf("gemini API error: %s", embResp.Error.Message)
	}
	if len(embResp.Embedding.Values) == 0 {
		return nil, fmt.Errorf("gemini returned empty embedding - body: %s", string(body))
	}
	return embResp.Embedding.Values, nil
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

func cosineSimilarity(a, b []float64) float64 {
	minLen := len(a)
	if len(b) < minLen {
		minLen = len(b)
	}
	var dot, normA, normB float64
	for i := 0; i < minLen; i++ {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

// ─── Top-K ranking ────────────────────────────────────────────────────────────

func rankChunks(queryEmb []float64, chunkEmbs [][]float64, chunks []Chunk) []ScoredChunk {
	scored := make([]ScoredChunk, len(chunks))
	for i, emb := range chunkEmbs {
		scored[i] = ScoredChunk{ID: chunks[i].ID, Score: cosineSimilarity(queryEmb, emb)}
	}
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})
	return scored
}

func isHitAtK(ranked []ScoredChunk, expectedID string, k int) bool {
	for i := 0; i < k && i < len(ranked); i++ {
		if ranked[i].ID == expectedID {
			return true
		}
	}
	return false
}

// ─── .env loader (simples, sem dependência) ───────────────────────────────────

func loadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

// ─── Barra de progresso simples ───────────────────────────────────────────────

func printProgress(model string, current, total int, question string) {
	maxQ := 50
	if len(question) > maxQ {
		question = question[:maxQ] + "..."
	}
	fmt.Printf("\r[%-8s] Pergunta %2d/%2d: %-55s", model, current, total, question)
}

// ─── Result struct ───────────────────────────────────────────────────────────

type benchResult struct {
	idx         int
	pergunta    string
	expected    string
	ollamaRank1 string
	ollamaScore float64
	ollamaHit1  bool
	ollamaHit3  bool
	geminiRank1 string
	geminiScore float64
	geminiHit1  bool
	geminiHit3  bool
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║       🔬 MLOps Benchmark: BGE-M3 vs Gemini Embeddings        ║")
	fmt.Println("║            Portaria MAPA N° 52/2021 - Ground Truth            ║")
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()

	// ── Carrega .env ──
	_, thisFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Dir(filepath.Dir(thisFile))
	loadEnv(filepath.Join(projectRoot, ".env"))
	loadEnv(filepath.Join(projectRoot, "pmo-bot-go", ".env"))
	loadEnv(".env")
	loadEnv(filepath.Join("pmo-bot-go", ".env"))

	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		log.Fatal("GEMINI_API_KEY não encontrada. Defina a variável de ambiente ou verifique o .env")
	}
	fmt.Printf("✅ GEMINI_API_KEY carregada (%.6s...)\n", geminiKey)

	// ── Carrega chunks ──
	scratchDir := filepath.Join(projectRoot, "scratch")
	chunksPath := filepath.Join(scratchDir, "portaria52_chunks.json")
	datasetPath := filepath.Join(scratchDir, "dataset_dourado.json")

	// Fallback: tenta caminhos relativos
	if _, err := os.Stat(chunksPath); err != nil {
		chunksPath = "scratch/portaria52_chunks.json"
		datasetPath = "scratch/dataset_dourado.json"
	}

	chunksData, err := os.ReadFile(chunksPath)
	if err != nil {
		log.Fatalf("Erro ao ler chunks: %v\nCaminho tentado: %s", err, chunksPath)
	}
	var chunks []Chunk
	if err := json.Unmarshal(chunksData, &chunks); err != nil {
		log.Fatalf("Erro ao parsear chunks JSON: %v", err)
	}
	fmt.Printf("✅ %d chunks carregados de %s\n", len(chunks), chunksPath)

	// ── Carrega dataset dourado ──
	datasetData, err := os.ReadFile(datasetPath)
	if err != nil {
		log.Fatalf("Erro ao ler dataset dourado: %v\nCaminho tentado: %s", err, datasetPath)
	}
	var questions []Question
	if err := json.Unmarshal(datasetData, &questions); err != nil {
		log.Fatalf("Erro ao parsear dataset JSON: %v", err)
	}
	fmt.Printf("✅ %d perguntas carregadas do dataset dourado\n", len(questions))
	fmt.Println()

	// ── Verifica Ollama ──
	fmt.Println("🔵 Verificando conexão com Ollama (BGE-M3)...")
	ollamaOK := true
	_, ollamaErr := getOllamaEmbedding("teste de conexão")
	if ollamaErr != nil {
		fmt.Printf("   ⚠️  Ollama indisponível: %v\n", ollamaErr)
		fmt.Println("   BGE-M3 será ignorado neste benchmark.")
		ollamaOK = false
	} else {
		fmt.Println("   ✅ Ollama conectado com sucesso!")
	}
	fmt.Println()

	// ─────────────────────────────────────────────────────────────────────────
	// FASE 1: Pre-computar embeddings dos chunks
	// ─────────────────────────────────────────────────────────────────────────
	var (
		ollamaChunkEmbs [][]float64
		geminiChunkEmbs [][]float64
	)

	if ollamaOK {
		fmt.Printf("🔵 [BGE-M3] Vetorizando %d chunks...\n", len(chunks))
		start := time.Now()
		ollamaChunkEmbs = make([][]float64, len(chunks))
		for i, c := range chunks {
			emb, err := getOllamaEmbedding(c.Text)
			if err != nil {
				log.Printf("   ⚠️  Erro no chunk %s: %v", c.ID, err)
				ollamaChunkEmbs[i] = nil
				continue
			}
			ollamaChunkEmbs[i] = emb
			if (i+1)%10 == 0 || i == len(chunks)-1 {
				fmt.Printf("   Progresso: %d/%d chunks (%.1fs)\n", i+1, len(chunks), time.Since(start).Seconds())
			}
		}
		fmt.Printf("   ✅ Concluído em %.1fs\n\n", time.Since(start).Seconds())
	}

	fmt.Printf("🔴 [Gemini] Vetorizando %d chunks (gemini-embedding-001)...\n", len(chunks))
	{
		start := time.Now()
		geminiChunkEmbs = make([][]float64, len(chunks))
		for i, c := range chunks {
			emb, err := getGeminiEmbedding(c.Text, geminiKey)
			if err != nil {
				log.Printf("   ⚠️  Erro no chunk %s: %v", c.ID, err)
				geminiChunkEmbs[i] = nil
				time.Sleep(500 * time.Millisecond)
				continue
			}
			geminiChunkEmbs[i] = emb
			if (i+1)%10 == 0 || i == len(chunks)-1 {
				fmt.Printf("   Progresso: %d/%d chunks (%.1fs)\n", i+1, len(chunks), time.Since(start).Seconds())
			}
			// Rate limiting: evitar 429
			time.Sleep(50 * time.Millisecond)
		}
		fmt.Printf("   ✅ Concluído em %.1fs\n\n", time.Since(start).Seconds())
	}

	// ─────────────────────────────────────────────────────────────────────────
	// FASE 2: Benchmark por pergunta
	// ─────────────────────────────────────────────────────────────────────────
	var (
		ollamaHit1, ollamaHit3 int
		geminiHit1, geminiHit3 int
		ollamaRun, geminiRun   int
	)

	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("📊 INICIANDO BENCHMARK DAS PERGUNTAS")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	results := make([]benchResult, len(questions))

	for i, q := range questions {
		r := benchResult{
			idx:      i + 1,
			pergunta: q.Pergunta,
			expected: q.ChunkEsperadoID,
		}

		// ── BGE-M3 ──
		if ollamaOK {
			printProgress("BGE-M3", i+1, len(questions), q.Pergunta)
			qEmb, err := getOllamaEmbedding(q.Pergunta)
			if err == nil && len(qEmb) > 0 {
				ranked := rankChunks(qEmb, ollamaChunkEmbs, chunks)
				if len(ranked) > 0 {
					r.ollamaRank1 = ranked[0].ID
					r.ollamaScore = ranked[0].Score
				}
				r.ollamaHit1 = isHitAtK(ranked, q.ChunkEsperadoID, 1)
				r.ollamaHit3 = isHitAtK(ranked, q.ChunkEsperadoID, 3)
				if r.ollamaHit1 { ollamaHit1++ }
				if r.ollamaHit3 { ollamaHit3++ }
				ollamaRun++
			}
		}

		// ── Gemini ──
		printProgress("Gemini", i+1, len(questions), q.Pergunta)
		qEmb, err := getGeminiEmbedding(q.Pergunta, geminiKey)
		if err == nil && len(qEmb) > 0 {
			ranked := rankChunks(qEmb, geminiChunkEmbs, chunks)
			if len(ranked) > 0 {
				r.geminiRank1 = ranked[0].ID
				r.geminiScore = ranked[0].Score
			}
			r.geminiHit1 = isHitAtK(ranked, q.ChunkEsperadoID, 1)
			r.geminiHit3 = isHitAtK(ranked, q.ChunkEsperadoID, 3)
			if r.geminiHit1 { geminiHit1++ }
			if r.geminiHit3 { geminiHit3++ }
			geminiRun++
		}
		// Rate limiting Gemini
		time.Sleep(100 * time.Millisecond)

		results[i] = r
	}

	fmt.Println() // limpa linha de progresso

	// ─────────────────────────────────────────────────────────────────────────
	// FASE 3: Relatório detalhado por pergunta
	// ─────────────────────────────────────────────────────────────────────────
	fmt.Println()
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("📝 DETALHAMENTO POR PERGUNTA")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	for _, r := range results {
		fmt.Printf("\n[#%02d] %s\n", r.idx, r.pergunta)
		fmt.Printf("      Esperado:  %s\n", r.expected)

		if ollamaOK {
			hit1Icon := "❌"
			if r.ollamaHit1 { hit1Icon = "✅" }
			hit3Icon := "❌"
			if r.ollamaHit3 { hit3Icon = "✅" }
			fmt.Printf("      🔵 BGE-M3: Top1=%s (%s, %.4f) | Top3=%s\n",
				hit1Icon, r.ollamaRank1, r.ollamaScore, hit3Icon)
		}

		{
			hit1Icon := "❌"
			if r.geminiHit1 { hit1Icon = "✅" }
			hit3Icon := "❌"
			if r.geminiHit3 { hit3Icon = "✅" }
			fmt.Printf("      🔴 Gemini: Top1=%s (%s, %.4f) | Top3=%s\n",
				hit1Icon, r.geminiRank1, r.geminiScore, hit3Icon)
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// PLACAR FINAL
	// ─────────────────────────────────────────────────────────────────────────
	totalQ := len(questions)

	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║            🏆 PLACAR FINAL DO BENCHMARK 🏆                   ║")
	fmt.Println("╠══════════════════════════════════════════════════════════════╣")
	fmt.Printf( "║  Total de Perguntas: %-39d║\n", totalQ)
	fmt.Println("╠══════════════════════════════════════════════════════════════╣")

	if ollamaOK && ollamaRun > 0 {
		r1 := float64(ollamaHit1) / float64(ollamaRun) * 100
		r3 := float64(ollamaHit3) / float64(ollamaRun) * 100
		fmt.Printf("║  🔵 BGE-M3  (Ollama/1024d)                                    ║\n")
		fmt.Printf("║     Hit Rate Top 1: %5.1f%%  (%d/%d)                           ║\n", r1, ollamaHit1, ollamaRun)
		fmt.Printf("║     Hit Rate Top 3: %5.1f%%  (%d/%d)                           ║\n", r3, ollamaHit3, ollamaRun)
		fmt.Println("╠══════════════════════════════════════════════════════════════╣")
	} else if !ollamaOK {
		fmt.Println("║  🔵 BGE-M3  (Ollama) -> INDISPONÍVEL (Ollama offline)         ║")
		fmt.Println("╠══════════════════════════════════════════════════════════════╣")
	}

	if geminiRun > 0 {
		r1 := float64(geminiHit1) / float64(geminiRun) * 100
		r3 := float64(geminiHit3) / float64(geminiRun) * 100
		fmt.Printf("║  🔴 Gemini  (Google/3072d - gemini-embedding-001)               ║\n")
		fmt.Printf("║     Hit Rate Top 1: %5.1f%%  (%d/%d)                           ║\n", r1, geminiHit1, geminiRun)
		fmt.Printf("║     Hit Rate Top 3: %5.1f%%  (%d/%d)                           ║\n", r3, geminiHit3, geminiRun)
	}

	fmt.Println("╚══════════════════════════════════════════════════════════════╝")

	// Salva resultado em arquivo
	saveResults(results, ollamaOK, ollamaHit1, ollamaHit3, geminiHit1, geminiHit3, totalQ)
}

func saveResults(results []benchResult, ollamaOK bool, oH1, oH3, gH1, gH3, total int) {
	type jsonResult struct {
		Pergunta    string `json:"pergunta"`
		Esperado    string `json:"chunk_esperado"`
		OllamaTop1  string `json:"bge_m3_top1_chunk,omitempty"`
		OllamaHit1  bool   `json:"bge_m3_hit1,omitempty"`
		OllamaHit3  bool   `json:"bge_m3_hit3,omitempty"`
		GeminiTop1  string `json:"gemini_top1_chunk"`
		GeminiHit1  bool   `json:"gemini_hit1"`
		GeminiHit3  bool   `json:"gemini_hit3"`
	}

	output := struct {
		Timestamp   string       `json:"timestamp"`
		TotalQ      int          `json:"total_questions"`
		BGEM3       interface{}  `json:"bge_m3,omitempty"`
		Gemini      interface{}  `json:"gemini"`
		Details     []jsonResult `json:"details"`
	}{
		Timestamp: time.Now().Format(time.RFC3339),
		TotalQ:    total,
	}

	if ollamaOK {
		output.BGEM3 = map[string]interface{}{
			"model":      "bge-m3 (Ollama)",
			"hit_rate_top1": fmt.Sprintf("%.1f%%", float64(oH1)/float64(total)*100),
			"hit_rate_top3": fmt.Sprintf("%.1f%%", float64(oH3)/float64(total)*100),
		}
	}
	output.Gemini = map[string]interface{}{
		"model":      "gemini-embedding-001 (Google)",
		"hit_rate_top1": fmt.Sprintf("%.1f%%", float64(gH1)/float64(total)*100),
		"hit_rate_top3": fmt.Sprintf("%.1f%%", float64(gH3)/float64(total)*100),
	}

	details := make([]jsonResult, len(results))
	for i, r := range results {
		details[i] = jsonResult{
			Pergunta:   r.pergunta,
			Esperado:   r.expected,
			OllamaTop1: r.ollamaRank1,
			OllamaHit1: r.ollamaHit1,
			OllamaHit3: r.ollamaHit3,
			GeminiTop1: r.geminiRank1,
			GeminiHit1: r.geminiHit1,
			GeminiHit3: r.geminiHit3,
		}
	}
	output.Details = details

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		log.Printf("Erro ao serializar resultados: %v", err)
		return
	}

	outPath := filepath.Join("scratch", "benchmark_results.json")
	if err := os.WriteFile(outPath, jsonBytes, 0644); err != nil {
		log.Printf("Erro ao salvar resultados: %v", err)
		return
	}
	fmt.Printf("\n📁 Resultados salvos em: %s\n", outPath)
}


