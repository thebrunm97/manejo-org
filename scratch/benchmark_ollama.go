package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"time"
)

type EmbeddingRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

type EmbeddingResponse struct {
	Embedding []float64 `json:"embedding"`
}

func getOllamaEmbedding(text string) []float64 {
	reqBody := EmbeddingRequest{
		Model:  "bge-m3",
		Prompt: text,
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		log.Fatalf("Erro ao serializar JSON: %v", err)
	}

	start := time.Now()
	resp, err := http.Post("http://localhost:11434/api/embeddings", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("Erro ao chamar Ollama: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Erro ao ler resposta: %v", err)
	}

	var embResp EmbeddingResponse
	if err := json.Unmarshal(body, &embResp); err != nil {
		log.Fatalf("Erro ao deserializar resposta: %v\nBody: %s", err, string(body))
	}
	elapsed := time.Since(start)
	fmt.Printf("[Ollama] Embedding gerado em %v (tamanho do texto: %d caracteres)\n", elapsed, len(text))

	return embResp.Embedding
}

func cosineSimilarity(a, b []float64) float64 {
	var dotProduct, normA, normB float64
	for i := 0; i < len(a) && i < len(b); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

func main() {
	chunks := []string{
		"PROIBIDO: O uso de agrotóxicos como glifosato e paraquat é expressamente proibido na agricultura orgânica.",
		"CARÊNCIA: O esterco animal deve ser compostado ou aplicado no solo com uma carência mínima de 60 dias antes da colheita.",
		"PERMITIDO COM RESTRIÇÃO: A calda bordalesa é permitida, mas o limite de aplicação de cobre não pode exceder 6kg por hectare ao ano.",
		"AUDITORIA: A certificação exige a manutenção atualizada do Caderno de Campo e do Plano de Manejo Orgânico.",
	}

	queries := []string{
		"Quanto tempo tenho de esperar para colher a alface depois de colocar esterco?",
		"Posso usar glifosato no meu canteiro?",
	}

	fmt.Println("--- Gerando Embeddings para os Chunks ---")
	chunkEmbeddings := make([][]float64, len(chunks))
	for i, chunk := range chunks {
		chunkEmbeddings[i] = getOllamaEmbedding(chunk)
	}
	
	fmt.Println("\n--- Gerando Embeddings para as Queries e Comparando ---")
	for i, query := range queries {
		queryEmb := getOllamaEmbedding(query)
		
		bestScore := -1.0
		bestChunkIdx := -1
		
		for j, chunkEmb := range chunkEmbeddings {
			score := cosineSimilarity(queryEmb, chunkEmb)
			if score > bestScore {
				bestScore = score
				bestChunkIdx = j
			}
		}
		
		fmt.Printf("\nQuery %d: \"%s\"\n", i+1, query)
		fmt.Printf("Top 1 Chunk (Similaridade: %.2f%%):\n", bestScore*100)
		fmt.Printf("-> \"%s\"\n", chunks[bestChunkIdx])
	}
}
