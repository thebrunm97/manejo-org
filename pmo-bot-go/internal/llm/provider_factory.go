// Package llm — ProviderFactory: resolves the active LLM provider from environment.
//
// Usage in main.go (replaces the 20-line Gemini init block):
//
//	kind, factoryCfg := llm.NewProviderFromEnv()
//	if kind == llm.ProviderGemini {
//	    geminiClient, err := gemini.NewClient(...)
//	    llmProvider = geminiClient
//	} else {
//	    llmProvider, err = llm.NewOpenAICompatibleProvider(factoryCfg, prompts)
//	}
//
// The factory reads ACTIVE_LLM_PROVIDER from the environment and returns the
// correct ProviderKind. The rest of the system never knows which adapter is active.
//
// # Import cycle note
//
// This file must NOT import internal/prompt (which imports internal/llm → cycle).
// Prompt strings are passed as llm.PromptConfig from main.go, which is the only
// package that is allowed to import both internal/llm and internal/prompt.
package llm

import (
	"fmt"
	"log"
	"os"
	"strings"
)

// ProviderKind identifies the underlying LLM provider implementation.
type ProviderKind string

const (
	// ProviderGemini uses the internal/gemini adapter (Google GenAI SDK).
	// This is the default when ACTIVE_LLM_PROVIDER is unset or "gemini".
	ProviderGemini ProviderKind = "gemini"

	// ProviderOpenRouter uses the OpenAIAdapter pointed at https://openrouter.ai/api/v1.
	ProviderOpenRouter ProviderKind = "openrouter"

	// ProviderGroq uses the OpenAIAdapter pointed at https://api.groq.com/openai/v1.
	ProviderGroq ProviderKind = "groq"

	// ProviderOpenAI uses the OpenAIAdapter with the official OpenAI endpoint.
	ProviderOpenAI ProviderKind = "openai"
)

// FactoryConfig holds all provider credentials read from environment variables.
// Populated by NewProviderFromEnv.
type FactoryConfig struct {
	// ActiveProvider selects the adapter to instantiate.
	ActiveProvider ProviderKind

	// ActiveModel overrides the model for the selected provider.
	// Falls back to provider-specific defaults when empty.
	ActiveModel string

	// Gemini-specific (used only when ActiveProvider == ProviderGemini).
	GeminiAPIKey    string
	GeminiModel     string
	GeminiFallback  string

	// OpenRouter credentials (also used as fallback in the Gemini adapter).
	OpenRouterAPIKey string
	OpenRouterModel  string

	// OpenAI-compatible provider credentials.
	OpenAIAPIKey string
	GroqAPIKey   string
}

// NewProviderFromEnv reads ACTIVE_LLM_PROVIDER and all provider-specific
// environment variables, returning the active ProviderKind and FactoryConfig.
//
// Environment variables:
//
//	ACTIVE_LLM_PROVIDER  — "gemini" (default), "openrouter", "groq", "openai"
//	ACTIVE_LLM_MODEL     — model override (provider-specific format)
//	GEMINI_API_KEY        — required for gemini
//	GEMINI_MODEL          — primary Gemini model (default: gemini-2.0-flash)
//	GEMINI_FALLBACK_MODEL — fallback Gemini model
//	OPENROUTER_API_KEY    — required for openrouter
//	OPENROUTER_MODEL      — OpenRouter model (default: google/gemini-2.0-flash-001)
//	GROQ_API_KEY          — required for groq
//	OPENAI_API_KEY        — required for openai
func NewProviderFromEnv() (ProviderKind, FactoryConfig) {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv("ACTIVE_LLM_PROVIDER")))
	if raw == "" {
		raw = string(ProviderGemini)
	}

	cfg := FactoryConfig{
		ActiveProvider:   ProviderKind(raw),
		ActiveModel:      strings.TrimSpace(os.Getenv("ACTIVE_LLM_MODEL")),
		GeminiAPIKey:     strings.TrimSpace(os.Getenv("GEMINI_API_KEY")),
		GeminiModel:      strings.TrimSpace(os.Getenv("GEMINI_MODEL")),
		GeminiFallback:   strings.TrimSpace(os.Getenv("GEMINI_FALLBACK_MODEL")),
		OpenRouterAPIKey: strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY")),
		OpenRouterModel:  strings.TrimSpace(os.Getenv("OPENROUTER_MODEL")),
		OpenAIAPIKey:     strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		GroqAPIKey:       strings.TrimSpace(os.Getenv("GROQ_API_KEY")),
	}

	log.Printf("🔧 [ProviderFactory] ACTIVE_LLM_PROVIDER=%q ACTIVE_LLM_MODEL=%q",
		cfg.ActiveProvider, cfg.ActiveModel)

	return cfg.ActiveProvider, cfg
}

// NewOpenAICompatibleProvider constructs an LLMProvider for any OpenAI-compatible
// provider (openrouter, groq, openai) given a resolved FactoryConfig and prompts.
//
// prompts must be provided by the caller (main.go) to avoid the
// internal/llm ↔ internal/prompt import cycle.
//
// Returns an error if the required credentials are missing for the chosen provider.
func NewOpenAICompatibleProvider(cfg FactoryConfig, prompts PromptConfig) (LLMProvider, error) {
	switch cfg.ActiveProvider {
	case ProviderOpenRouter:
		apiKey := cfg.OpenRouterAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("provider_factory: OPENROUTER_API_KEY is required for provider=openrouter")
		}
		model := cfg.ActiveModel
		if model == "" {
			model = cfg.OpenRouterModel
		}
		if model == "" {
			model = "google/gemini-2.0-flash-001" // sensible default on OpenRouter
		}
		return NewOpenAIAdapter(OpenAIAdapterConfig{
			APIKey:      apiKey,
			Model:       model,
			BaseURL:     "https://openrouter.ai/api/v1",
			HTTPReferer: "https://manejo.org",
			AppTitle:    "ManejoOrg PMO Bot",
			Prompts:     prompts,
		})

	case ProviderGroq:
		apiKey := cfg.GroqAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("provider_factory: GROQ_API_KEY is required for provider=groq")
		}
		model := cfg.ActiveModel
		if model == "" {
			model = "llama3-70b-8192" // sensible default for Groq
		}
		return NewOpenAIAdapter(OpenAIAdapterConfig{
			APIKey:  apiKey,
			Model:   model,
			BaseURL: "https://api.groq.com/openai/v1",
			Prompts: prompts,
		})

	case ProviderOpenAI:
		apiKey := cfg.OpenAIAPIKey
		if apiKey == "" {
			return nil, fmt.Errorf("provider_factory: OPENAI_API_KEY is required for provider=openai")
		}
		model := cfg.ActiveModel
		if model == "" {
			model = "gpt-4o-mini" // sensible default
		}
		return NewOpenAIAdapter(OpenAIAdapterConfig{
			APIKey:  apiKey,
			Model:   model,
			Prompts: prompts,
		})

	default:
		return nil, fmt.Errorf("provider_factory: unknown OpenAI-compatible provider %q — valid values: openrouter, groq, openai", cfg.ActiveProvider)
	}
}
