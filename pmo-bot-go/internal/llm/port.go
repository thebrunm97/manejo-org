// Package llm defines the provider-agnostic "Port" layer for all LLM integration
// in the pmo-bot-go system. It is the boundary that enforces the Ports & Adapters
// (Hexagonal Architecture) pattern throughout the codebase.
//
// # Architecture Overview
//
// This package acts as the SINGLE cognitive contract between the business domain
// (orchestrators, FSM, workers) and any underlying AI provider. No package outside
// this one — and outside the adapter implementations — may import provider-specific
// SDKs (e.g. google.golang.org/genai, go-openai).
//
//	┌─────────────────────────────────────────────────────────────────┐
//	│                      BUSINESS DOMAIN                           │
//	│   internal/state  ·  internal/queue  ·  internal/guardrails    │
//	└──────────────────────────┬──────────────────────────────────────┘
//	                           │  depends only on
//	                           ▼
//	┌─────────────────────────────────────────────────────────────────┐
//	│                    PORT  (this package)                         │
//	│                  internal/llm · LLMProvider                    │
//	│                                                                 │
//	│  GenerateContent()   ClassifyIntent()   AskSimple()            │
//	│  DescribeImage()     EvaluateEvidenceListwise()   Embedder()   │
//	└──────┬─────────────────────────────────────────────────────────┘
//	       │  implemented by (adapters)
//	       ├─ internal/gemini  — Google Gemini SDK + OpenRouter fallback
//	       └─ (future)         — Anthropic · Local Ollama · Azure OpenAI
//
// # Port Contract: LLMProvider
//
// The [LLMProvider] interface (defined in provider.go) is the "Port". It is the
// only type the business domain uses. It is intentionally broad (7 methods) because
// it maps 1:1 to the cognitive capabilities the domain requires:
//
//   - [LLMProvider.GenerateContent]            — agentic loop with tool-calling
//   - [LLMProvider.ClassifyIntent]             — intent classification + NER (Router)
//   - [LLMProvider.AskSimple]                  — single-turn questions (no tools)
//   - [LLMProvider.DescribeImage]              — vision / multimodal analysis
//   - [LLMProvider.EvaluateEvidenceListwise]   — Meta-RAG CMM Judge
//   - [LLMProvider.Embedder]                   — text embeddings sub-interface
//   - [LLMProvider.ModelName]                  — provider identity for audit/logging
//
// # Adapters
//
// Each adapter MUST:
//  1. Import this package and implement LLMProvider completely.
//  2. Declare a compile-time assertion: var _ llm.LLMProvider = (*YourClient)(nil)
//  3. Keep ALL provider-SDK imports internal to its own package.
//  4. Encapsulate provider-level concerns (retries, fallback, auth) within itself.
//
// The current Gemini adapter (internal/gemini.Client) satisfies these rules and
// serves as the reference implementation for any future adapter.
//
// # Prompt Externalization
//
// System prompts are owned by the DOMAIN, not by any adapter. They live in:
//   - internal/prompt/prompts/   — large markdown templates (go:embed)
//   - configs/prompts/gemini.json — short, tunable prompts (go:embed via prompt pkg)
//
// Adapters receive the final rendered prompt string via the Port interfaces; they
// never construct or own business-domain prompt logic themselves.
//
// # Adding a New Provider (Checklist)
//
//  1. Create internal/<provider>/client.go
//  2. Implement all 7 LLMProvider methods
//  3. Add var _ llm.LLMProvider = (*Client)(nil) for compile-time safety
//  4. Wire the new provider in cmd/server/main.go or the DI layer
//  5. No changes required in internal/state, internal/queue, or internal/guardrails
package llm
