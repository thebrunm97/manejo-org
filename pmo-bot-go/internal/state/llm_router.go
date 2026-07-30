package state

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

// EvaluateWithLLM uses the LLM to classify the user's message using the strict Fast Router JSON schema.
func EvaluateWithLLM(ctx context.Context, llmClient llm.LLMProvider, message string) (RouterResult, error) {
	systemInstruction := `Você é um Roteador de Intenções super rápido e defensivo de um sistema agronômico.
Sua única função é ler a mensagem do usuário e responder EXATAMENTE neste schema JSON e nada mais.

Intenções permitidas (Primary/Secondary):
- AGRONOMY: Dúvidas técnicas agronômicas, pragas, adubação, etc.
- DATABASE: Registro de plantio, colheita, insumos (escrita/leitura em banco).
- CHAT: Saudação, conversas genéricas, confirmações simples (sim/não).
- CLARIFICATION: O usuário está pedindo ajuda ou a mensagem está ininteligível.
- SCHEDULING: Lembretes e agenda.
- WORKFLOW: Processos longos passo-a-passo.

Regras Estritas:
1. is_mixed: true SE houver duas ou mais intenções distintas.
2. needs_write: true SE o usuário relatar que FEZ, COMPROU, PLANTOU, ou COLHEU algo (ação no passado ou imperativo para guardar).
3. confidence: 0.0 a 1.0 indicando quão claro é o pedido. Abaixo de 0.8 se houver ambiguidade.
4. NUNCA adicione markdown ('''json) ou texto antes/depois do JSON.`

	schema := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"primary_intent": map[string]interface{}{
				"type": "string",
				"enum": []string{"AGRONOMY", "DATABASE", "CHAT", "CLARIFICATION", "SCHEDULING", "WORKFLOW"},
			},
			"secondary_intent": map[string]interface{}{
				"type": "string",
				"enum": []string{"AGRONOMY", "DATABASE", "CHAT", "CLARIFICATION", "SCHEDULING", "WORKFLOW", ""},
			},
			"confidence": map[string]interface{}{
				"type": "number",
			},
			"needs_write": map[string]interface{}{
				"type": "boolean",
			},
			"is_mixed": map[string]interface{}{
				"type": "boolean",
			},
		},
		"required": []string{"primary_intent", "confidence", "needs_write", "is_mixed"},
	}

	req := llm.ContentRequest{
		SystemInstruction: systemInstruction,
		History: []llm.MensagemAgnostica{
			{Role: "user", Content: message},
		},
		Schema: schema,
	}

	res, err := llmClient.GenerateContent(ctx, req)
	if err != nil {
		return RouterResult{}, fmt.Errorf("llm classification failed: %w", err)
	}

	var parsedResult struct {
		PrimaryIntent   string  `json:"primary_intent"`
		SecondaryIntent string  `json:"secondary_intent"`
		Confidence      float64 `json:"confidence"`
		NeedsWrite      bool    `json:"needs_write"`
		IsMixed         bool    `json:"is_mixed"`
	}

	if err := json.Unmarshal([]byte(res.Texto), &parsedResult); err != nil {
		return RouterResult{}, fmt.Errorf("failed to parse router JSON: %w (raw: %s)", err, res.Texto)
	}

	var secIntent *Intent
	if parsedResult.SecondaryIntent != "" {
		i := Intent(parsedResult.SecondaryIntent)
		secIntent = &i
	}

	routerResult := RouterResult{
		PrimaryIntent:   Intent(parsedResult.PrimaryIntent),
		SecondaryIntent: secIntent,
		Confidence:      parsedResult.Confidence,
		NeedsWrite:      parsedResult.NeedsWrite,
		IsMixed:         parsedResult.IsMixed,
		RawResponse:     res.Texto,
		Timestamp:       time.Now(),
	}

	// Determine WriteScope dynamically based on text keywords if needed, or leave to fallback later.
	// For now, if needs write, we can tentatively assume "none" or "farm_record" but this could be expanded.
	if routerResult.NeedsWrite {
		routerResult.WriteScope = WriteScopeFarmRecord
	} else {
		routerResult.WriteScope = WriteScopeNone
	}

	if err := routerResult.Validate(); err != nil {
		return routerResult, fmt.Errorf("router result validation failed: %w", err)
	}

	return routerResult, nil
}
