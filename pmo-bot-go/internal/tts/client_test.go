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

// newTestProvider monta um OpenAICompatProvider apontado para um servidor de
// teste, com a mesma cadeia de fallback usada em produção no OpenRouter.
func newTestProvider(baseURL string) *OpenAICompatProvider {
	return &OpenAICompatProvider{
		BaseURL:        baseURL,
		APIKey:         "fake-key",
		HTTPClient:     &http.Client{},
		Models:         []string{"openai/tts-1", "openai/gpt-4o-mini-tts"},
		Voice:          "alloy",
		ResponseFormat: "mp3",
		label:          "test",
	}
}

func TestTTSClient_ContextCancelled_ReturnsErrorPromptly(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second)
	}))
	defer server.Close()

	client := newTestProvider(server.URL)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, _, err := client.GenerateSpeech(ctx, "Test timeout")

	if err == nil {
		t.Fatal("expected error due to cancelled context, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestTTSClient_GenerateSpeech_NativeMP3Format(t *testing.T) {
	mockMP3Payload := []byte{0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 'h', 'e', 'l', 'l', 'o'}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

	client := newTestProvider(server.URL)
	audioBytes, mime, err := client.GenerateSpeech(context.Background(), "Hello world")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(audioBytes) < 3 {
		t.Fatal("audio payload too short")
	}
	if !bytes.HasPrefix(audioBytes, []byte{0x49, 0x44, 0x33}) {
		t.Fatalf("invalid magic bytes, expected ID3 (0x49 0x44 0x33), got %x", audioBytes[:3])
	}
	if mime != "audio/mpeg" {
		t.Fatalf("expected mime audio/mpeg, got %q", mime)
	}
}

func TestTTSClient_QuotaExceeded_ReturnsSpecificError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error": "insufficient_quota"}`))
	}))
	defer server.Close()

	client := newTestProvider(server.URL)
	_, _, err := client.GenerateSpeech(context.Background(), "Hello world")

	if !errors.Is(err, ErrTTSQuotaExceeded) {
		t.Fatalf("expected ErrTTSQuotaExceeded, got %v", err)
	}
}

func TestTTSClient_Timeout_ReturnsSpecificError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
	}))
	defer server.Close()

	client := newTestProvider(server.URL)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	_, _, err := client.GenerateSpeech(ctx, "Hello world")

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

	client := newTestProvider(server.URL)

	_, _, err := client.GenerateSpeech(context.Background(), "Hello world")
	if err != nil {
		t.Fatalf("expected fallback request to succeed, got %v", err)
	}
	if calls != 2 {
		t.Fatalf("expected 2 model attempts, got %d", calls)
	}
}

// Name deve refletir o modelo que de fato respondeu, não o primeiro configurado
// — é o mesmo contrato do `modelUsed` no LLMProvider.
func TestTTSClient_NameReflectsModelThatActuallyAnswered(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte{0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00})
	}))
	defer server.Close()

	client := newTestProvider(server.URL)
	if _, _, err := client.GenerateSpeech(context.Background(), "oi"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got, want := client.Name(), "test:openai/gpt-4o-mini-tts"; got != want {
		t.Fatalf("expected Name()=%q, got %q", want, got)
	}
}

// Um HTTP 200 com corpo que não é áudio (erro em JSON, página de bloqueio) deve
// falhar aqui, e não silenciosamente virar um "áudio" quebrado no WhatsApp.
func TestTTSClient_RejectsNonAudioBodyOn200(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"error":"not really audio"}`))
	}))
	defer server.Close()

	client := newTestProvider(server.URL)
	client.Models = []string{"only-model"}

	_, _, err := client.GenerateSpeech(context.Background(), "Hello world")
	if !errors.Is(err, ErrCodecConversion) {
		t.Fatalf("expected ErrCodecConversion, got %v", err)
	}
}

func TestSniffAudioMIME(t *testing.T) {
	wav := append([]byte("RIFF\x00\x00\x00\x00WAVE"), 0x00)
	cases := []struct {
		name string
		data []byte
		want string
	}{
		{"mp3 com ID3", []byte{0x49, 0x44, 0x33, 0x03}, "audio/mpeg"},
		{"mp3 ADTS", []byte{0xFF, 0xFB, 0x90}, "audio/mpeg"},
		{"wav do piper", wav, "audio/wav"},
		{"ogg", []byte("OggS\x00\x02"), "audio/ogg"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := sniffAudioMIME(tc.data)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("expected %q, got %q", tc.want, got)
			}
		})
	}
}
