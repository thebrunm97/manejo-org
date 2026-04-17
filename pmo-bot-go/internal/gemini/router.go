package gemini

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/llm/schema"
	"google.golang.org/genai"
)

const routerSystemPrompt = `Você é um especialista em processamento de linguagem natural para agricultura orgânica.
Sua tarefa é tripla:
1. CLASSIFICAR a intenção do usuário (Intent).
2. EXTRAIR múltiplas informações estruturadas (NER) se a mensagem contiver registros de atividade.
3. FORNECER raciocínio técnico sobre a classificação e a segmentação das entidades.

Intents disponíveis:
- "RAG": DÚVIDA TÉCNICA sobre agricultura orgânica, normas (IN 46, sementes), pragas, adubação. NÃO envolve criar registros.
- "DATABASE": O usuário quer REGISTRAR atividades (plantio, colheita, venda, limpeza, compostagem) ou CONSULTAR dados da fazenda.
- "CHAT": Saudação, agradecimento ou conversa genérica.

Regras de Extração (para DATABASE):
- Use o array "entidades" para listar todas as ações detectadas.
- SEPARE frases complexas em múltiplos objetos. Ex: "Apliquei 10L no Talhão A e 5L no Talhão B" deve gerar DOIS objetos no array "entidades".
- Cada objeto deve conter: intencao (registro, limpeza, financeiro, etc), produto, quantidade, unidade, localizacao e data (YYYY-MM-DD).
- Se faltar informação crítica para uma ação (ex: sem quantidade), marque 'necessita_mais_info: true' e formule uma 'pergunta_ao_usuario' específica para essa ação.`

// ClassifyIntent performs a unified classification and extraction call.
func (c *Client) ClassifyIntent(ctx context.Context, parts []*genai.Part) (llm.UnifiedIntentResult, string, error) {
	// 1. Gerar Schemas Agnósticos (um para cada formato de provedor)
	jsonSchemaBytes, _ := schema.Reflect[llm.UnifiedIntentResult]()
	googleSchema, _ := schema.ForGoogle(jsonSchemaBytes)
	openRouterSchema, _ := schema.ForOpenRouter(jsonSchemaBytes, "UnifiedIntentResult")

	// Preparar log
	logText := ""
	for _, p := range parts {
		if p.Text != "" {
			logText += p.Text + " "
		}
	}
	log.Printf("🧭 [UNIFIED-ROUTER] Analisando: '%s'", truncate(strings.TrimSpace(logText), 60))

	sysInst := routerSystemPrompt + fmt.Sprintf("\n\nData Atual: %s", time.Now().Format("2006-01-02"))

	op := func(modelName string) (any, error) {
		// Se for modelo da OpenRouter (verificado pelo prefixo do modelo ou se c.OpenAI estiver sendo usado via fallback)
		if strings.Contains(modelName, "/") || c.OpenAI != nil {
			// Nota: O fallback automático entre Google e OpenRouter é gerido pela lógica de flags no main/orquestrador.
			// Aqui, simulamos a chamada dependendo de qual modelo o fallback escolher.
			// Se o modelName vier do config da Google, usamos CallGoogle.
			if modelName == c.Config.Model || modelName == c.Config.FallbackModel {
				return c.CallGoogle(ctx, sysInst, []llm.MensagemAgnostica{{Role: llm.PapelUser, Content: logText}}, nil, googleSchema)
			}
			return c.CallOpenRouter(ctx, sysInst, []llm.MensagemAgnostica{
				{Role: llm.PapelUser, Content: logText},
			}, nil, openRouterSchema)
		}

		// Default: Google Gemini SDK
		return c.CallGoogle(ctx, sysInst, []llm.MensagemAgnostica{{Role: llm.PapelUser, Content: logText}}, nil, googleSchema)
	}

	res, modelUsed, err := c.withFallback(ctx, op)
	if err != nil {
		return llm.UnifiedIntentResult{Intent: llm.IntentRAG}, modelUsed, err
	}

	// 2. Extrair Resposta (Pode vir de CallGoogle ou CallOpenRouter, ambos retornam RespostaAgnostica)
	agnosticResp := res.(llm.RespostaAgnostica)
	
	// 3. Validar e Decodificar via motor agnóstico
	result, err := schema.DecodeAndValidate[llm.UnifiedIntentResult](agnosticResp.Texto)
	if err != nil {
		log.Printf("⚠️ [ROUTER] Erro de Validação/Schema: %v. Raw: %s", err, agnosticResp.Texto)
		// Fallback resiliente: tenta pelo menos identificar a intenção RAG se tudo falhar
		return llm.UnifiedIntentResult{Intent: llm.IntentRAG, Confidence: 0.5, Reasoning: "schema_validation_error"}, modelUsed, nil
	}

	// Normalização de Fallback se campos críticos estiverem vazios
	if result.Intent == "" { result.Intent = llm.IntentRAG }
	
	firstIntencao := "duvida"
	if len(result.Entities) > 0 && result.Entities[0].Intencao != "" {
		firstIntencao = result.Entities[0].Intencao
	}

	log.Printf("🧭 [ROUTER] Intent: %s (Primeira Entidade: %s) | Conf: %.2f | Reasoning: %s | Total: %d", result.Intent, firstIntencao, result.Confidence, result.Reasoning, len(result.Entities))

	return result, modelUsed, nil
}

// truncate is a helper to safely shorten strings for logging.
func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "..."
}
