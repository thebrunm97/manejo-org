package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

func main() {
	// 1. Carregar configuração
	err := godotenv.Load(".env")
	if err != nil {
		log.Println("⚠️ Aviso: não foi possível carregar o arquivo .env, usando variáveis de sistema.")
	}

	geminiKey := os.Getenv("GEMINI_API_KEY")
	sbURL := os.Getenv("SUPABASE_URL")
	sbKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	if geminiKey == "" || sbURL == "" || sbKey == "" {
		log.Fatal("❌ Variáveis de ambiente faltando (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)")
	}

	// 2. Inicializar Clientes
	gemClient, err := gemini.NewClient(gemini.Config{APIKey: geminiKey})
	if err != nil {
		log.Fatalf("❌ Erro ao inicializar Gemini: %v", err)
	}

	sbClient, err := supabase.NewClient(supabase.Config{URL: sbURL, Key: sbKey})
	if err != nil {
		log.Fatalf("❌ Erro ao inicializar Supabase: %v", err)
	}

	log.Println("🚀 Iniciando o Ingestor RAG Multimodal (Supabase pgvector)!")

	docsDir := filepath.Join("docs", "knowledge_base")
	files, err := os.ReadDir(docsDir)
	if err != nil {
		log.Fatalf("❌ Erro ao ler o diretório de documentos: %v", err)
	}

	for _, f := range files {
		if f.IsDir() {
			continue
		}

		path := filepath.Join(docsDir, f.Name())
		ext := strings.ToLower(filepath.Ext(f.Name()))

		log.Printf("\n📄 Processando: %s", f.Name())

		if ext == ".pdf" {
			processPDF(gemClient, sbClient, path, f.Name())
		} else if ext == ".jpg" || ext == ".jpeg" || ext == ".png" {
			processImage(gemClient, sbClient, path, f.Name())
		} else {
			log.Printf("⚠️ Extensão %s não suportada, pulando.", ext)
		}
	}

	log.Println("\n========================================================")
	log.Println("🎉 PROCESSO CONCLUÍDO COM SUCESSO!")
	log.Println("========================================================")
}

func processPDF(gem *gemini.Client, sb *supabase.Client, path, name string) {
	content, err := utils.ExtractTextFromPDF(path)
	if err != nil {
		log.Printf("❌ Erro ao extrair PDF %s: %v", name, err)
		return
	}

	chunks := utils.SimpleChunking(content, 1200, 200)
	log.Printf("🧩 PDF extraído (%d chunks). Gerando embeddings...", len(chunks))

	for i, chunk := range chunks {
		emb, err := gem.GenerateEmbedding(chunk)
		if err != nil {
			log.Printf("⚠️ Erro no embedding do chunk %d: %v", i, err)
			continue
		}

		// pmo_id = 0 significa documento GLOBAL
		err = sb.InsertFarmDocument(0, name, chunk, emb)
		if err != nil {
			log.Printf("❌ Erro ao inserir no Supabase: %v", err)
		}

		// Respeitar rate limits (15 RPM para tokens gratuitos ou safe buffer)
		time.Sleep(2 * time.Second)
	}
	log.Printf("✅ PDF %s processado com sucesso.", name)
}

func processImage(gem *gemini.Client, sb *supabase.Client, path, name string) {
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("❌ Erro ao ler imagem: %v", err)
		return
	}

	mimeType := "image/jpeg"
	if strings.HasSuffix(strings.ToLower(name), ".png") {
		mimeType = "image/png"
	}

	log.Println("🔍 Solicitando descrição agronômica ao Gemini 2.5 Flash...")
	description, err := gem.DescribeAgronomicImage(context.Background(), data, mimeType)
	if err != nil {
		log.Printf("❌ Erro na descrição: %v", err)
		return
	}

	log.Printf("📝 Descrição gerada: %s", description)

	emb, err := gem.GenerateEmbedding(description)
	if err != nil {
		log.Printf("❌ Erro no embedding da descrição: %v", err)
		return
	}

	err = sb.InsertFarmDocument(0, name, description, emb)
	if err != nil {
		log.Printf("❌ Erro ao inserir no Supabase: %v", err)
	}
	log.Printf("✅ Imagem %s processada com sucesso.", name)
	
	// Respeitar rate limits
	time.Sleep(2 * time.Second)
}
