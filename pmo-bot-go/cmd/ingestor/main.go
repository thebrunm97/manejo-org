package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
	"crypto/sha256"
	"encoding/hex"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

type ChunkData struct {
	ID          int    `json:"id"`
	Text        string `json:"text"`
	HeadingPath string `json:"heading_path"`
	PageRanges  string `json:"page_ranges"`
	Tokens      int    `json:"tokens"`
}

type ChunksExport struct {
	Source string      `json:"source"`
	Chunks []ChunkData `json:"chunks"`
}

func generateHash(text string) string {
	hasher := sha256.New()
	hasher.Write([]byte(text))
	return hex.EncodeToString(hasher.Sum(nil))
}

func main() {
	// 1. Carrega variáveis de ambiente
	godotenv.Load(".env")
	godotenv.Load("../.env")

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	if supabaseKey == "" {
		supabaseKey = os.Getenv("SUPABASE_SERVICE_KEY")
		if supabaseKey == "" {
			supabaseKey = os.Getenv("SUPABASE_ACCESS_TOKEN")
		}
	}

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("❌ [Ingestor] Erro: SUPABASE_URL ou SUPABASE_KEY não definidos no .env")
	}

	sbClient, err := supabase.NewClient(supabase.Config{
		URL: supabaseURL,
		Key: supabaseKey,
	})
	if err != nil {
		log.Fatalf("❌ [Ingestor] Erro ao criar cliente Supabase: %v", err)
	}

	knowledgeBasePath := "../docs/knowledge_base"

	// 2. Varrer diretório
	files, err := os.ReadDir(knowledgeBasePath)
	if err != nil {
		log.Fatalf("❌ [Ingestor] Erro ao ler diretório de base de conhecimento: %v", err)
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		fileName := file.Name()
		if !strings.HasSuffix(strings.ToLower(fileName), "_chunks.json") {
			continue
		}

		filePath := filepath.Join(knowledgeBasePath, fileName)
		log.Printf("📄 [Ingestor] Lendo arquivo de chunks: %s...", fileName)

		// a) Ler o JSON gerado pelo Python
		jsonFile, err := os.Open(filePath)
		if err != nil {
			log.Printf("❌ [Ingestor] Falha ao abrir %s: %v", fileName, err)
			continue
		}
		
		byteValue, _ := io.ReadAll(jsonFile)
		jsonFile.Close()

		var exportData ChunksExport
		if err := json.Unmarshal(byteValue, &exportData); err != nil {
			log.Printf("❌ [Ingestor] Falha no parse do JSON %s: %v", fileName, err)
			continue
		}

		// Nome original do documento (limpando o sufixo _chunks.json)
		originalDocName := strings.TrimSuffix(fileName, "_chunks.json") + ".pdf"
		docID := strings.TrimSuffix(fileName, "_chunks.json")

		log.Printf("🧩 [Ingestor] Encontrados %d chunks no documento %s. Vetorizando via OpenRouter...", len(exportData.Chunks), originalDocName)

		var farmDocs []supabase.FarmDocument

		// c) Gerar embeddings
		for i, chunk := range exportData.Chunks {
			// O texto usado para gerar o embedding inclui o heading como prefixo,
			// para dar contexto estrutural ao vetor.
			// O texto salvo no banco (content) permanece limpo, sem prefixo,
			// para evitar redundância no prompt do LLM durante o retrieval.
			embeddingText := chunk.Text
			if chunk.HeadingPath != "" {
				embeddingText = fmt.Sprintf("Contexto: %s\n\n%s", chunk.HeadingPath, chunk.Text)
			}

			emb, err := sbClient.GetEmbedding(embeddingText, "BASE_CONHECIMENTO")
			if err != nil {
				log.Printf("⚠️ [Ingestor] Falha ao vetorizar chunk %d do arquivo %s: %v", i, fileName, err)
				continue
			}

			// Hash gerado sobre o texto puro (sem prefixo) para garantir idempotência
			// determinística independente de mudanças no formato do prefixo.
			chunkHash := generateHash(chunk.Text)

			doc := supabase.FarmDocument{
				PmoID:            nil,              // Arquivos institucionais globais (sem pmo_id)
				DocumentName:     originalDocName,
				Content:          chunk.Text,       // ← texto limpo; heading_path é coluna separada
				HeadingPath:      chunk.HeadingPath, // ← persiste o caminho de seção separadamente
				Embedding1024:    emb,
				ChunkHash:        chunkHash,
				ChunkIndex:       chunk.ID,
				SourceDocumentID: docID,
			}
			farmDocs = append(farmDocs, doc)

			// Pequeno delay opcional para não estourar o ratelimit do OpenRouter se for rápido demais
			time.Sleep(100 * time.Millisecond)
		}

		// d) Enviar para o banco (Batch/Lote por arquivo)
		if len(farmDocs) > 0 {
			err = sbClient.UpsertFarmDocumentChunks(farmDocs)
			if err != nil {
				log.Printf("❌ [Ingestor] Falha ao salvar chunks no Supabase para %s: %v", fileName, err)
			} else {
				log.Printf("✅ [Ingestor] Salvo no Supabase com sucesso: %s", originalDocName)
			}
		} else {
			log.Printf("⚠️ [Ingestor] Nenhum chunk válido extraído de %s", fileName)
		}
	}

	log.Println("🎉 [Ingestor] Processo concluído!")
}
