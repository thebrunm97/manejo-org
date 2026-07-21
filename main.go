package main

import (
	"log"

	"github.com/joho/godotenv"
	"manejo-org-app-clean/internal/benchmark"
)

func main() {
	// Carrega as variáveis do .env local para o ambiente
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: arquivo .env não encontrado. Prosseguindo com variáveis de ambiente do sistema.")
	}

	modelos := []string{
		"tencent/hy3:free",
		"xiaomi/mimo-v2.5",
		"deepseek/deepseek-v4-flash",
		"stepfun/step-3.7-flash",
		"deepseek/deepseek-v4-pro",
		"z-ai/glm-5.2",
		"openai/gpt-4o-mini",
		"nvidia/nemotron-3-ultra-550b-a55b:free",
		"google/gemini-3-flash-preview",
	}

	benchmark.RunModelShootout(modelos)
}
