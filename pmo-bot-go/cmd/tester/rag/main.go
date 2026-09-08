package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func main() {
	// 1. Carrega variáveis de ambiente
	godotenv.Load(".env")
	godotenv.Load("../.env")
	godotenv.Load("../../.env")

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	if supabaseKey == "" {
		supabaseKey = os.Getenv("SUPABASE_SERVICE_KEY")
		if supabaseKey == "" {
			supabaseKey = os.Getenv("SUPABASE_ACCESS_TOKEN")
		}
	}

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("❌ [Tester] Erro: SUPABASE_URL ou SUPABASE_KEY não definidos no .env")
	}

	sbClient, err := supabase.NewClient(supabase.Config{
		URL: supabaseURL,
		Key: supabaseKey,
	})
	if err != nil {
		log.Fatalf("❌ [Tester] Erro ao criar cliente Supabase: %v", err)
	}

	// 2. Definir a Pergunta
	pergunta := "Quais são as regras e exceções para o uso de esterco não compostado?"
	if len(os.Args) > 1 {
		pergunta = strings.Join(os.Args[1:], " ")
	}

	fmt.Printf("\n🤖 [TESTE RAG END-TO-END]\n")
	fmt.Printf("❓ Pergunta: \"%s\"\n\n", pergunta)

	// Passo A: Gerar Vetor
	fmt.Println("⏳ [1] Gerando vetor da pergunta (Ollama)...")
	embedding, err := sbClient.GetEmbedding(pergunta, "BASE_CONHECIMENTO")
	if err != nil {
		log.Fatalf("❌ Falha ao gerar embedding: %v", err)
	}

	// Passo B: Recuperação RPC
	fmt.Println("🔍 [2] Buscando no Supabase (RPC match_documents_with_context)...")
	// Usamos pmoID = 0 (global) ou nil se possível. Count = 2, Window = 1.
	matches, err := sbClient.MatchFarmDocumentsContext(999999, embedding, 0.4, 2, 1)
	if err != nil {
		log.Fatalf("❌ Falha na busca RPC: %v", err)
	}

	if len(matches) == 0 {
		fmt.Println("⚠️ Nenhum resultado encontrado com os parâmetros informados.")
		return
	}

	fmt.Println("\n📊 [Auditoria Visual] Chunks retornados pelo RPC:")
	for _, m := range matches {
		fmt.Printf("   -> Doc: %s | ChunkIndex: %d | Similaridade Âncora: %.4f\n", m.SourceDocumentID, m.ChunkIndex, m.Similarity)
	}
	fmt.Println()

	// Passo C: Montagem do Contexto
	fmt.Println("🧩 [3] Montando contexto a partir dos vizinhos recuperados...")
	var groupedMatches []supabase.DocumentMatchContext
	currentGroup := matches[0]

	for i := 1; i < len(matches); i++ {
		if matches[i].SourceDocumentID == currentGroup.SourceDocumentID {
			currentGroup.Content += "\n\n" + matches[i].Content
		} else {
			groupedMatches = append(groupedMatches, currentGroup)
			currentGroup = matches[i]
		}
	}
	groupedMatches = append(groupedMatches, currentGroup)

	// Visualização de Auditoria
	var sb strings.Builder
	for idx, group := range groupedMatches {
		fmt.Printf("📌 BLOCO %d: Documento '%s' (IsGlobal: %t)\n", idx+1, group.SourceDocumentID, group.IsGlobal)
		
		// Opcional: imprimir quais indices vieram. Como já agregamos, apenas avisamos.
		sb.WriteString(fmt.Sprintf("\n--- Documento: %s ---\n", group.SourceDocumentID))
		sb.WriteString(group.Content)
		sb.WriteString("\n")
	}

	// Passo D: Imprimir o Contexto Final Enriquecido
	fmt.Println("\n=======================================================")
	fmt.Println("📜 CONTEXTO ENRIQUECIDO (PRONTO PARA ENVIO AO LLM):")
	fmt.Println("=======================================================")
	fmt.Println(sb.String())
	fmt.Println("=======================================================")

	// Passo E: Chamar o LLM de verdade via internal/gemini
	fmt.Println("\n🧠 [4] Chamando o modelo LLM (gemini.LLMProviderAdapter.GenerateStructured)...")

	geminiCfg := gemini.Config{
		APIKey:        os.Getenv("GEMINI_API_KEY"),
		Model:         os.Getenv("GEMINI_MODEL"),
		FallbackModel: os.Getenv("GEMINI_FALLBACK_MODEL"),
	}
	if geminiCfg.Model == "" {
		geminiCfg.Model = "gemini-3.1-flash-lite"
	}
	
	geminiClient, err := gemini.NewClient(geminiCfg)
	if err != nil {
		log.Fatalf("❌ Falha ao criar gemini.Client: %v", err)
	}

	adapter := gemini.NewLLMProviderAdapter(geminiClient)

	// Schema para extração (forçando saída estruturada)
	type VerificacaoSchema struct {
		Codigo string `json:"codigo" jsonschema:"description=O código de verificação encontrado no documento"`
	}

	promptText := fmt.Sprintf("Contexto recuperado:\n%s\n\nResponda estritamente baseado no contexto a seguinte pergunta: %s", sb.String(), pergunta)

	importContext := context.Background()
	resultStr, modelUsed, err := adapter.GenerateStructured(importContext, promptText, nil, "", VerificacaoSchema{})
	if err != nil {
		log.Fatalf("❌ Falha na geração do LLM (adapter): %v", err)
	}

	fmt.Println("\n=======================================================")
	fmt.Printf("🤖 RESPOSTA ESTRUTURADA DO MODELO (%s):\n", modelUsed)
	fmt.Println("=======================================================")
	fmt.Println(resultStr)
	fmt.Println("=======================================================")
}
