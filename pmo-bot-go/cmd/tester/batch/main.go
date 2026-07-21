package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/adapter/agriculture"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func main() {
	log.Println("Iniciando Simulação do Batch Writing (Lote)...")

	// Carrega envs (tenta locais comuns)
	godotenv.Load(".env")
	godotenv.Load("../.env")
	godotenv.Load("../../.env")
	godotenv.Load("../../../.env")

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	if supabaseKey == "" {
		supabaseKey = os.Getenv("SUPABASE_SERVICE_KEY")
	}

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("❌ [Batch Test] Erro: SUPABASE_URL ou SUPABASE_KEY faltando no .env")
	}

	sbClient, err := supabase.NewClient(supabase.Config{
		URL: supabaseURL,
		Key: supabaseKey,
	})
	if err != nil {
		log.Fatalf("❌ Erro ao criar cliente Supabase: %v", err)
	}

	// 1. Instanciar o Repositório Real
	repo := agriculture.NewSupabaseAgriculturalRepository(sbClient)

	// Tentar obter um PMO ID válido para o teste
	validPmoID := int64(1)
	validUserID := "00000000-0000-0000-0000-000000000000"
	reqURL := fmt.Sprintf("%s/rest/v1/pmo?select=id,user_id&limit=1", supabaseURL)
	req, _ := http.NewRequest("GET", reqURL, nil)
	req.Header.Set("apikey", supabaseKey)
	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err == nil {
		defer resp.Body.Close()
		var pmos []struct {
			ID     int64  `json:"id"`
			UserID string `json:"user_id"`
		}
		if json.NewDecoder(resp.Body).Decode(&pmos) == nil && len(pmos) > 0 {
			validPmoID = pmos[0].ID
			validUserID = pmos[0].UserID
			log.Printf("🔍 Usando PMO Real encontrado no DB: ID=%d, UserID=%s", validPmoID, validUserID)
		}
	}

	// 2. Criar o Lote de Teste
	lote := []mcp.OperacaoLoteItem{
		{
			Tipo: "Colheita",
			Colheita: &mcp.RegistrarColheitaSchema{
				PmoID:      int(validPmoID),
				Cultura:    "Alface Americana",
				Quantidade: "50",
				Unidade:    "kg",
				Talhao:     "Talhão 1",
				Destino:    "Cooperativa",
			},
		},
		{
			Tipo: "Limpeza",
			Limpeza: &mcp.RegistrarLimpezaSchema{
				PmoID:      9999999, // Invalido! Deve falhar FK constraint
				AreaLimpa:  "Área da Sede",
				Metodo:     "Roçada Manual",
			},
		},
		{
			Tipo: "Colheita",
			Colheita: &mcp.RegistrarColheitaSchema{
				PmoID:      int(validPmoID),
				Cultura:    "Cenoura Roxa",
				Quantidade: "20",
				Unidade:    "caixas",
				Talhao:     "Talhão 2",
				Destino:    "Feira Local",
			},
		},
	}

	log.Printf("⏳ Enviando lote com %d operações (2 Válidas, 1 Inválida)...", len(lote))

	// 3. Executar o Lote
	ctx := context.Background()
	resultado, err := repo.RegistrarLoteOperacoes(ctx, int(validPmoID), validUserID, lote)
	if err != nil {
		log.Fatalf("❌ Falha crítica ao processar o lote: %v", err)
	}

	// 4. Exibir os resultados para auditoria manual
	log.Println("==================================================")
	log.Println("📊 RESULTADO DO LOTE (BATCH RESULT)")
	log.Println("==================================================")
	
	jsonRes, _ := json.MarshalIndent(resultado, "", "  ")
	fmt.Println(string(jsonRes))

	if len(resultado.Sucessos) == 2 && len(resultado.Erros) == 1 {
		log.Println("✅ [TESTE PASSOU] O modelo de Sucesso Parcial funcionou corretamente!")
	} else {
		log.Printf("⚠️ [AVISO] Resultado inesperado. Sucessos: %d, Erros: %d", len(resultado.Sucessos), len(resultado.Erros))
	}
}
