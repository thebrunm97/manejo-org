package gemini

import (
	"context"
	"errors"
	"testing"
	"time"

	"google.golang.org/genai"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

// assembleFromStream é o coração do DT-41-STREAM: monta a resposta a partir
// dos chunks e decide quando um stall (sem primeiro token a tempo) deve
// escalar de imediato. Testado aqui contra um channel alimentado à mão, sem
// precisar de um *genai.Client real — a mesma limitação honesta já registrada
// em fallback_simulation_test.go (não há interface para mockar c.Client).

func chunkComTexto(texto string) streamChunk {
	return streamChunk{
		resp: &genai.GenerateContentResponse{
			ModelVersion: "gemini-test",
			Candidates: []*genai.Candidate{
				{Content: &genai.Content{Parts: []*genai.Part{{Text: texto}}}},
			},
		},
	}
}

func TestAssembleFromStream_MontaTextoIncrementalmente(t *testing.T) {
	chunks := make(chan streamChunk, 4)
	chunks <- chunkComTexto("Olá, ")
	chunks <- chunkComTexto("produtor!")
	close(chunks)

	resp, ttft, err := assembleFromStream(chunks, func() {}, time.Second, "gemini-test")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.Texto != "Olá, produtor!" {
		t.Errorf("Texto = %q, want %q", resp.Texto, "Olá, produtor!")
	}
	if ttft < 0 {
		t.Errorf("ttft não deveria ser negativo quando chunks chegaram: %v", ttft)
	}
	if resp.Provider != "google" {
		t.Errorf("Provider = %q, want google", resp.Provider)
	}
}

func TestAssembleFromStream_AcumulaToolCalls(t *testing.T) {
	chunks := make(chan streamChunk, 2)
	chunks <- streamChunk{resp: &genai.GenerateContentResponse{
		Candidates: []*genai.Candidate{{Content: &genai.Content{Parts: []*genai.Part{
			{FunctionCall: &genai.FunctionCall{Name: "registrar_colheita", Args: map[string]any{"qtd": 10}}},
		}}}},
	}}
	close(chunks)

	resp, _, err := assembleFromStream(chunks, func() {}, time.Second, "gemini-test")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if len(resp.ToolCalls) != 1 || resp.ToolCalls[0].Nome != "registrar_colheita" {
		t.Errorf("ToolCalls = %+v, esperava 1 chamada a registrar_colheita", resp.ToolCalls)
	}
}

// Regressão central do DT-41-STREAM: se nenhum chunk chega dentro do
// ttftTimeout, deve escalar como stall (erro que embrulha
// context.DeadlineExceeded, o mesmo contrato que isStallError já reconhece) —
// SEM esperar o attemptTimeout inteiro (25s) como antes da migração.
func TestAssembleFromStream_StallQuandoNenhumChunkChegaATempo(t *testing.T) {
	chunks := make(chan streamChunk) // nunca recebe nada
	cancelChamado := false
	cancel := func() { cancelChamado = true }

	start := time.Now()
	_, ttft, err := assembleFromStream(chunks, cancel, 30*time.Millisecond, "gemini-test")
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("esperava erro de stall, veio nil")
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("erro de stall deveria embrulhar context.DeadlineExceeded (contrato do isStallError), veio: %v", err)
	}
	if !isStallError(err) {
		t.Errorf("isStallError(%v) = false, want true — senão withFallback não escala de imediato", err)
	}
	if ttft != -1 {
		t.Errorf("ttft em stall deveria ser -1, veio %v", ttft)
	}
	if !cancelChamado {
		t.Error("cancelStream deveria ter sido chamado no stall, para abortar a chamada real ao provider")
	}
	// Não é uma prova formal de tempo, mas confirma que não ficamos presos
	// pelo attemptTimeout inteiro (25s) — o objetivo central do DT-41-STREAM.
	if elapsed > 500*time.Millisecond {
		t.Errorf("stall detectado tarde demais: %v (esperava próximo de 30ms)", elapsed)
	}
}

// Um chunk de erro no meio do stream (conexão caiu depois do primeiro token)
// deve propagar o erro original, preservando o ttft observado até ali — é
// informação útil mesmo quando a chamada termina em erro.
func TestAssembleFromStream_ErroNoMeioDoStreamPreservaTTFT(t *testing.T) {
	chunks := make(chan streamChunk, 2)
	chunks <- chunkComTexto("Processando")
	erroSimulado := errors.New("stream fechado pelo servidor")
	chunks <- streamChunk{err: erroSimulado}
	close(chunks)

	_, ttft, err := assembleFromStream(chunks, func() {}, time.Second, "gemini-test")
	if !errors.Is(err, erroSimulado) {
		t.Errorf("erro = %v, want %v", err, erroSimulado)
	}
	if ttft < 0 {
		t.Error("ttft deveria refletir que o primeiro chunk chegou, mesmo com erro depois")
	}
}

// Canal fechado sem nenhum erro explícito (stream terminou normalmente) não é
// stall nem erro — só significa "acabou".
func TestAssembleFromStream_CanalFechadoSemErroTerminaLimpo(t *testing.T) {
	chunks := make(chan streamChunk, 1)
	chunks <- chunkComTexto("ok")
	close(chunks)

	resp, _, err := assembleFromStream(chunks, func() {}, time.Second, "gemini-test")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.Texto != "ok" {
		t.Errorf("Texto = %q, want %q", resp.Texto, "ok")
	}
}

// mergeStreamResponse não deve pisar em Model/Usage com valores vazios de um
// chunk posterior — só o último chunk que TRAZ o dado deve prevalecer.
func TestMergeStreamResponse_NaoSobrescreveComValorVazio(t *testing.T) {
	resp := &llm.RespostaAgnostica{Model: "gemini-2.5-flash"}

	mergeStreamResponse(resp, &genai.GenerateContentResponse{
		ModelVersion: "", // chunk sem essa info — não deve apagar o que já tinha
		Candidates: []*genai.Candidate{
			{Content: &genai.Content{Parts: []*genai.Part{{Text: "continua"}}}},
		},
	})

	if resp.Model != "gemini-2.5-flash" {
		t.Errorf("Model = %q, não deveria ter sido sobrescrito por chunk vazio", resp.Model)
	}
	if resp.Texto != "continua" {
		t.Errorf("Texto = %q, want %q", resp.Texto, "continua")
	}
}
