package history

import (
	"sync"
	"time"
)

// Message represents a single interaction in the conversation
type Message struct {
	Role    string // "user" or "model"
	Content string
}

// Conversation holds the history and FSM state for a specific phone number
type Conversation struct {
	Messages   []Message
	LastUpdate time.Time
	FSMState   string
	FSMContext map[string]interface{}
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
func (m *Manager) GetHistory(phone string) []Message {
	m.mu.Lock() // Full lock because we mutate conv.LastUpdate
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		return nil
	}

	conv.LastUpdate = time.Now()

	// Create a copy to avoid race conditions when reading
	history := make([]Message, len(conv.Messages))
	copy(history, conv.Messages)
	return history
}

// AddMessage appends a message and maintains the limit
func (m *Manager) AddMessage(phone string, role, content string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		conv = &Conversation{
			Messages: make([]Message, 0),
		}
		m.conversations[phone] = conv
	}

	conv.Messages = append(conv.Messages, Message{Role: role, Content: content})
	conv.LastUpdate = time.Now()

	// Keep only the last N messages
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

// GetFSMState returns the current state and context for a phone number
func (m *Manager) GetFSMState(phone string) (string, map[string]interface{}) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conv, ok := m.conversations[phone]
	if !ok {
		return "", nil
	}

	// Clone the map to prevent concurrent mutation outside the lock
	if conv.FSMContext == nil {
		return conv.FSMState, nil
	}
	ctxClone := make(map[string]interface{}, len(conv.FSMContext))
	for k, v := range conv.FSMContext {
		ctxClone[k] = v
	}
	return conv.FSMState, ctxClone
}

// SetFSMState updates the state and context for a phone number
func (m *Manager) SetFSMState(phone string, state string, ctx map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, ok := m.conversations[phone]
	if !ok {
		conv = &Conversation{
			Messages: make([]Message, 0),
		}
		m.conversations[phone] = conv
	}
	conv.FSMState = state
	conv.FSMContext = ctx
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
