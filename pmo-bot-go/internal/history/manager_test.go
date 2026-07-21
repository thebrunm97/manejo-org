package history

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

type mockLLMProvider struct {
	delay time.Duration
	llm.LLMProvider // Embed to satisfy interface implicitly
}

func (m *mockLLMProvider) GenerateContent(ctx context.Context, req llm.ContentRequest) (llm.RespostaAgnostica, error) {
	if m.delay > 0 {
		select {
		case <-ctx.Done():
			return llm.RespostaAgnostica{}, ctx.Err()
		case <-time.After(m.delay):
		}
	}
	return llm.RespostaAgnostica{
		Texto: "Mocked summary",
	}, nil
}

func TestManager_TriggerAsyncCompression(t *testing.T) {
	t.Run("should trigger compression when threshold is exceeded", func(t *testing.T) {
		manager := NewManager(10*time.Minute, 100)
		phone := "123456789"
		
		// Create a large message to exceed threshold
		largeContent := strings.Repeat("a", 8000) // 8000 chars / 4 = 2000 tokens
		manager.AddMessage(phone, "user", largeContent)
		manager.AddMessage(phone, "assistant", "response")
		manager.AddMessage(phone, "user", "another question")
		manager.AddMessage(phone, "assistant", "another response")
		
		llmMock := &mockLLMProvider{delay: 10 * time.Millisecond}
		
		// Should not block
		start := time.Now()
		manager.TriggerAsyncCompression(phone, llmMock, 1000) // threshold 1000 tokens
		elapsed := time.Since(start)
		
		// Zero-latency check (should be practically instant, definitely under 5ms, but let's be safe for slow CI)
		if elapsed > 15*time.Millisecond {
			t.Errorf("TriggerAsyncCompression blocked the main thread. Took %v", elapsed)
		}
		
		// Wait for compression to complete
		time.Sleep(500 * time.Millisecond)
		
		history := manager.GetHistory(phone)
		// We expect the first message to be the summary (role assistant)
		if len(history) == 0 {
			t.Fatalf("History is empty")
		}
		if history[0].Role != llm.PapelAssistant {
			t.Errorf("Expected first message to be summary (assistant), got %v", history[0].Role)
		}
		if !strings.Contains(history[0].Content, "[SUMÁRIO DE CONVERSA ANTERIOR]") {
			t.Errorf("Expected summary prefix, got: %s", history[0].Content)
		}
	})

	t.Run("should not compress when below threshold", func(t *testing.T) {
		manager := NewManager(10*time.Minute, 100)
		phone := "123456789"
		
		smallContent := "hello"
		manager.AddMessage(phone, "user", smallContent)
		manager.AddMessage(phone, "assistant", "response")
		
		llmMock := &mockLLMProvider{delay: 10 * time.Millisecond}
		
		manager.TriggerAsyncCompression(phone, llmMock, 1000)
		
		time.Sleep(200 * time.Millisecond)
		
		history := manager.GetHistory(phone)
		if len(history) != 2 {
			t.Errorf("Expected 2 messages, got %d", len(history))
		}
		if strings.Contains(history[0].Content, "[SUMÁRIO") {
			t.Errorf("Should not have compressed history")
		}
	})

	t.Run("thread-safe merge: handles concurrent incoming messages during compression", func(t *testing.T) {
		manager := NewManager(10*time.Minute, 100)
		phone := "123456789"
		
		largeContent := strings.Repeat("a", 8000)
		manager.AddMessage(phone, "user", largeContent)
		manager.AddMessage(phone, "assistant", "response 1")
		manager.AddMessage(phone, "user", "question 2")
		manager.AddMessage(phone, "assistant", "response 2")
		
		// Mock with 100ms latency to simulate network call
		llmMock := &mockLLMProvider{delay: 100 * time.Millisecond}
		
		// Start compression (takes 100ms)
		manager.TriggerAsyncCompression(phone, llmMock, 1000)
		
		// While compression is running, user sends another message concurrently (at 20ms)
		time.Sleep(20 * time.Millisecond)
		manager.AddMessage(phone, "user", "concurrent question")
		manager.AddMessage(phone, "assistant", "concurrent response")
		
		// Wait for compression to complete
		time.Sleep(500 * time.Millisecond)
		
		history := manager.GetHistory(phone)
		
		if len(history) == 0 {
			t.Fatalf("History is empty")
		}
		
		// Check that we didn't lose the concurrent messages
		hasConcurrentMsg := false
		for _, msg := range history {
			if msg.Content == "concurrent question" {
				hasConcurrentMsg = true
				break
			}
		}
		
		if !hasConcurrentMsg {
			t.Errorf("Concurrent message was lost during compression merge!")
		}
		
		if !strings.Contains(history[0].Content, "[SUMÁRIO") {
			t.Errorf("Expected summary prefix, got: %s", history[0].Content)
		}
	})
}
