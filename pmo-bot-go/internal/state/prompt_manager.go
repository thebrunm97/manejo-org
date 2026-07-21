package state

import (
	"fmt"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/okf"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// PromptManager handles the construction and contextualization of prompts for the LLM.
type PromptManager struct{}

// NewPromptManager creates a new PromptManager.
func NewPromptManager() *PromptManager {
	return &PromptManager{}
}

// BuildSystemInstruction composes the final system prompt with farm context and output guardrails.
func (m *PromptManager) BuildSystemInstruction(profile *supabase.Profile, basePrompt string, agentDomain string, userMemories string) string {
	farmContext := ""
	if profile != nil && profile.ID != "" {
		farmContext = fmt.Sprintf("\n[CONTEXTO DO USUÁRIO]:\n- user_id: %s\n", profile.ID)
		if profile.PropriedadeAtivaID > 0 {
			farmContext += fmt.Sprintf("- propriedade_id: %d\n", profile.PropriedadeAtivaID)
			if len(profile.Talhoes) > 0 {
				talhoesNames := []string{}
				for _, t := range profile.Talhoes {
					talhoesNames = append(talhoesNames, fmt.Sprintf("%s (ID: %d)", t.Nome, t.ID))
				}
				farmContext += fmt.Sprintf("- Talhões Disponíveis: %s\n", strings.Join(talhoesNames, ", "))
			}
		}
		if profile.PmoAtivoID > 0 {
			farmContext += fmt.Sprintf("- pmo_id: %d\n", profile.PmoAtivoID)
		}
	}

	toolCallGuardrail := "\n\n[REGRA ABSOLUTA DE SAÍDA]: NUNCA inclua JSON de chamadas de ferramenta (tool_calls, function_call, {\"name\":..., \"args\":...}, etc.) na sua resposta final ao utilizador. A sua resposta deve ser APENAS texto amigável em Português. Se uma ferramenta foi executada, descreva o RESULTADO da ação com palavras simples."
	
	baseContent := basePrompt + "\n" + farmContext + "\nUse as ferramentas para consultar ou registrar dados. Se as informações críticas (como IDs de talhão ou PMO) já constam no contexto acima, use-as DIRETAMENTE sem perguntar ou consultar novamente." + toolCallGuardrail
	
	sysInst := "<IDENTIDADE_E_REGRAS_LLM>\n" + baseContent + "\n</IDENTIDADE_E_REGRAS_LLM>\n\n"

	if userMemories != "" {
		sysInst += "<MEMORIA_DO_PRODUTOR>\n" + userMemories + "\n</MEMORIA_DO_PRODUTOR>\n\n"
	}

	// Injeta a camada estática de OKF de forma segmentada
	if okf.GlobalLoader != nil {
		sysInst += "<REGRAS_NEGOCIO_OKF>\n" + okf.GlobalLoader.GetContextForDomain(agentDomain) + "\n</REGRAS_NEGOCIO_OKF>\n\n"
	}

	// Adiciona a instrução para balanceamento RAG vs OKF apenas para agronomia
	if agentDomain == "agronomy" {
		sysInst += "<INSTRUCAO_RAG>\nQuando invocares a ferramenta \"ConsultarBaseConhecimento\", os resultados fornecidos refletem o histórico dinâmico. As <REGRAS_NEGOCIO_OKF> têm precedência e são ABSOLUTAS. Se o RAG devolver informação que contradiga as regras estáticas, ignora a informação do RAG.\n</INSTRUCAO_RAG>"
	}

	return sysInst
}

// BuildTurnHistory injects summary rules for multi-turn loops, specially handling pending HITL.
func (m *PromptManager) BuildTurnHistory(baseHistory []llm.MensagemAgnostica) []llm.MensagemAgnostica {
	currentHistory := append([]llm.MensagemAgnostica{}, baseHistory...)

	hasPendingHITL := false
	for _, hMsg := range baseHistory {
		if hMsg.Role == llm.PapelTool && strings.Contains(hMsg.Content, "awaiting_confirmation") {
			hasPendingHITL = true
			break
		}
	}

	summaryInstruction := "RESUMO OBRIGATÓRIO: NUNCA retorne uma resposta vazia. Resuma os resultados das ferramentas executadas de forma amigável para o usuário."
	if hasPendingHITL {
		summaryInstruction += " IMPORTANTE: Se o status de alguma ferramenta for 'awaiting_confirmation', isso significa que a operação NÃO foi concluída e está aguardando aprovação do produtor pelo WhatsApp. Você deve informar ao usuário de forma clara que a ação específica aguarda confirmação e que uma solicitação de aprovação foi enviada para o WhatsApp dele, e NUNCA dizer que a operação foi concluída ou registrada com sucesso."
	}

	currentHistory = append(currentHistory, llm.MensagemAgnostica{
		Role:    llm.PapelSystem,
		Content: summaryInstruction,
	})

	return currentHistory
}
