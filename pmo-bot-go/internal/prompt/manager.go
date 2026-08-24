// Package prompt manages system prompts for the bot.
// Prompts belong to the DOMAIN (agronomy, finance), not to any specific LLM
// provider. This package owns the //go:embed directives and the intent-based
// prompt selection logic that was previously coupled to the gemini package.
package prompt

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

//go:embed prompts/system_prompt.md
var systemPrompt string

//go:embed prompts/agronomist.md
var systemPromptAgronomist string

//go:embed prompts/db_operator.md
var systemPromptDBOperator string

//go:embed prompts/agronomist_vision.md
var systemPromptAgronomistVision string

//go:embed prompts/meta_rag_judge.txt
var systemPromptMetaRAGJudge string

// geminiPromptsJSON holds the contents of prompts/gemini.json, embedded
// at compile time so the binary is fully self-contained (no runtime file reads).
//
// SOURCE OF TRUTH for editing: configs/prompts/gemini.json (project root).
// The file at prompts/gemini.json is a compile-time copy kept in sync.
//
//go:embed prompts/gemini.json
var geminiPromptsJSON []byte

// geminiPromptsConfig is the Go representation of gemini.json.
// It is populated once at package init and is safe for concurrent reads.
type geminiPromptsConfig struct {
	RouterPrompt string `json:"router_prompt"`
}

// geminiCfg holds the parsed prompt configuration. A zero-value is safe:
// RouterSystemPrompt() falls back to a minimal inline template on parse error.
var geminiCfg geminiPromptsConfig

func init() {
	if err := json.Unmarshal(geminiPromptsJSON, &geminiCfg); err != nil {
		log.Printf("[prompt] WARNING: failed to parse gemini.json — using inline fallback: %v", err)
	}
}

// VisionPrompt returns the system instruction for agronomic image analysis.
func VisionPrompt() string {
	return systemPromptAgronomistVision
}

// MetaRAGJudgePrompt returns the system instruction for the Meta-RAG CMM Judge.
func MetaRAGJudgePrompt() string {
	return systemPromptMetaRAGJudge
}

// ForIntent selects the correct specialist system prompt based on the
// classified Intent from the Router. Falls back to the default monolithic
// prompt for CHAT or any unrecognized intent.
func ForIntent(intent llm.Intent, modality string, temProducaoParalela bool) string {
	var p string
	switch intent {
	case llm.IntentRAG, "AGRONOMY", "WORKFLOW", "SCHEDULING":
		p = systemPromptAgronomist
	case llm.IntentDatabase:
		p = systemPromptDBOperator
	default:
		p = systemPrompt
	}

	// Inject dynamic context
	p = strings.ReplaceAll(p, "{{MODALIDADE_PREDOMINANTE}}", modality)

	parallelMsg := "NÃO"
	if temProducaoParalela {
		parallelMsg = "SIM"
	}
	p = strings.ReplaceAll(p, "{{TEM_PRODUCAO_PARALELA}}", parallelMsg)

	// Inject current date (avoids hardcoded dates in prompts)
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)
	currentDateBR := now.Format("02 de Janeiro de 2006")
	p = strings.ReplaceAll(p, "{{CURRENT_DATE_BR}}", currentDateBR)

	// Injetar rigidamente no cabeçalho
	header := fmt.Sprintf("Data atual do sistema: %s\n\n", now.Format("2006-01-02"))
	return header + p
}

// RouterSystemPrompt returns the system instruction for intent classification.
// The template body is loaded from configs/prompts/gemini.json (key: "router_prompt")
// so it can be audited and tuned without recompiling the binary — only the
// {{CURRENT_DATE}} placeholder is injected at call time.
func RouterSystemPrompt() string {
	template := geminiCfg.RouterPrompt
	if template == "" {
		// Inline fallback — only reached if gemini.json failed to parse at init.
		template = "Você é um classificador de intenções agrícolas. Data atual do sistema: {{CURRENT_DATE}}"
		log.Printf("[prompt] WARNING: RouterSystemPrompt using inline fallback — check gemini.json")
	}
	return strings.ReplaceAll(template, "{{CURRENT_DATE}}", time.Now().Format("2006-01-02"))
}
