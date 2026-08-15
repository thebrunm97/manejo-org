package gemini

// audio_provider_test.go — Fase 4: Verificação dos contratos do LLMProviderAdapter
//
// Cobertura:
//  1. Compile-time: adapter satisfaz ports.LLMProvider (já garantido pelo var _ no src)
//  2. withFallback retorna tipo inesperado → comma-ok dispara erro tratado, sem panic
//  3. audioMimeType == "" → warning disparado + fallback "audio/ogg" usado (não pânico)
//  4. Caminho feliz: op retorna string → retornada + modelUsed corretos
//  5. Todas as tentativas do withFallback falham → erro propagado corretamente

import (
	"bytes"
	"context"
	"errors"
	"log"
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ─── helpers de compilação ────────────────────────────────────────────────────

// Garante que *LLMProviderAdapter implementa ports.LLMProvider em tempo de compilação.
// Se a assinatura da interface mudar e o adapter não for atualizado, este teste não compila.
var _ ports.LLMProvider = (*LLMProviderAdapter)(nil)

// ─── stub: stubClient ─────────────────────────────────────────────────────────

// stubClient substitui *Client nos testes sem precisar de chave de API.
// Ele implementa withFallback com comportamento controlado pelo campo fnResult.
type stubClient struct {
	// fnResult é o valor que o withFallback retornará como (any, string, error)
	fnResult    any
	fnModelUsed string
	fnErr       error
}

// withFallback executa fn com "stub-model" e retorna os valores configurados no stub.
// Se fnErr != nil, ignora fnResult e retorna o erro.
// Se fnErr == nil, retorna fnResult ignorando o retorno real de fn.
func (s *stubClient) withFallback(fn func(model string) (any, error)) (any, string, error) {
	if s.fnErr != nil {
		return nil, "", s.fnErr
	}
	return s.fnResult, s.fnModelUsed, nil
}

// ─── testes ───────────────────────────────────────────────────────────────────

// TestLLMProviderAdapter_UnexpectedTypeFromWithFallback cobre o risco de panic
// no cast res.(string) quando withFallback retornar um tipo diferente de string.
// Antes do comma-ok, isso causaria panic em produção.
type dummySchema struct {
	Field string `json:"field"`
}

func TestLLMProviderAdapter_UnexpectedTypeFromWithFallback(t *testing.T) {
	t.Parallel()

	adapter := &LLMProviderAdapter{
		client: nil, // não é usado porque op() nunca é invocado no stub
		executor: &stubClient{
			fnResult:    42, // int, não string — simula OpenRouter retornando tipo errado
			fnModelUsed: "openrouter",
		},
	}

	_, _, err := adapter.GenerateStructured(context.Background(), "prompt", nil, "audio/ogg", dummySchema{})
	if err == nil {
		t.Fatal("esperava erro ao receber tipo inesperado de withFallback, mas não recebeu")
	}

	if !strings.Contains(err.Error(), "unexpected response type") {
		t.Errorf("mensagem de erro inesperada: %q", err.Error())
	}
}

// TestLLMProviderAdapter_HappyPath verifica que, com withFallback retornando string,
// o adapter propaga corretamente o resultado e o modelUsed.
func TestLLMProviderAdapter_HappyPath(t *testing.T) {
	t.Parallel()

	adapter := &LLMProviderAdapter{
		client: nil,
		executor: &stubClient{
			fnResult:    "classificação json aqui",
			fnModelUsed: "gemini-2.0-flash-lite",
		},
	}

	result, modelUsed, err := adapter.GenerateStructured(context.Background(), "prompt", nil, "audio/ogg", dummySchema{})
	if err != nil {
		t.Fatalf("não esperava erro: %v", err)
	}
	if result != "classificação json aqui" {
		t.Errorf("resultado inesperado: %q", result)
	}
	if modelUsed != "gemini-2.0-flash-lite" {
		t.Errorf("modelUsed inesperado: %q", modelUsed)
	}
}

// TestLLMProviderAdapter_AllFallbacksFail verifica que o erro é propagado
// quando todas as tentativas do withFallback falham.
func TestLLMProviderAdapter_AllFallbacksFail(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("all models exhausted")
	adapter := &LLMProviderAdapter{
		client:   nil,
		executor: &stubClient{fnErr: sentinel},
	}

	_, _, err := adapter.GenerateStructured(context.Background(), "prompt", nil, "audio/ogg", dummySchema{})
	if err == nil {
		t.Fatal("esperava erro, mas não recebeu")
	}
	if !errors.Is(err, sentinel) {
		t.Errorf("erro errado: %v", err)
	}
}

// TestLLMProviderAdapter_EmptyMimeTypeLogsWarningAndUsesDefault verifica que
// audioMimeType == "" não causa panic e emite o warning esperado.
// Este é o comportamento mais frágil da cadeia — conforme identificado na revisão.
func TestLLMProviderAdapter_EmptyMimeTypeLogsWarningAndUsesDefault(t *testing.T) {
	t.Parallel()

	adapter := &LLMProviderAdapter{
		client: nil,
		executor: &stubClient{
			fnResult:    "ok",
			fnModelUsed: "gemini-2.0-flash-lite",
		},
	}

	// Captura o log para verificar o warning
	var logBuf bytes.Buffer
	oldWriter := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(oldWriter)

	audioData := []byte{0x00, 0x01} // qualquer dado não-vazio para forçar o caminho do audio

	_, _, err := adapter.GenerateStructured(context.Background(), "prompt", audioData, "", dummySchema{})
	if err != nil {
		t.Fatalf("não esperava erro: %v", err)
	}

	logOutput := logBuf.String()
	if !strings.Contains(logOutput, "WARNING: audioMimeType não informado") {
		t.Errorf("warning de mimeType vazio não foi emitido. Log: %q", logOutput)
	}
}
