package main

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/ledongthuc/pdf"
	"github.com/thebrunm97/pmo-bot-go/internal/chunking"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func readPdf(path string) (string, error) {
	f, r, err := pdf.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	var buf bytes.Buffer
	b, err := r.GetPlainText()
	if err != nil {
		return "", err
	}
	_, err = buf.ReadFrom(b)
	if err != nil {
		return "", err
	}
	
	// Limpa espaços extras e caracteres inválidos que podem vir do PDF
	text := buf.String()
	text = strings.ReplaceAll(text, "\x00", "")
	return text, nil
}

func main() {
	// 1. Carrega variáveis de ambiente - Tenta o .env atual primeiro
	godotenv.Load(".env")
	godotenv.Load("../.env")

	supabaseURL := os.Getenv("SUPABASE_URL")
	// Usar SUPABASE_KEY (anon/service_role) que está no pmo-bot-go/.env em vez do ACCESS_TOKEN de management
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
		if !strings.HasSuffix(strings.ToLower(fileName), ".pdf") {
			log.Printf("⏭️ [Ingestor] Ignorando arquivo não-PDF: %s", fileName)
			continue
		}

		filePath := filepath.Join(knowledgeBasePath, fileName)
		log.Printf("📄 [Ingestor] Lendo arquivo: %s...", fileName)

		// a) Extrair texto completo
		fullText, err := readPdf(filePath)
		if err != nil {
			log.Printf("❌ [Ingestor] Falha ao ler PDF %s: %v", fileName, err)
			continue
		}

		// Limpa o docID para ser amigável (sem extensão)
		docID := strings.TrimSuffix(fileName, ".pdf")
		docID = strings.TrimSuffix(docID, ".PDF")
		
		// b) Chamar SmartSplit
		chunks := chunking.SmartSplit(fullText, docID)
		log.Printf("🧩 [Ingestor] Gerados %d chunks. Vetorizando...", len(chunks))

		var farmDocs []supabase.FarmDocument

		// c) Gerar embeddings
		for i, chunk := range chunks {
			emb, err := sbClient.GetEmbedding(chunk.Content, "BASE_CONHECIMENTO")
			if err != nil {
				log.Printf("⚠️ [Ingestor] Falha ao vetorizar chunk %d do arquivo %s: %v", i, fileName, err)
				continue
			}

			doc := supabase.FarmDocument{
				PmoID:            nil, // Arquivos institucionais globais
				DocumentName:     fileName,
				Content:          chunk.Content,
				Embedding1024:    emb,
				ChunkHash:        chunk.ChunkHash,
				ChunkIndex:       chunk.ChunkIndex,
				SourceDocumentID: chunk.SourceDocumentID,
			}
			farmDocs = append(farmDocs, doc)
			
			// Pequeno delay opcional para não saturar a GPU/CPU local do Ollama rapidamente
			time.Sleep(50 * time.Millisecond)
		}

		// d) Enviar para o banco (Batch/Lote por ficheiro)
		if len(farmDocs) > 0 {
			err = sbClient.UpsertFarmDocumentChunks(farmDocs)
			if err != nil {
				log.Printf("❌ [Ingestor] Falha ao salvar chunks no Supabase para %s: %v", fileName, err)
			} else {
				log.Printf("✅ [Ingestor] Salvo no Supabase com sucesso: %s", fileName)
			}
		}
	}
	
	log.Println("🎉 [Ingestor] Processo concluído!")
}
