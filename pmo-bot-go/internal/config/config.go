package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all environment variables
type Config struct {
	EvoBaseURL  string
	EvoInstance string
	EvoKey      string
	WebhookToken string
	FlagsmithKey string
	FlagsmithURL string
	GeminiModel  string
	GeminiFallbackModel string
}

// LoadConfig loads the settings from the .env file
func LoadConfig() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using system environment variables.")
	}

	return &Config{
		EvoBaseURL:  os.Getenv("EVOLUTION_BASE_URL"),
		EvoInstance: os.Getenv("EVOLUTION_INSTANCE_NAME"),
		EvoKey:      os.Getenv("EVOLUTION_API_KEY"),
		WebhookToken: os.Getenv("WEBHOOK_TOKEN"),
		FlagsmithKey: os.Getenv("FLAGSMITH_ENV_KEY"),
		FlagsmithURL: os.Getenv("FLAGSMITH_BASE_URL"),
		GeminiModel:  os.Getenv("GEMINI_MODEL"),
		GeminiFallbackModel: os.Getenv("GEMINI_FALLBACK_MODEL"),
	}
}
