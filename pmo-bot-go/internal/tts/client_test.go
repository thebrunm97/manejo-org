package tts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTTSClient_ContextCancelled_ReturnsErrorPromptly(t *testing.T) {
	// Create a mock server that hangs indefinitely
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second)
	}))
	defer server.Close()

	client := NewOrchestrator(server.URL, "fake-key")

	ctx, cancel := context.WithCancel(context.Background())
	// Cancel the context immediately
	cancel()

	_, err := client.GenerateSpeech(ctx, "Test timeout")

	if err == nil {
		t.Fatal("expected error due to cancelled context, got nil")
	}

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestTTSClient_GenerateSpeech_NativeMP3Format(t *testing.T) {
	// Mock MP3 signature (ID3 = 49 44 33)
	mockMP3Payload := []byte{0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 'h', 'e', 'l', 'l', 'o'}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify if response_format is mp3
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		if format, ok := payload["response_format"].(string); !ok || format != "mp3" {
			t.Errorf("expected response_format=mp3, got %v", format)
		}

		w.Header().Set("Content-Type", "audio/mpeg")
		w.WriteHeader(http.StatusOK)
		w.Write(mockMP3Payload)
	}))
	defer server.Close()

	client := NewOrchestrator(server.URL, "fake-key")
	ctx := context.Background()
	audioBytes, err := client.GenerateSpeech(ctx, "Hello world")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(audioBytes) < 3 {
		t.Fatal("audio payload too short")
	}

	// Validate magic bytes for MP3 (ID3)
	if !bytes.HasPrefix(audioBytes, []byte{0x49, 0x44, 0x33}) {
		t.Fatalf("invalid magic bytes, expected ID3 (0x49 0x44 0x33), got %x", audioBytes[:3])
	}
}

func TestTTSClient_QuotaExceeded_ReturnsSpecificError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error": "insufficient_quota"}`))
	}))
	defer server.Close()

	client := NewOrchestrator(server.URL, "fake-key")
	ctx := context.Background()
	_, err := client.GenerateSpeech(ctx, "Hello world")

	if !errors.Is(err, ErrTTSQuotaExceeded) {
		t.Fatalf("expected ErrTTSQuotaExceeded, got %v", err)
	}
}

func TestTTSClient_Timeout_ReturnsSpecificError(t *testing.T) {
	// Not context.Canceled, but DeadlineExceeded or client timeout mapped to ErrTTSTimeout
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond) // Simulate delay
	}))
	defer server.Close()

	client := NewOrchestrator(server.URL, "fake-key")

	// Fast timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	_, err := client.GenerateSpeech(ctx, "Hello world")

	if !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, ErrTTSTimeout) {
		t.Fatalf("expected DeadlineExceeded or ErrTTSTimeout, got %v", err)
	}
}

func TestTTSClient_FallsBackToNextModelOnError(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var payload map[string]interface{}
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &payload)

		model, _ := payload["model"].(string)
		if calls == 1 {
			if model != "openai/tts-1" {
				t.Fatalf("expected first model openai/tts-1, got %s", model)
			}
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error":{"message":"Model does not exist"}}`))
			return
		}

		if model != "openai/gpt-4o-mini-tts" {
			t.Fatalf("expected fallback model openai/gpt-4o-mini-tts, got %s", model)
		}

		w.Header().Set("Content-Type", "audio/mpeg")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte{0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00})
	}))
	defer server.Close()

	client := NewOrchestrator(server.URL, "fake-key")
	client.Models = []string{"openai/tts-1", "openai/gpt-4o-mini-tts"}

	_, err := client.GenerateSpeech(context.Background(), "Hello world")
	if err != nil {
		t.Fatalf("expected fallback request to succeed, got %v", err)
	}
	if calls != 2 {
		t.Fatalf("expected 2 model attempts, got %d", calls)
	}
}
