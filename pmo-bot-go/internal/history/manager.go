package history

import (
	"fmt"
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
			delete(m.conversations, phone)
		}
	}
}
