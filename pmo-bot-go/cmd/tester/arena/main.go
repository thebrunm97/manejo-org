package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
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
	}

	openRouterKey := os.Getenv("OPENROUTER_API_KEY")
	geminiKey := os.Getenv("GEMINI_API_KEY")

	if supabaseURL == "" || supabaseKey == "" || openRouterKey == "" || geminiKey == "" {
		log.Fatal("❌ [Arena] Erro: SUPABASE_URL, SUPABASE_KEY, OPENROUTER_API_KEY ou GEMINI_API_KEY faltando no .env")
	}

	sbClient, err := supabase.NewClient(supabase.Config{
		URL: supabaseURL,
		Key: supabaseKey,
	})
	if err != nil {
		log.Fatalf("❌ [Arena] Erro ao criar cliente Supabase: %v", err)
	}

	systemPrompt := "Você é o AgroVivo, um Auditor Agronômico rigoroso. Responda APENAS com base no CONTEXTO DA LEI fornecido. Seja objetivo e cite o Artigo."

	perguntas := []string{
		"Quais as normativas para sementes convencionais?",
		"Qual o tempo de carência para uso de esterco animal?",
	}

	fmt.Println("=======================================================")
	fmt.Println("⚔️  BEM-VINDO À ARENA DE LLMs (HY3 vs DeepSeek vs Gemini) ⚔️")
	fmt.Println("=======================================================")

	for i, pergunta := range perguntas {
		telemetryData := &telemetry.RAGTelemetry{}
		
		fmt.Printf("=== PERGUNTA %d: %s ===\n", i+1, pergunta)
		
		// Passo A: Recuperação RAG (Busca Ampla)
		tRetrieve := telemetry.StartTimer()
		embedding, err := sbClient.GetEmbedding(pergunta, "BASE_CONHECIMENTO")
		if err != nil {
			log.Fatalf("❌ Falha ao gerar embedding para pergunta %d: %v", i+1, err)
		}

		matches, err := sbClient.MatchFarmDocumentsContext(0, embedding, 0.1, 15, 0)
		if err != nil {
			log.Fatalf("❌ Falha na busca RPC para pergunta %d: %v", i+1, err)
		}
		telemetryData.RetrieveMS = tRetrieve.ElapsedMS()
		telemetryData.CandidateCount = len(matches)

		fmt.Printf("🔍 [1] BGE-M3 achou %d candidatos crus.\n", len(matches))

		var contextBuilder strings.Builder
		var docIDs []string
		
		if len(matches) > 0 {
			// Fase 2: Rerank
			var docsText []string
			for _, m := range matches {
				docsText = append(docsText, m.Content)
			}
			
			tRerank := telemetry.StartTimer()
			winners, err := llm.RerankDocuments(pergunta, docsText, 2)
			telemetryData.RerankMS = tRerank.ElapsedMS()
			
			var winnerIds []int64
			if err != nil {
				log.Printf("⚠️ [WARN] Falha no Rerank: %v. Acionando Fallback (Top 3 crus).", err)
				telemetryData.RerankTopN = 3
				limit := 3
				if len(matches) < 3 {
					limit = len(matches)
				}
				for k := 0; k < limit; k++ {
					winnerIds = append(winnerIds, matches[k].ID)
				}
			} else {
				telemetryData.RerankTopN = len(winners)
				fmt.Printf("🎯 [2] Cohere filtrou os %d melhores.\n", len(winners))
				for _, idx := range winners {
					winnerIds = append(winnerIds, matches[idx].ID)
				}
			}
			
			// Fase 3: Janelamento Contextual
			tWindow := telemetry.StartTimer()
			windows, err := sbClient.GetContextWindows(winnerIds, 1)
			telemetryData.WindowMS = tWindow.ElapsedMS()
			if err != nil {
				log.Printf("⚠️ [WARN] Falha ao buscar janelas de contexto: %v. Acionando Fallback (Apenas vencedores crus).", err)
				windows = []supabase.DocumentMatchContext{}
				for _, wid := range winnerIds {
					for _, m := range matches {
						if m.ID == wid {
							windows = append(windows, m)
							break
						}
					}
				}
			}
			
			telemetryData.ExpandedChunkCount = len(windows)
			fmt.Printf("🪟 [3] Supabase montou o contexto com %d chunks vizinhos.\n", len(windows))
			fmt.Println("🚀 [4] Enviando para os LLMs...")

			var groupedMatches []supabase.DocumentMatchContext
			if len(windows) > 0 {
				currentGroup := windows[0]
				for j := 1; j < len(windows); j++ {
					if windows[j].SourceDocumentID == currentGroup.SourceDocumentID {
						// Evitar adicionar blocos repetidos se houver sobreposição no mesmo arquivo
						if !strings.Contains(currentGroup.Content, windows[j].Content) {
							currentGroup.Content += "\n\n" + windows[j].Content
						}
					} else {
						groupedMatches = append(groupedMatches, currentGroup)
						currentGroup = windows[j]
					}
				}
				groupedMatches = append(groupedMatches, currentGroup)
			}

			for _, group := range groupedMatches {
				// Avoid duplicate source IDs in the display
				found := false
				for _, did := range docIDs {
					if did == group.SourceDocumentID {
						found = true
						break
					}
				}
				if !found {
					docIDs = append(docIDs, group.SourceDocumentID)
				}
				contextBuilder.WriteString(fmt.Sprintf("\n--- Documento: %s ---\n", group.SourceDocumentID))
				contextBuilder.WriteString(group.Content)
				contextBuilder.WriteString("\n")
			}
		}

		contexto := contextBuilder.String()
		telemetryData.PromptTokensEst = len(contexto) / 4

		if len(docIDs) == 0 {
			fmt.Println("🔍 Nenhum contexto recuperado.")
		} else {
			fmt.Printf("🔍 Contexto Recuperado (Documentos): [%s]\n", strings.Join(docIDs, ", "))
		}

		userPrompt := fmt.Sprintf("CONTEXTO DA LEI:\n%s\n\nPERGUNTA DO AGRICULTOR:\n%s", contexto, pergunta)

		tLLM := telemetry.StartTimer()

		// Passo B: HY3 (Tencent)
		fmt.Println("\n--- 🔵 RESPOSTA HY3 (Tencent) ---")
		hy3Resp := queryOpenRouter("tencent/hy3:free", systemPrompt, userPrompt, openRouterKey)
		fmt.Println(hy3Resp)

		// Passo C: DeepSeek (V3/V4)
		fmt.Println("\n--- 🟢 RESPOSTA DEEPSEEK ---")
		dsResp := queryOpenRouter("deepseek/deepseek-chat", systemPrompt, userPrompt, openRouterKey)
		fmt.Println(dsResp)

		// Passo D: Gemini (Google)
		fmt.Println("\n--- 🔴 RESPOSTA GEMINI (Google) ---")
		geminiResp := queryGemini("gemini-3.1-flash-lite", systemPrompt, userPrompt, geminiKey)
		fmt.Println(geminiResp)

		telemetryData.LLMMS = tLLM.ElapsedMS()

		// Relatório de Telemetria Final
		telemetryData.PrintReport()
		
		fmt.Println("\n=======================================================")
	}
}

func queryOpenRouter(model, systemPrompt, userPrompt, apiKey string) string {
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.1, // Rigoroso
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Sprintf("[Erro na requisição: %v]", err)
	}
	defer resp.Body.Close()

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	
	json.NewDecoder(resp.Body).Decode(&result)
	
	if result.Error != nil {
		return fmt.Sprintf("[Erro API: %s]", result.Error.Message)
	}
	
	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content
	}
	return "[Resposta Vazia]"
}

func queryGemini(model, systemPrompt, userPrompt, apiKey string) string {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
	
	payload := map[string]interface{}{
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]string{
				{"text": systemPrompt},
			},
		},
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]string{
					{"text": userPrompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature": 0.1,
		},
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Sprintf("[Erro na requisição: %v]", err)
	}
	defer resp.Body.Close()

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	
	json.NewDecoder(resp.Body).Decode(&result)
	
	if result.Error != nil {
		return fmt.Sprintf("[Erro API: %s]", result.Error.Message)
	}
	
	if len(result.Candidates) > 0 && len(result.Candidates[0].Content.Parts) > 0 {
		return result.Candidates[0].Content.Parts[0].Text
	}
	return "[Resposta Vazia]"
}
