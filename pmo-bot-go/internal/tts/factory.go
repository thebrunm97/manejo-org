// Package tts contém as implementações concretas de ports.TTSProvider.
//
// A escolha do fornecedor é feita UMA vez, aqui, a partir de configuração —
// nenhum outro pacote deve importar um provider concreto. Isso é o que permite
// trocar Piper por Google Cloud TTS/ElevenLabs mexendo só em variável de
// ambiente, sem tocar na lógica de negócio (mesma estratégia do LLMProvider).
package tts

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

var (
	ErrTTSQuotaExceeded = errors.New("tts quota exceeded")
	ErrTTSTimeout       = errors.New("tts timeout or context cancelled")
	ErrCodecConversion  = errors.New("tts invalid codec or unexpected response format")
)

// defaultTimeout limita a síntese.
//
// Generoso de propósito: o Piper roda em CPU e leva ~15-30s numa resposta longa
// de previsão do tempo. Como o texto é sempre entregue ANTES do áudio, esperar
// aqui não segura o produtor — enquanto um teto apertado (o valor anterior era
// 30s) só produzia áudio perdido por `context deadline exceeded`.
const defaultTimeout = 150 * time.Second

// NewFromEnv constrói o TTSProvider a partir de TTS_PROVIDER.
//
// Valores aceitos:
//
//	"piper"  (padrão) — auto-hospedado, gratuito, sem cota. Config:
//	                    TTS_PIPER_URL   (default http://piper:5000/v1/audio/speech)
//	                    TTS_PIPER_VOICE (default pt_BR-faber-medium)
//	"groq"            — PlayAI via GROQ_API_KEY. Vozes só em inglês/árabe hoje,
//	                    portanto inadequado para pt-BR; mantido por completude.
//	"openrouter"      — OpenAI TTS via OPENROUTER_API_KEY.
//	"google"          — endpoint não-oficial do Google Tradutor (voz robótica).
//	"none"            — desativa o TTS; o bot responde só em texto.
//
// Retorna (nil, nil) quando desativado: um provider nil é contrato válido e
// significa "sem TTS" para os chamadores.
func NewFromEnv() (ports.TTSProvider, error) {
	provider := envOr("TTS_PROVIDER", "piper")

	switch provider {
	case "none", "off", "disabled":
		log.Println("🔇 [TTS] Desativado via TTS_PROVIDER — respostas somente em texto.")
		return nil, nil

	case "piper":
		p := NewPiperProvider(
			envOr("TTS_PIPER_URL", "http://piper:5000/v1/audio/speech"),
			envOr("TTS_PIPER_VOICE", "pt_BR-faber-medium"),
		)
		log.Printf("🔊 [TTS] Provider: Piper (auto-hospedado) voz=%s url=%s", p.Voice, p.BaseURL)
		return p, nil

	case "groq":
		key := os.Getenv("GROQ_API_KEY")
		if key == "" {
			return nil, fmt.Errorf("TTS_PROVIDER=groq exige GROQ_API_KEY")
		}
		log.Println("🔊 [TTS] Provider: Groq (PlayAI)")
		return &OpenAICompatProvider{
			BaseURL:        "https://api.groq.com/openai/v1/audio/speech",
			APIKey:         key,
			HTTPClient:     &http.Client{Timeout: defaultTimeout},
			Models:         []string{"playai-tts"},
			Voice:          envOr("TTS_GROQ_VOICE", "Fritz-PlayAI"),
			ResponseFormat: "mp3",
			label:          "groq",
		}, nil

	case "openrouter":
		key := os.Getenv("OPENROUTER_API_KEY")
		if key == "" {
			return nil, fmt.Errorf("TTS_PROVIDER=openrouter exige OPENROUTER_API_KEY")
		}
		log.Println("🔊 [TTS] Provider: OpenRouter")
		return &OpenAICompatProvider{
			BaseURL:        envOr("TTS_OPENROUTER_URL", "https://openrouter.ai/api/v1/audio/speech"),
			APIKey:         key,
			HTTPClient:     &http.Client{Timeout: defaultTimeout},
			Models:         []string{"openai/tts-1", "openai/gpt-4o-mini-tts"},
			Voice:          envOr("TTS_OPENROUTER_VOICE", "alloy"),
			ResponseFormat: "mp3",
			label:          "openrouter",
		}, nil

	case "google":
		log.Println("⚠️ [TTS] Provider: Google Tradutor (API não-oficial, voz robótica).")
		return NewGoogleProvider(), nil

	default:
		return nil, fmt.Errorf("TTS_PROVIDER desconhecido: %q", provider)
	}
}

// NewPiperProvider cria o provider apontando para um Piper auto-hospedado.
//
// Pedimos MP3, não o WAV padrão do Piper: medido em produção, a mesma resposta
// sai com 92KB em MP3 contra 554KB em WAV (~6x). Como o áudio ainda é
// base64-encodado antes de ir ao evolution-go, o WAV inflava a carga inútil em
// todo o caminho. A imagem do Piper traz ffmpeg, então a conversão é local.
func NewPiperProvider(baseURL, voice string) *OpenAICompatProvider {
	return &OpenAICompatProvider{
		BaseURL:        baseURL,
		HTTPClient:     &http.Client{Timeout: defaultTimeout},
		Models:         []string{voice},
		Voice:          voice,
		ResponseFormat: "mp3",
		label:          "piper",
	}
}

// NewGoogleProvider cria o provider do Google Tradutor (não-oficial).
func NewGoogleProvider() *GoogleTranslateProvider {
	return &GoogleTranslateProvider{
		BaseURL:    "https://translate.google.com/translate_tts",
		HTTPClient: &http.Client{Timeout: defaultTimeout},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Garantias de compilação: as implementações satisfazem o contrato.
var (
	_ ports.TTSProvider = (*OpenAICompatProvider)(nil)
	_ ports.TTSProvider = (*GoogleTranslateProvider)(nil)
)
