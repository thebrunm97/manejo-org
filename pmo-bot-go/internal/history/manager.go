package history

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

// Conversation holds the history and FSM state for a specific phone number
type Conversation struct {
	Messages        []llm.MensagemAgnostica
	LastUpdate      time.Time
	FSMState        string
	FSMContext      map[string]interface{}
	PendingEntities []llm.AcaoEstruturada
}

// Manager handles in-memory conversation history with TTL
type Manager struct {
	mu            sync.RWMutex
	conversations map[string]*Conversation
	ttl           time.Duration
	maxMessages   int
}

// NewManager initializes a history manager
func NewManager(ttl time.Duration, maxMessages int) *Manager {
	m := &Manager{
		conversations: make(map[string]*Conversation),
		ttl:           ttl,
		maxMessages:   maxMessages,
	}

	// Start a background cleanup routine
	go m.startCleanup()

	return m
}

// GetHistory retrieves the last messages for a phone number
func (m *Manager) GetHistory(phone string) []llm.MensagemAgnostica {
	m.mu.Lock() // Full lock because we mutate conv.LastUpdate
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		return nil
	}

	conv.LastUpdate = time.Now()

	// Create a copy to avoid race conditions when reading
	history := make([]llm.MensagemAgnostica, len(conv.Messages))
	copy(history, conv.Messages)
	return history
}

// AddMessage is a legacy helper to append simple messages (user/model) without tools
func (m *Manager) AddMessage(phone string, role, content string) {
	msg := llm.MensagemAgnostica{
		Role:    llm.Papel(role),
		Content: content,
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		conv = &Conversation{
			Messages: make([]llm.MensagemAgnostica, 0),
		}
		m.conversations[phone] = conv
	}

	conv.Messages = append(conv.Messages, msg)
	conv.LastUpdate = time.Now()

	if len(conv.Messages) > m.maxMessages {
		conv.Messages = conv.Messages[len(conv.Messages)-m.maxMessages:]
	}
}

// AppendAgnosticHistory replaces the user's history with the new slice, applying Semantic Pruning.
func (m *Manager) AppendAgnosticHistory(phone string, fullHistory []llm.MensagemAgnostica) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		conv = &Conversation{
			Messages: make([]llm.MensagemAgnostica, 0),
		}
		m.conversations[phone] = conv
	}

	// Semantic Pruning logic:
	// We read the fullHistory from beginning to end. If we detect a completed turn that used tools,
	// we replace the [User -> ToolCalls -> ToolResponses -> ModelResponse] with a summarized System State message.
	var prunedHistory []llm.MensagemAgnostica
	turnStartIndex := -1
	turnHasTools := false

	for i := 0; i < len(fullHistory); i++ {
		msg := fullHistory[i]

		if msg.Role == llm.PapelUser {
			// Flush any pending un-pruned turn (if somehow malformed or incomplete)
			if turnStartIndex != -1 {
				prunedHistory = append(prunedHistory, fullHistory[turnStartIndex:i]...)
			}
			turnStartIndex = i
			turnHasTools = false
		} else if msg.Role == llm.PapelAssistant && len(msg.ToolCalls) > 0 {
			turnHasTools = true
		} else if msg.Role == llm.PapelTool {
			turnHasTools = true
		} else if msg.Role == llm.PapelAssistant && len(msg.ToolCalls) == 0 && msg.Content != "" {
			// This is a final response from the model
			if turnStartIndex != -1 && turnHasTools {
				// We have a completed turn that used tools! PRUNE IT.
				// However, we MUST NOT prune if this is the very last model response of the array?
				// Actually, the user says "apenas as que já resultaram numa resposta de texto final em turnos anteriores".
				// Oh, if this is the very last message in the array, it IS the current turn's final response.
				// "As mensagens do turno atual (em andamento) NUNCA devem ser comprimidas."
				// But wait, if this method receives the history AT THE END of the current turn,
				// do we compress the current turn right away?
				// User says: "As mensagens do turno atual (em andamento) NUNCA devem ser comprimidas. Apenas as interações já finalizadas."
				// This usually implies we compress ALL previous turns, but keep the VERY LAST turn fully expanded?
				// Wait, if it's already finalized, why not compress the LAST one too for the NEXT time?
				// Because the user might want to see the trace of what JUST happened? But FSM state resets.
				// I will only prune if there is another User message *after* this turn, OR just prune all
				// completely resolved tools, EXCEPT the last completed turn.

				// Let's check if this is the LAST user turn in the array
				isLastTurn := true
				for j := i + 1; j < len(fullHistory); j++ {
					if fullHistory[j].Role == llm.PapelUser {
						isLastTurn = false
						break
					}
				}

				if !isLastTurn {
					// Compress this old turn
					userQuery := fullHistory[turnStartIndex].Content
					finalResponse := msg.Content
					summary := fmt.Sprintf("[MEMÓRIA DO SISTEMA] Em um turno anterior, o usuário disse: %q. O sistema executou as ferramentas correspondentes com sucesso. Resposta gerada: %q", userQuery, finalResponse)

					prunedHistory = append(prunedHistory, llm.MensagemAgnostica{
						Role:    llm.PapelAssistant, // Using role model as requested/approved
						Content: summary,
					})
				} else {
					// It is the last turn, DO NOT prune! Append everything normally.
					prunedHistory = append(prunedHistory, fullHistory[turnStartIndex:i+1]...)
				}

				turnStartIndex = -1 // Reset turn tracker
				turnHasTools = false
			} else if turnStartIndex != -1 {
				// Final response without tools, just keep it normal
				prunedHistory = append(prunedHistory, fullHistory[turnStartIndex:i+1]...)
				turnStartIndex = -1
				turnHasTools = false
			} else {
				// Floating message without user start
				prunedHistory = append(prunedHistory, msg)
			}
		} else if turnStartIndex == -1 {
			// Floating message
			prunedHistory = append(prunedHistory, msg)
		}
	}

	// If there is any incomplete turn left
	if turnStartIndex != -1 {
		prunedHistory = append(prunedHistory, fullHistory[turnStartIndex:]...)
	}

	conv.Messages = prunedHistory
	conv.LastUpdate = time.Now()

	if len(conv.Messages) > m.maxMessages {
		conv.Messages = conv.Messages[len(conv.Messages)-m.maxMessages:]
	}
}

// InjectSystemNote inserts a specialized "observation" message into the history as a model response.
func (m *Manager) InjectSystemNote(phone string, note string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		conv = &Conversation{
			Messages: make([]llm.MensagemAgnostica, 0),
		}
		m.conversations[phone] = conv
	}

	conv.Messages = append(conv.Messages, llm.MensagemAgnostica{
		Role:    llm.PapelAssistant,
		Content: fmt.Sprintf("[OBSERVAÇÃO DO SISTEMA: %s]", note),
	})
	conv.LastUpdate = time.Now()

	if len(conv.Messages) > m.maxMessages {
		conv.Messages = conv.Messages[len(conv.Messages)-m.maxMessages:]
	}
}

// estimateTokens returns a rough estimate of tokens using Characters/4 heuristic
func estimateTokens(messages []llm.MensagemAgnostica) int {
	totalChars := 0
	for _, m := range messages {
		totalChars += len(m.Content)
		for _, tc := range m.ToolCalls {
			totalChars += len(tc.Nome)
			if b, err := json.Marshal(tc.Args); err == nil {
				totalChars += len(b)
			}
		}
	}
	return totalChars / 4
}

// TriggerAsyncCompression starts a background worker that measures context length and summarizes it via LLM if needed
func (m *Manager) TriggerAsyncCompression(phone string, llmClient llm.LLMProvider, thresholdTokens int) {
	m.mu.RLock()
	conv, ok := m.conversations[phone]
	if !ok || len(conv.Messages) == 0 {
		m.mu.RUnlock()
		return
	}
	
	// Fast-fail check
	approxTokens := estimateTokens(conv.Messages)
	m.mu.RUnlock()

	if approxTokens < thresholdTokens {
		return // Still within bounds
	}

	// Above threshold! Fire the background worker
	go func() {
		log.Printf("🧹 [MemoryManager] %s ultrapassou %d tokens (~%d). Iniciando compressão assíncrona...", phone, thresholdTokens, approxTokens)

		m.mu.RLock()
		conv, ok := m.conversations[phone]
		if !ok || len(conv.Messages) < 4 {
			m.mu.RUnlock()
			return
		}

		// Keep the 3 most recent messages (e.g. User -> Tool -> Response) intact
		preserveCount := 3
		if len(conv.Messages) <= preserveCount {
			m.mu.RUnlock()
			return
		}

		splitIndex := len(conv.Messages) - preserveCount
		oldMessages := make([]llm.MensagemAgnostica, splitIndex)
		copy(oldMessages, conv.Messages[:splitIndex])
		m.mu.RUnlock()

		// Build prompt for the LLM
		prompt := "Você é um assistente encarregado de resumir um histórico de conversa. Extraia e resuma os principais pontos discutidos, decisões tomadas e o contexto atual da conversa. Seja extremamente conciso, omitindo amenidades e focando em fatos e operações."
		
		req := llm.ContentRequest{
			SystemInstruction: prompt,
			History:           oldMessages,
		}
		
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		resp, err := llmClient.GenerateContent(ctx, req)
		if err != nil {
			log.Printf("⚠️ [MemoryManager] Falha ao sumarizar histórico de %s: %v", phone, err)
			return
		}

		summary := fmt.Sprintf("[SUMÁRIO DE CONVERSA ANTERIOR] %s", resp.Texto)
		
		// Now we acquire a full write lock to merge
		m.mu.Lock()
		defer m.mu.Unlock()

		conv, ok = m.conversations[phone]
		if !ok {
			return
		}

		// We need to carefully merge. In the meantime, the user could have sent MORE messages.
		// So `conv.Messages` might be longer than it was.
		// We replace exactly the old prefix that we summarized with our new summary.
		// To do this safely without breaking references, we can check if the prefix still matches.
		// Actually, simpler: we just preserve the last N messages where N is what accumulated since we unlocked,
		// plus the preserved messages.
		
		var newMessages []llm.MensagemAgnostica
		newMessages = append(newMessages, llm.MensagemAgnostica{
			Role:    llm.PapelAssistant,
			Content: summary,
		})

		// How many messages were added while we were unlocking and waiting for LLM?
		// We knew the length was originally splitIndex + preserveCount.
		// If current length is > splitIndex, we append everything from splitIndex onwards.
		if len(conv.Messages) > splitIndex {
			newMessages = append(newMessages, conv.Messages[splitIndex:]...)
		} else {
			// Something weird happened, conv was shortened. Just use current.
			newMessages = append(newMessages, conv.Messages...)
		}

		conv.Messages = newMessages
		conv.LastUpdate = time.Now()

		log.Printf("✅ [MemoryManager] %s compressão finalizada. Novo tamanho do histórico: %d mensagens.", phone, len(conv.Messages))
	}()
}

func (m *Manager) startCleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		m.Cleanup()
	}
}

// GetFSMState returns the current state, context, and pending entities for a phone number
func (m *Manager) GetFSMState(phone string) (string, map[string]interface{}, []llm.AcaoEstruturada) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conv, ok := m.conversations[phone]
	if !ok {
		return "", nil, nil
	}

	// Clone the map to prevent concurrent mutation outside the lock
	var ctxClone map[string]interface{}
	if conv.FSMContext != nil {
		ctxClone = make(map[string]interface{}, len(conv.FSMContext))
		for k, v := range conv.FSMContext {
			ctxClone[k] = v
		}
	}

	// Clone the pending entities slice
	var pendingClone []llm.AcaoEstruturada
	if conv.PendingEntities != nil {
		pendingClone = make([]llm.AcaoEstruturada, len(conv.PendingEntities))
		copy(pendingClone, conv.PendingEntities)
	}

	return conv.FSMState, ctxClone, pendingClone
}

// SetFSMState updates the state, context, and pending entities for a phone number
func (m *Manager) SetFSMState(phone string, state string, ctx map[string]interface{}, pending []llm.AcaoEstruturada) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		conv = &Conversation{
			Messages: make([]llm.MensagemAgnostica, 0),
		}
		m.conversations[phone] = conv
	}
	
	oldState := conv.FSMState
	if oldState != state {
		log.Printf("telemetry event=fsm_state_changed from=%s to=%s reason=state_update conversation_id=%s turn_id=N/A", oldState, state, phone)
	}
	
	// fsm_pending_enter: se estivermos entrando em um estado de "aguardando" (pending) e não for o mesmo de antes
	if state != "" && state != oldState && (len(pending) > 0 || state == "StateAguardandoQuantidade" || state == "StateAguardandoFazenda") {
		log.Printf("telemetry event=fsm_pending_enter from=%s to=%s reason=state_update conversation_id=%s turn_id=N/A", oldState, state, phone)
	}

	conv.FSMState = state
	conv.FSMContext = ctx
	conv.PendingEntities = pending
	conv.LastUpdate = time.Now()
}

// ClearFSMState resets the FSM state for a phone number
func (m *Manager) ClearFSMState(phone string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if ok {
		oldState := conv.FSMState
		if oldState != "" {
			log.Printf("telemetry event=fsm_state_changed from=%s to= reason=clear conversation_id=%s turn_id=N/A", oldState, phone)
			
			// fsm_pending_exit: Se o state não for vazio, consideramos que o pending foi resolvido (exit)
			log.Printf("telemetry event=fsm_pending_exit from=%s to= reason=clear conversation_id=%s turn_id=N/A", oldState, phone)
		}

		conv.FSMState = ""
		conv.FSMContext = nil
		conv.PendingEntities = nil
		conv.LastUpdate = time.Now()
	}
}

// Cleanup removes expired conversations
func (m *Manager) Cleanup() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for phone, conv := range m.conversations {
		if now.Sub(conv.LastUpdate) > m.ttl {
			if conv.FSMState != "" {
				log.Printf("telemetry event=fsm_pending_timeout from=%s to= reason=timeout conversation_id=%s turn_id=N/A duration_ms=%d", conv.FSMState, phone, m.ttl.Milliseconds())
			}
			delete(m.conversations, phone)
		}
	}
}
