package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func main() {
	_ = godotenv.Load() // ignorar erro se não encontrar .env
	
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("As variáveis SUPABASE_URL e SUPABASE_KEY são obrigatórias")
	}

	client, err := supabase.NewClient(supabase.Config{
		URL: supabaseURL,
		Key: supabaseKey,
	})
	if err != nil {
		log.Fatalf("Erro ao criar cliente Supabase: %v", err)
	}

	limit := 50
	offset := 0
	batchNum := 1

	for {
		log.Printf("[Batch %d] Processando 50 registros... (Offset: %d)", batchNum, offset)

		// Buscar usando supabase-rest com WHERE embedding_1024 IS NULL
		reqURL := fmt.Sprintf("%s/rest/v1/farm_documents?embedding_1024=is.null&select=id,content&limit=%d&offset=%d", supabaseURL, limit, offset)
		req, err := http.NewRequest(http.MethodGet, reqURL, nil)
		if err != nil {
			log.Fatalf("Erro ao criar request de busca: %v", err)
		}
		req.Header.Set("apikey", supabaseKey)
		req.Header.Set("Authorization", "Bearer "+supabaseKey)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Fatalf("Erro na chamada de busca HTTP: %v", err)
		}

		if resp.StatusCode != 200 {
			bodyBytes, _ := io.ReadAll(resp.Body)
			log.Fatalf("Erro da API Supabase (busca): %d %s", resp.StatusCode, string(bodyBytes))
		}

		var docs []struct {
			ID      int64  `json:"id"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&docs); err != nil {
			log.Fatalf("Erro no decode do JSON de busca: %v", err)
		}
		resp.Body.Close()

		if len(docs) == 0 {
			log.Printf("Reindexação concluída com sucesso! (Nenhum registro pendente)")
			break
		}

		updatedCount := 0

		for _, doc := range docs {
			emb, err := client.GetEmbedding(doc.Content, "BASE_CONHECIMENTO")
			if err != nil {
				log.Printf("⚠️ Erro ao vetorizar ID %d: %v", doc.ID, err)
				continue
			}

			if len(emb) != 1024 {
				log.Printf("⚠️ Erro de dimensão no ID %d: vetor gerado tem tamanho %d (esperado 1024)", doc.ID, len(emb))
				continue
			}

			// Atualiza no banco
			updateURL := fmt.Sprintf("%s/rest/v1/farm_documents?id=eq.%d", supabaseURL, doc.ID)
			updatePayload := map[string]interface{}{
				"embedding_1024": emb,
			}
			payloadBytes, _ := json.Marshal(updatePayload)

			updReq, err := http.NewRequest(http.MethodPatch, updateURL, bytes.NewReader(payloadBytes))
			if err != nil {
				log.Printf("⚠️ Erro ao criar request PATCH para ID %d: %v", doc.ID, err)
				continue
			}
			updReq.Header.Set("apikey", supabaseKey)
			updReq.Header.Set("Authorization", "Bearer "+supabaseKey)
			updReq.Header.Set("Content-Type", "application/json")
			updReq.Header.Set("Prefer", "return=minimal")

			updResp, err := http.DefaultClient.Do(updReq)
			if err != nil {
				log.Printf("⚠️ Erro na chamada HTTP (PATCH) para ID %d: %v", doc.ID, err)
				continue
			}
			if updResp.StatusCode >= 400 {
				bodyBytes, _ := io.ReadAll(updResp.Body)
				log.Printf("⚠️ Erro da API Supabase (PATCH) para ID %d: %d %s", doc.ID, updResp.StatusCode, string(bodyBytes))
			} else {
				updatedCount++
			}
			updResp.Body.Close()
		}

		// Prevenção de loop infinito se todos os registros de um batch falharem
		if updatedCount == 0 {
			log.Printf("🚨 ERRO: Nenhum registro atualizado neste batch. Avançando OFFSET para evitar loop infinito.")
			offset += limit
		} else {
			// Não avança o offset porque a cláusula WHERE embedding_1024 IS NULL 
			// removerá os atualizados da fila automaticamente (idempotência pura).
			offset = 0
		}

		log.Printf("   -> %d registros atualizados. Aguardando rate limit...", updatedCount)
		time.Sleep(200 * time.Millisecond)
		batchNum++
	}
}
