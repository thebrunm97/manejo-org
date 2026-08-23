package queue

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ── Mocks ─────────────────────────────────────────────────────────────────────

type fakeSender struct {
	texts     []string
	voices    int
	textErrs  []error // erro a devolver na n-ésima chamada de SendMessage
	voiceErr  error
	textCalls int
	order     []string // ordem real das chamadas ("texto"/"audio")
}

func (f *fakeSender) SendMessage(to, text string) error {
	f.textCalls++
	f.texts = append(f.texts, text)
	f.order = append(f.order, "texto")
	if len(f.textErrs) >= f.textCalls {
		return f.textErrs[f.textCalls-1]
	}
	return nil
}

func (f *fakeSender) SendVoice(to, base64Audio string, isPtt bool) error {
	f.voices++
	f.order = append(f.order, "audio")
	return f.voiceErr
}

func (f *fakeSender) SendReply(to, message, replyToMessageID string) error { return nil }
func (f *fakeSender) DownloadAudio(id string, raw []byte) ([]byte, string, error) {
	return nil, "", nil
}
func (f *fakeSender) DownloadImage(id string, raw []byte) ([]byte, string, error) {
	return nil, "", nil
}
func (f *fakeSender) SetPresence(to, presence string) error { return nil }
func (f *fakeSender) SendPresence(ctx context.Context, to, state string) error {
	return nil
}
func (f *fakeSender) SendButton(to, title, desc, footer string, btn []map[string]string) error {
	return nil
}

type fakeTTS struct {
	calls int
	err   error
}

func (f *fakeTTS) Synthesize(ctx context.Context, req ports.SynthesisRequest) (ports.AudioArtifact, error) {
	f.calls++
	if f.err != nil {
		return ports.AudioArtifact{}, f.err
	}
	return ports.AudioArtifact{Data: []byte("fake"), Format: "audio/ogg", Source: "fake"}, nil
}
func (f *fakeTTS) Name() string { return "fake" }

func fastConfig() DeliveryConfig {
	return DeliveryConfig{MaxAttempts: 3, Backoff: []time.Duration{0, 0, 0}}
}

// ── Testes ────────────────────────────────────────────────────────────────────

// O comportamento central pedido: quando a resposta é em áudio, o produtor
// recebe áudio E texto — nunca só áudio.
func TestDelivery_AudioModeSendsBothAudioAndText(t *testing.T) {
	wp := &fakeSender{}
	tts := &fakeTTS{}

	if err := sendWithConfig(context.Background(), wp, tts, "555", "bom dia", true, fastConfig()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if wp.voices != 1 {
		t.Errorf("esperava 1 áudio enviado, got %d", wp.voices)
	}
	if len(wp.texts) != 1 {
		t.Fatalf("esperava 1 texto enviado, got %d", len(wp.texts))
	}
	if wp.texts[0] != "bom dia" {
		t.Errorf("texto enviado divergente: %q", wp.texts[0])
	}
}

// O texto tem que chegar ANTES do áudio: a síntese leva dezenas de segundos e,
// invertido, o produtor ficaria sem resposta nenhuma nesse intervalo.
func TestDelivery_TextIsSentBeforeAudio(t *testing.T) {
	wp := &fakeSender{}
	tts := &fakeTTS{}

	if err := sendWithConfig(context.Background(), wp, tts, "555", "previsão", true, fastConfig()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(wp.order) != 2 {
		t.Fatalf("esperava 2 envios, got %v", wp.order)
	}
	if wp.order[0] != "texto" || wp.order[1] != "audio" {
		t.Errorf("ordem errada: got %v, want [texto audio]", wp.order)
	}
}

// Modo texto não deve gerar áudio nem chamar o TTS (custo/latência à toa).
func TestDelivery_TextModeNeverSynthesizes(t *testing.T) {
	wp := &fakeSender{}
	tts := &fakeTTS{}

	if err := sendWithConfig(context.Background(), wp, tts, "555", "oi", false, fastConfig()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tts.calls != 0 {
		t.Errorf("TTS não deveria ser chamado em modo texto, got %d chamadas", tts.calls)
	}
	if wp.voices != 0 {
		t.Errorf("não deveria enviar áudio, got %d", wp.voices)
	}
	if len(wp.texts) != 1 {
		t.Errorf("esperava 1 texto, got %d", len(wp.texts))
	}
}

// Falha de TTS degrada a experiência, não a entrega: o texto ainda chega.
func TestDelivery_TTSFailureStillDeliversText(t *testing.T) {
	wp := &fakeSender{}
	tts := &fakeTTS{err: errors.New("piper fora do ar")}

	if err := sendWithConfig(context.Background(), wp, tts, "555", "previsão", true, fastConfig()); err != nil {
		t.Fatalf("falha de TTS não deveria falhar a entrega, got %v", err)
	}

	if wp.voices != 0 {
		t.Errorf("não deveria ter enviado áudio, got %d", wp.voices)
	}
	if len(wp.texts) != 1 {
		t.Errorf("esperava o texto mesmo assim, got %d", len(wp.texts))
	}
}

// Regressão: se o texto falhar e for reenviado, o áudio NÃO pode ser reenviado
// junto — senão o produtor ouve a mesma resposta várias vezes.
func TestDelivery_AudioIsNotResentOnTextRetry(t *testing.T) {
	wp := &fakeSender{textErrs: []error{errors.New("timeout"), errors.New("timeout")}}
	tts := &fakeTTS{}

	if err := sendWithConfig(context.Background(), wp, tts, "555", "oi", true, fastConfig()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if wp.voices != 1 {
		t.Errorf("áudio deveria ser enviado exatamente 1x apesar dos retries, got %d", wp.voices)
	}
	if tts.calls != 1 {
		t.Errorf("TTS deveria ser chamado exatamente 1x, got %d", tts.calls)
	}
	if wp.textCalls != 3 {
		t.Errorf("esperava 3 tentativas de texto, got %d", wp.textCalls)
	}
}

// Um TTSProvider nil é contrato válido ("TTS desativado") e não deve quebrar.
func TestDelivery_NilTTSProviderFallsBackToTextOnly(t *testing.T) {
	wp := &fakeSender{}

	if err := sendWithConfig(context.Background(), wp, nil, "555", "oi", true, fastConfig()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if wp.voices != 0 {
		t.Errorf("não deveria enviar áudio sem provider, got %d", wp.voices)
	}
	if len(wp.texts) != 1 {
		t.Errorf("esperava 1 texto, got %d", len(wp.texts))
	}
}
