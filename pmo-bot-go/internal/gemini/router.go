package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/generative-ai-go/genai"
)

// Intent represents the classified user intent from the Router.
type Intent string

const (
	// IntentRAG is for technical questions about organic farming.
	// Routes to the agronomist specialist with only RAG tools.
	IntentRAG Intent = "RAG"

	// IntentDatabase is for CRUD operations on the farm data.
	// Routes to the db_operator specialist with all write tools.
	IntentDatabase Intent = "DATABASE"

	// IntentFinance is for financial records like expenses, sales, and revenue.
	IntentFinance Intent = "REGISTRO_FINANCEIRO"

	// IntentChat is for greetings and off-topic messages.
	// No tools are injected; the model responds directly.
	IntentChat Intent = "CHAT"
)

// RouterResult is the structured JSON output from the Router LLM call.
type RouterResult struct {
	Intent     Intent  `json:"intent"`
	Confidence float64 `json:"confidence"` // 0.0 to 1.0
	Reasoning  string  `json:"reasoning"`  // Internal reasoning (for debug logs)
}

// routerSystemPrompt is the ultra-focused prompt for the Router agent.
// It has NO tools, NO history, and runs at temperature 0.
// It only classifies — it never answers the user directly.
const routerSystemPrompt = `Você é um roteador de intenções. Classifique a mensagem do usuário em exatamente um dos quatro intents abaixo.

Responda APENAS em JSON válido com o seguinte schema:
{"intent": "...", "confidence": 0.95, "reasoning": "..."}

Intents disponíveis:
- "RAG": O usuário tem uma DÚVIDA TÉCNICA sobre agricultura orgânica, normas (IN 46, Lei 10.831), pragas, compostagem, adubação, certificação. NÃO envolve criar, registrar ou modificar dados.
  Exemplos: "qual o pH ideal para alface?", "posso usar calda bordalesa?", "o que diz a IN 46 sobre sementes?"

- "DATABASE": O usuário quer REGISTRAR, CRIAR, CONSULTAR ou MODIFICAR dados da fazenda: talhões, canteiros, colheitas, vendas, insumos, compostagem, limpeza, propagação vegetal, compras.
  Exemplos: "crie o talhão A com 2 hectares", "colhi 50kg de tomate hoje", "comprei esterco na agropecuária", "quais são meus talhões?"

- "CHAT": Saudação, agradecimento, conversa genérica, mensagem fora do domínio agrícola, ou intenção completamente ambígua.
  Exemplos: "oi", "obrigado", "tudo bem?", "me fale sobre futebol"

Regra de desempate: se houver dúvida entre RAG e DATABASE, prefira DATABASE.`

// ClassifyIntent performs a fast, deterministic LLM call to classify the user's intent.
// It uses temperature=0 and forced JSON output — no tools, no chat history.
// On any error, it safely falls back to IntentRAG to avoid blocking the main flow.
func (c *Client) ClassifyIntent(ctx context.Context, userMessage string) (RouterResult, error) {
	model := c.client.GenerativeModel(c.Config.Model)
	model.SystemInstruction = &genai.Content{
		Parts: []genai.Part{genai.Text(routerSystemPrompt)},
	}
	model.SetTemperature(0)
	model.ResponseMIMEType = "application/json"

	log.Printf("🧭 [ROUTER] Classificando intenção: '%s'", truncate(userMessage, 60))

	resp, err := model.GenerateContent(ctx, genai.Text(userMessage))
	if err != nil {
		return RouterResult{Intent: IntentRAG, Confidence: 0.5, Reasoning: "router_error_fallback"}, fmt.Errorf("router llm error: %w", err)
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return RouterResult{Intent: IntentRAG, Confidence: 0.5, Reasoning: "empty_response_fallback"}, fmt.Errorf("router: empty response from model")
	}

	rawJSON, ok := resp.Candidates[0].Content.Parts[0].(genai.Text)
	if !ok {
		return RouterResult{Intent: IntentRAG, Confidence: 0.5, Reasoning: "non_text_fallback"}, fmt.Errorf("router: unexpected non-text response part")
	}

	var result RouterResult
	if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
		log.Printf("⚠️ [ROUTER] Falha ao parsear JSON da resposta: %v. Raw: %s", err, rawJSON)
		return RouterResult{Intent: IntentRAG, Confidence: 0.5, Reasoning: "json_parse_error_fallback"}, nil
	}

	// Validate the intent value to prevent any unexpected output from slipping through.
	switch result.Intent {
	case IntentRAG, IntentDatabase, IntentChat:
		// valid — continue
	default:
		log.Printf("⚠️ [ROUTER] Intent desconhecida recebida: '%s'. Usando fallback RAG.", result.Intent)
		result.Intent = IntentRAG
	}

	log.Printf("🧭 [ROUTER] Intent: %s | Confidence: %.2f | Reasoning: %s", result.Intent, result.Confidence, result.Reasoning)

	return result, nil
}

// truncate is a helper to safely shorten strings for logging.
func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}
