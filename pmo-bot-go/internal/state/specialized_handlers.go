package state

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/prompt"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// ActiveOutputJudge is the package-level output governance judge.
// Set once at startup via SetOutputJudge; nil disables output governance.
// Thread-safe for reads after initialization (set before any goroutine starts).
var ActiveOutputJudge guardrails.OutputJudge

// ActiveHITLController is the package-level HITL approval controller.
// Set once at startup via SetHITL; nil disables HITL (development/test mode).
var ActiveHITLController guardrails.HITLHandler

// ActiveBusinessEvaluator is the package-level business guardrails evaluator.
var ActiveBusinessEvaluator guardrails.BusinessEvaluator

// SetOutputJudge configures the package-level output judge.
// Must be called before the first ProcessMessage invocation.
func SetOutputJudge(judge guardrails.OutputJudge) {
	ActiveOutputJudge = judge
}

// SetHITL configures the package-level HITL controller.
// Must be called before the first ProcessMessage invocation.
func SetHITL(h guardrails.HITLHandler) {
	ActiveHITLController = h
}

// SetBusinessEvaluator configures the package-level business evaluator.
func SetBusinessEvaluator(eval guardrails.BusinessEvaluator) {
	ActiveBusinessEvaluator = eval
}

// handleDuvidaFallback executa o fluxo agêntico generalista (orquestrador).
// Usado quando a intenção é DuvidaAgro, Clarification, Chat ou como fallback seguro de outros estados.
func handleDuvidaFallback(ctx context.Context, wpClient ports.ChannelSender, ttsClient ports.Synthesizer, from string, llmClient LLMClient, body string, isAudio bool, sbClient *supabase.Client, profile *supabase.Profile, startTime time.Time, _ int, _ int, finalIntent string, tools []llm.FerramentaAgnostica, guard *mcp.LoopGuard, historyManager *history.Manager, mcpServer *mcp.Server, agentDomain string, routerResult RouterResult, memoryCache ports.MemoryCacheService) (string, ProcessResult) {
	log.Printf("🤖 [FSM] Iniciando Fluxo Especialista (Intent: %s)", finalIntent)

	// 1. Prepare Specialized Context
	phone, _ := sbClient.ResolvePhone(from)
	modality := profile.ModalidadePredominante
	if modality == "" {
		modality = "NÃO DEFINIDA"
	}
	specPrompt := prompt.ForIntent(llm.Intent(finalIntent), modality, profile.TemProducaoParalela)

	// 2. Load History into Agnostic Format
	var agnosticHistory []llm.MensagemAgnostica
	if historyManager != nil {
		h := historyManager.GetHistory(phone)
		for _, m := range h {
			role := llm.PapelUser
			if m.Role != "user" {
				role = llm.PapelAssistant
			}
			agnosticHistory = append(agnosticHistory, llm.MensagemAgnostica{
				Role:    role,
				Content: m.Content,
			})
		}
	}

	var totalPromptTokens, totalCompletionTokens int

	// 3. Execute Agentic Loop via Orchestrator (Agnostic)
	orchestrator := NewOrchestrator(llmClient, sbClient, mcpServer)
	if finalIntent != "RAG" && finalIntent != "DATABASE" && finalIntent != "FINANCE" {
		orchestrator.OutputJudge = nil // Disable for CHAT
	}
	orchestrator.Phone = phone       // needed for HITL WhatsApp confirmation
	orchestrator.WhatsApp = wpClient // wire message sender for HITL confirmation prompts

	// 2.5 Buscar Memória Persistente (Recall)
	//
	// DT-106: userMemories via sbClient.MatchUserMemory (RPC match_user_memory)
	// removido — código morto desde sempre. A migration que criava essa RPC e a
	// tabela user_memory_profiles (pmo-bot-go/migrations/008,009) referencia
	// `pmo(id)` (tabela inexistente; a real é `pmos`, com id BIGINT, não UUID)
	// e nunca foi aplicada em produção nem staging (confirmado via
	// introspecção). Todo turno com PMO ativo pagava uma chamada de
	// GetEmbedding só pra essa busca falhar sempre em silêncio (errMatch != nil
	// engolido) — custo e latência sem nenhum benefício. Superseded por
	// memoryCache.GetActiveContext (pmo_memory_cache, DT-93), que já cobre o
	// mesmo caso de uso com pgvector + Redis. userMemories mantido como
	// parâmetro (prompt_manager.go ainda o usa) mas sempre vazio agora — igual
	// ao comportamento real de produção antes desta limpeza.
	var userMemories string
	var activeBlock string
	if profile != nil && profile.PmoAtivoID > 0 {
		// Busca 3-camadas (Redis recent -> Redis scored -> Supabase semantic)
		if memoryCache != nil {
			activeCtxFrags, errCtx := memoryCache.GetActiveContext(ctx, int64(profile.PmoAtivoID), body)
			if errCtx == nil && len(activeCtxFrags) > 0 {
				pm := NewPromptManager()
				activeBlock = pm.BuildActiveContextBlock(activeCtxFrags)
			}
		}
	}

	botResponse, newHistory, trace, usage, modelUsed, err := orchestrator.ExecuteAgenticLoop(ctx, profile, specPrompt, body, tools, agnosticHistory, guard, agentDomain, userMemories, activeBlock, routerResult)
	if err != nil {
		if err.Error() == "hitl_pending" {
			log.Printf("⏸️ [FSM] HITL pendente. Salvando histórico e silenciando resposta conversacional.")
			if historyManager != nil {
				historyManager.AppendAgnosticHistory(phone, newHistory)
				historyManager.TriggerAsyncCompression(phone, llmClient.(llm.LLMProvider), 1500) // 1500 tokens threshold
			}
			recordLog(sbClient, profile, body, "[HITL PENDING]", llmClient.ModelName(), modelUsed, int(usage.PromptTokens), int(usage.CandidatesTokens), int(usage.CachedTokens), int(usage.CacheWriteTokens), finalIntent, map[string]interface{}{"status": "hitl_pending"}, startTime, true, trace)
			return "", ProcessResult{Success: false, Reason: "hitl_pending"}
		}

		// Tratar erro do Guardrail Determinístico (mensagem iniciando com "Atenção:")
		if strings.HasPrefix(err.Error(), "Atenção:") {
			log.Printf("🚨 [Guardrail] Abortando fluxo agêntico devido a restrições de negócio: %v", err)
			if historyManager != nil {
				historyManager.ClearFSMState(phone)
			}
			recordLog(sbClient, profile, body, err.Error(), llmClient.ModelName(), modelUsed, int(usage.PromptTokens), int(usage.CandidatesTokens), int(usage.CachedTokens), int(usage.CacheWriteTokens), finalIntent, map[string]interface{}{"status": "guardrail_failed", "error": err.Error()}, startTime, false, trace)
			return err.Error(), ProcessResult{Success: false, Reason: "guardrail_blocked"}
		}

		log.Printf("❌ [CRITICAL FSM ERROR] Orchestrator Loop failed: %v", err)
		return "⚠️ Ocorreu um erro interno ao processar sua dúvida. Por favor, tente novamente.", ProcessResult{Success: false, Reason: "orchestrator_failed"}
	}

	totalPromptTokens = int(usage.PromptTokens)
	totalCompletionTokens = int(usage.CandidatesTokens)

	if botResponse == "" {
		log.Printf("⚠️ [FSM] Resposta do bot vazia após execução do orquestrador. Usando fallback amigável.")
		botResponse = "✅ Operação registrada no sistema com sucesso!"
	} else {
		trimmed := strings.TrimSpace(botResponse)
		// Check for specific emojis that signal a non-technical header message
		excludePrefixes := []string{"✅", "❌", "🗑️", "⏳", "⚠️"}
		shouldOmitHeader := false
		for _, prefix := range excludePrefixes {
			if strings.HasPrefix(trimmed, prefix) {
				shouldOmitHeader = true
				break
			}
		}

		if shouldOmitHeader || finalIntent == "DATABASE" {
			botResponse = trimmed // Keep clean confirmation/error
		} else {
			botResponse = "🌿 *Consulta Técnica:*\n\n" + trimmed
		}
	}

	// 4. Logging and History Storage (No direct sendFeedback)
	extraction := map[string]interface{}{
		"intent": finalIntent,
		"query":  body,
		"trace":  trace, // Include trace in training log for better debugging
	}
	recordLog(sbClient, profile, body, botResponse, llmClient.ModelName(), modelUsed, totalPromptTokens, totalCompletionTokens, int(usage.CachedTokens), int(usage.CacheWriteTokens), finalIntent, extraction, startTime, true, trace)

	if historyManager != nil {
		historyManager.AppendAgnosticHistory(phone, newHistory)
		historyManager.TriggerAsyncCompression(phone, llmClient.(llm.LLMProvider), 1500) // 1500 tokens threshold
	}

	return botResponse, ProcessResult{Success: true, Reason: "agent_responded"}
}

