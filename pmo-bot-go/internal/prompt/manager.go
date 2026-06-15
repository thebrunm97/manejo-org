// Package prompt manages system prompts for the bot.
// Prompts belong to the DOMAIN (agronomy, finance), not to any specific LLM
// provider. This package owns the //go:embed directives and the intent-based
// prompt selection logic that was previously coupled to the gemini package.
package prompt

import (
	_ "embed"
	"fmt"
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
	case llm.IntentRAG:
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
func RouterSystemPrompt() string {
	return fmt.Sprintf(`Você é um especialista em processamento de linguagem natural para agricultura orgânica.
Sua tarefa é tripla:
1. CLASSIFICAR a intenção do usuário (Intent).
2. EXTRAIR múltiplas informações estruturadas (NER) se a mensagem contiver registros de atividade.
3. FORNECER raciocínio técnico sobre a classificação e a segmentação das entidades.

Intents disponíveis:
- "RAG": DÚVIDA TÉCNICA sobre agricultura orgânica, normas (IN 46), pragas, adubação, ou CLIMA/PREVISÃO DO TEMPO. NÃO envolve criar registros.
- "DATABASE": O usuário quer REGISTRAR atividades agrícolas (plantio, colheita, venda, limpeza, compostagem) ou CONSULTAR dados da fazenda.
- "REGISTRO_FINANCEIRO": O usuário quer registrar despesas, custos ou compras financeiras puras (ex: gastou dinheiro ou registrou compra de insumo com valor monetário).
- "CHAT": Saudação, agradecimento ou conversa genérica. (Perguntas sobre clima NÃO são CHAT, são RAG).

Regras de Extração (para DATABASE e REGISTRO_FINANCEIRO):
- Use o array "entidades" para listar todas as ações detectadas.
- SEPARE frases complexas em múltiplos objetos. Ex: "Apliquei 10L no Talhão A e 5L no Talhão B" deve gerar DOIS objetos no array "entidades".
- Cada objeto deve conter: intencao (registro, limpeza, financeiro, etc), produto, quantidade, unidade, localizacao e data (YYYY-MM-DD).
- Se faltar informação crítica para uma ação (ex: sem quantidade), marque 'necessita_mais_info: true' e formule uma 'pergunta_ao_usuario' específica para essa ação.

Data atual do sistema: %s`, time.Now().Format("2006-01-02"))
}
