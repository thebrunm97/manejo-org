package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	APIKey string
}

func loadConfig() Config {
	err := godotenv.Load(".env")
	if err != nil {
		log.Println("⚠️ Aviso: não foi possível carregar o arquivo .env, usando variáveis de sistema.")
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("GOOGLE_API_KEY")
	}

	if apiKey == "" {
		log.Fatal("❌ GEMINI_API_KEY ou GOOGLE_API_KEY não encontrada no ambiente.")
	}

	return Config{APIKey: apiKey}
}

// 1. Create a File Search Store
func createFileSearchStore(apiKey string) (string, error) {
	reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=%s", apiKey)

	payload := map[string]string{
		"displayName": "ManejoORG Knowledge Base",
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(reqURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("erro ao criar store: %s", string(b))
	}

	var result struct {
		Name string `json:"name"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Name, nil
}

// 2. Upload File to Gemini
func uploadFile(apiKey, filePath string) (string, error) {
	reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=%s", apiKey)

	fileData, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(fileData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/pdf")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("erro ao enviar arquivo %s: %s", filePath, string(b))
	}

	var result struct {
		File struct {
			Name string `json:"name"`
		} `json:"file"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.File.Name, nil
}

// 3. Import File to Store
func importFileToStore(apiKey, storeName, fileName string) error {
	reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/%s:importFile?key=%s", storeName, apiKey)

	payload := map[string]string{
		"fileName": fileName,
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(reqURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erro ao importar arquivo para a store: %s", string(b))
	}

	return nil
}

func main() {
	cfg := loadConfig()
	log.Println("🚀 Iniciando o Ingestor RAG do Gemini (File Search API)!")

	docsDir := filepath.Join("docs", "knowledge_base")
	files, err := os.ReadDir(docsDir)
	if err != nil {
		log.Fatalf("❌ Erro ao ler o diretório de documentos: %v", err)
	}

	var pdfFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(strings.ToLower(f.Name()), ".pdf") {
			pdfFiles = append(pdfFiles, filepath.Join(docsDir, f.Name()))
		}
	}

	if len(pdfFiles) == 0 {
		log.Println("⚠️ Nenhum arquivo PDF encontrado em", docsDir)
		return
	}

	// 1. Criar o Store
	log.Println("📦 Criando um novo FileSearchStore...")
	storeName, err := createFileSearchStore(cfg.APIKey)
	if err != nil {
		log.Fatalf("❌ Falha crítica: %v", err)
	}
	log.Printf("✅ Store Criada! ID: %s", storeName)

	// 2. Upload e Vinculação
	for i, pdfPath := range pdfFiles {
		log.Printf("\n[%d/%d] 📄 Processando arquivo: %s", i+1, len(pdfFiles), pdfPath)

		// a) Upload
		log.Println("   Enviando para o Google Cloud (Upload API)...")
		uploadedFileName, err := uploadFile(cfg.APIKey, pdfPath)
		if err != nil {
			log.Printf("   ❌ Erro no upload: %v", err)
			continue
		}
		log.Printf("   ✅ Upload concluído! Arquivo gerado: %s", uploadedFileName)

		// Rate limit protection step A
		log.Println("   ⏳ Aguardando 15s para respeitar o Rate Limit do Gemini...")
		time.Sleep(15 * time.Second)

		// b) Import into Store
		log.Println("   Vinculando arquivo ao FileSearchStore...")
		err = importFileToStore(cfg.APIKey, storeName, uploadedFileName)
		if err != nil {
			log.Printf("   ❌ Erro ao vincular: %v", err)
			continue
		}
		log.Println("   ✅ Arquivo vinculado com sucesso à base de conhecimento!")

		// Rate limit protection step B
		log.Println("   ⏳ Aguardando 15s para respeitar o Rate Limit do Gemini...")
		time.Sleep(15 * time.Second)
	}

	log.Println("\n========================================================")
	log.Println("🎉 PROCESSO CONCLUÍDO COM SUCESSO!")
	log.Printf("⭐ Cole o seguinte ID no seu arquivo .env:")
	log.Printf("GEMINI_STORE_ID=\"%s\"", storeName)
	log.Println("========================================================")
}
