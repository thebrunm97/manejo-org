package main

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func main() {
	godotenv.Load(".env")
	client, _ := supabase.NewClient(supabase.Config{
		URL: os.Getenv("SUPABASE_URL"),
		Key: os.Getenv("SUPABASE_KEY"),
	})

	fmt.Println("Testing InsertLogProcessamento...")
	err1 := client.InsertLogProcessamento(supabase.LogProcessamentoInsert{
		PmoID:            6,
		MensagemUsuario:  "Teste dashboard log processamento",
		RespostaBot:      "OK",
		ModeloIA:         "test",
		TokensPrompt:     10,
		TokensCompletion: 10,
		Intencao:         "teste",
	})
	if err1 != nil {
		fmt.Println("Error 1:", err1)
	} else {
		fmt.Println("LogProcessamento inserted OK")
	}

	fmt.Println("Testing InsertLogTreinamento...")
	err2 := client.InsertLogTreinamento(supabase.LogTreinamentoInsert{
		PmoID:         6,
		TextoUsuario:  "Teste dashboard log treinamento",
		JsonExtraido:  map[string]interface{}{"teste": true},
		TipoAtividade: "teste",
		UserID:        "cf72c9bf-f704-4032-b580-35e9f4aed38d",
		ModeloIA:      "test",
	})
	if err2 != nil {
		fmt.Println("Error 2:", err2)
	} else {
		fmt.Println("LogTreinamento inserted OK")
	}
}
