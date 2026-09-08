package groq

// audio_adapter_test.go — Fase 4: Verificação do parser de mimeType do AudioTranscriberAdapter
//
// Cobertura:
//  1. Compile-time: adapter satisfaz ports.AudioTranscriber
//  2. Parser mimeType: "audio/ogg; codecs=opus" → FileName "audio.ogg"
//  3. Parser mimeType: "audio/mp4"              → FileName "audio.mp4"
//  4. Parser mimeType: ""                       → FileName "audio.ogg" (default)
//  5. Parser mimeType: formato atípico sem "audio/" → FileName "audio.ogg" (default)
//
// Nota: Estes testes usam um stub do *Client interno para evitar dependência de API real.

import (
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ─── compilação ──────────────────────────────────────────────────────────────

var _ ports.AudioTranscriber = (*AudioTranscriberAdapter)(nil)

// ─── testes do parser de mimeType ────────────────────────────────────────────

func TestDeriveFileName_WithCodecs(t *testing.T) {
	t.Parallel()
	// Formato mais comum do WhatsApp: OGG com codec Opus
	got := DeriveFileName("audio/ogg; codecs=opus")
	want := "audio.ogg"
	if got != want {
		t.Errorf("DeriveFileName(%q) = %q, quero %q", "audio/ogg; codecs=opus", got, want)
	}
}

func TestDeriveFileName_WithoutCodecs(t *testing.T) {
	t.Parallel()
	// Formato simples sem parâmetros adicionais
	got := DeriveFileName("audio/mp4")
	want := "audio.mp4"
	if got != want {
		t.Errorf("DeriveFileName(%q) = %q, quero %q", "audio/mp4", got, want)
	}
}

func TestDeriveFileName_EmptyMimeType(t *testing.T) {
	t.Parallel()
	// String vazia → default ogg (path do handler legado com TODO pendente)
	got := DeriveFileName("")
	want := "audio.ogg"
	if got != want {
		t.Errorf("DeriveFileName(%q) = %q, quero %q", "", got, want)
	}
}

func TestDeriveFileName_AtypicalFormat_NoAudioPrefix(t *testing.T) {
	t.Parallel()
	// Formato que não bate com "audio/" → default ogg (não pânica, não altera comportamento)
	got := DeriveFileName("application/octet-stream")
	want := "audio.ogg"
	if got != want {
		t.Errorf("DeriveFileName(%q) = %q, quero %q", "application/octet-stream", got, want)
	}
}

func TestDeriveFileName_WithSpaceBeforeSemicolon(t *testing.T) {
	t.Parallel()
	// Variação defensiva: espaço antes do ponto-e-vírgula
	// ex: "audio/ogg ;codecs=opus"
	// Isso garante que não temos um bug de string malformada como "audio.ogg "
	got := DeriveFileName("audio/ogg ;codecs=opus")
	want := "audio.ogg"
	if got != want {
		t.Errorf("DeriveFileName(%q) = %q, quero %q", "audio/ogg ;codecs=opus", got, want)
	}
}

func TestNewAudioTranscriberAdapter_DefaultLanguage(t *testing.T) {
	t.Parallel()
	// Verifica que language vazia é substituída por "pt" no construtor
	adapter := NewAudioTranscriberAdapter(nil, "")
	if adapter.language != "pt" {
		t.Errorf("language padrão esperada 'pt', got %q", adapter.language)
	}
}

func TestNewAudioTranscriberAdapter_ExplicitLanguage(t *testing.T) {
	t.Parallel()
	// Verifica que language explícita é preservada
	adapter := NewAudioTranscriberAdapter(nil, "en")
	if adapter.language != "en" {
		t.Errorf("language esperada 'en', got %q", adapter.language)
	}
}
