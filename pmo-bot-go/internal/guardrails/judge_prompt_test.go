package guardrails

import (
	"strings"
	"testing"
)

// Regressão: uma ferramenta de dados externos ao vivo (previsão do tempo) deve
// contar como fonte legítima. Antes só RAG contava, e por isso TODA resposta de
// previsão era bloqueada como ALUCINACAO_DADOS mesmo com a API real consultada.
func TestBuildJudgePrompt_ExternalToolCountsAsSource(t *testing.T) {
	prompt := buildJudgePrompt(JudgeRequest{
		UserInput:    "qual a previsão para hoje?",
		LLMOutput:    "Máxima de 29,7°C, UV 7,4.",
		Intent:       "RAG",
		ModalityFarm: "ORGANICO",
		ToolsUsed:    []string{"consultar_previsao_tempo"},
	})

	if !strings.Contains(prompt, "[FONTE_EXTERNA (alguma ferramenta de consulta foi executada)]: sim") {
		t.Errorf("ferramenta de consulta deveria marcar FONTE_EXTERNA=sim.\nPrompt:\n%s", prompt)
	}
	if !strings.Contains(prompt, "consultar_previsao_tempo") {
		t.Error("a ferramenta usada precisa aparecer no prompt")
	}
}

// Sem nenhuma ferramenta, não há fonte — o juiz deve seguir rigoroso.
func TestBuildJudgePrompt_NoToolsMeansNoSource(t *testing.T) {
	prompt := buildJudgePrompt(JudgeRequest{
		UserInput: "quanto colhi em março?",
		LLMOutput: "Você colheu 420kg.",
		Intent:    "RAG",
	})

	if !strings.Contains(prompt, "[FONTE_EXTERNA (alguma ferramenta de consulta foi executada)]: não") {
		t.Errorf("sem ferramentas, FONTE_EXTERNA deveria ser não.\nPrompt:\n%s", prompt)
	}
}

// Uma ferramenta de ESCRITA não é fonte de dados — não pode servir de álibi.
func TestBuildJudgePrompt_WriteToolIsNotASource(t *testing.T) {
	prompt := buildJudgePrompt(JudgeRequest{
		UserInput: "registra a colheita",
		LLMOutput: "Registrado. Sua média histórica é 420kg.",
		Intent:    "DATABASE",
		ToolsUsed: []string{"registrar_colheita"},
	})

	if !strings.Contains(prompt, "[FONTE_EXTERNA (alguma ferramenta de consulta foi executada)]: não") {
		t.Errorf("ferramenta de escrita não deveria marcar FONTE_EXTERNA=sim.\nPrompt:\n%s", prompt)
	}
}

// RAG continua sendo sinalizado à parte, além de contar como fonte externa.
func TestBuildJudgePrompt_RAGSetsBothSignals(t *testing.T) {
	prompt := buildJudgePrompt(JudgeRequest{
		Intent:    "RAG",
		ToolsUsed: []string{"ConsultarLeiOrganica_RAG"},
	})

	if !strings.Contains(prompt, "[FONTE_RAG (base de documentos consultada)]: sim") {
		t.Errorf("RAG deveria manter FONTE_RAG=sim.\nPrompt:\n%s", prompt)
	}
	if !strings.Contains(prompt, "[FONTE_EXTERNA (alguma ferramenta de consulta foi executada)]: sim") {
		t.Errorf("RAG também é fonte externa.\nPrompt:\n%s", prompt)
	}
}
