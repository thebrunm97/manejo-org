package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// mockLLMProvider satisfies llm.LLMProvider for unit testing.
type mockLLMProvider struct {
	llm.LLMProvider // embed to avoid implementing every other method
	evalResult      llm.MetaRAGResult
	evalErr         error
}

func (m *mockLLMProvider) EvaluateEvidenceListwise(ctx context.Context, query string, chunks []string) (llm.MetaRAGResult, error) {
	return m.evalResult, m.evalErr
}

func (m *mockLLMProvider) Embedder() llm.Embedder {
	return nil
}

type mockEmbedder struct{}

func (m *mockEmbedder) GenerateEmbedding(text string) ([]float32, error) { return []float32{0.1}, nil }
func (m *mockEmbedder) GenerateQueryEmbedding(query string) ([]float32, error) {
	return []float32{0.1}, nil
}

func TestMetaRAGFiltering(t *testing.T) {
	// 1. Setup mock Supabase server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock match_farm_documents RPC response
		if strings.Contains(r.URL.Path, "match_documents_with_context") {
			matches := []supabase.DocumentMatchContext{
				{
					ID:               1,
					SourceDocumentID: "uuid-doc1",
					DocumentName:     "doc1.pdf",
					Content:          "Conteúdo da evidência forte.",
					Similarity:       0.8,
					IsGlobal:         true,
					Metadata:         map[string]interface{}{"categoria_fonte": "geral"},
				},
				{
					ID:               2,
					SourceDocumentID: "uuid-doc2",
					DocumentName:     "doc2.pdf",
					Content:          "Conteúdo da evidência fraca/extrapolada.",
					Similarity:       0.7,
					IsGlobal:         true,
					Metadata:         map[string]interface{}{"categoria_fonte": "geral"},
				},
				{
					ID:               3,
					SourceDocumentID: "uuid-doc3",
					DocumentName:     "doc3.pdf",
					Content:          "Conteúdo irrelevante ou lixo.",
					Similarity:       0.6,
					IsGlobal:         false,
					Metadata:         map[string]interface{}{"categoria_fonte": "geral"},
				},
			}
			json.NewEncoder(w).Encode(matches)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	sbClient, err := supabase.NewClient(supabase.Config{URL: ts.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("failed to create supabase client: %v", err)
	}

	// 2. Configure Mock LLM
	mockLLM := &mockLLMProvider{
		evalResult: llm.MetaRAGResult{
			Evaluations: []llm.EvidenceEvaluation{
				{ChunkIndex: 0, Score: 5, Reasoning: "Match perfeito de Cultura e Manejo."},
				{ChunkIndex: 1, Score: 3, Reasoning: "Manejo coincide, mas para cultura diferente."},
				{ChunkIndex: 2, Score: 1, Reasoning: "Assunto completamente desalinhado."},
			},
		},
	}

	agriRepo := ports.NewMockAgriculturalRepository[OperacaoLoteItem]()
	server := NewServer(sbClient, agriRepo, &mockEmbedder{}, mockLLM)

	// 3. Call handleConsultarBaseConhecimento
	args := map[string]interface{}{
		"pmo_id":   float64(6),
		"pergunta": "Como plantar milho orgânico?",
	}

	mockProfile := &supabase.Profile{PmoAtivoID: 6, ID: "test-user"}
	tenant, err := buildTenantCtx(mockProfile)
	if err != nil {
		t.Fatalf("buildTenantCtx failed: %v", err)
	}
	res, err := server.handleConsultarBaseConhecimento(context.Background(), args, tenant)
	if err != nil {
		t.Fatalf("handleConsultarBaseConhecimento failed: %v", err)
	}

	resStr, ok := res.(string)
	if !ok {
		t.Fatalf("expected string response, got %T", res)
	}

	// 4. Assertions
	// Chunk 0 (Score 5) must be present and unmodified
	if !strings.Contains(resStr, "Conteúdo da evidência forte.") {
		t.Errorf("Expected chunk 0 to be present")
	}
	if strings.Contains(resStr, "[ALERTA DE EXTRAPOLAÇÃO: O Juiz Agronômico avaliou esta evidência com nota 5") {
		t.Errorf("Chunk 0 should not have extrapolation alert")
	}

	// Chunk 1 (Score 3) must be present and contain extrapolation alert
	if !strings.Contains(resStr, "Conteúdo da evidência fraca/extrapolada.") {
		t.Errorf("Expected chunk 1 to be present")
	}
	expectedAlert := "[ALERTA DE EXTRAPOLAÇÃO: O Juiz Agronômico avaliou esta evidência com nota 3. Motivo: Manejo coincide, mas para cultura diferente. Adicione um aviso no início da sua resposta final para que o produtor não aplique essa técnica de forma cega]"
	if !strings.Contains(resStr, expectedAlert) {
		t.Errorf("Expected extrapolation alert on chunk 1. Got: %s", resStr)
	}

	// Chunk 2 (Score 1) must be completely excluded
	if strings.Contains(resStr, "Conteúdo irrelevante ou lixo.") {
		t.Errorf("Chunk 2 (Score 1) should have been excluded from the results")
	}
}

func TestMetaRAGFailOpen(t *testing.T) {
	// 1. Setup mock Supabase server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "match_documents_with_context") {
			matches := []supabase.DocumentMatchContext{
				{
					ID:               1,
					SourceDocumentID: "uuid-doc1",
					DocumentName:     "doc1.pdf",
					Content:          "Conteúdo original.",
					Similarity:       0.8,
					IsGlobal:         true,
					Metadata:         map[string]interface{}{"categoria_fonte": "geral"},
				},
			}
			json.NewEncoder(w).Encode(matches)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer ts.Close()

	sbClient, err := supabase.NewClient(supabase.Config{URL: ts.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("failed to create supabase client: %v", err)
	}

	// 2. Configure Mock LLM that returns error (simulates timeout/API down)
	mockLLM := &mockLLMProvider{
		evalErr: fmt.Errorf("gemini API rate limit exceeded"),
	}

	agriRepo := ports.NewMockAgriculturalRepository[OperacaoLoteItem]()
	server := NewServer(sbClient, agriRepo, &mockEmbedder{}, mockLLM)

	args := map[string]interface{}{
		"pmo_id":   float64(6),
		"pergunta": "Como plantar milho orgânico?",
	}

	mockProfile := &supabase.Profile{PmoAtivoID: 6, ID: "test-user"}
	tenant, err := buildTenantCtx(mockProfile)
	if err != nil {
		t.Fatalf("buildTenantCtx failed: %v", err)
	}
	res, err := server.handleConsultarBaseConhecimento(context.Background(), args, tenant)
	if err != nil {
		t.Fatalf("handleConsultarBaseConhecimento failed on fail-open: %v", err)
	}

	resStr, ok := res.(string)
	if !ok {
		t.Fatalf("expected string response, got %T", res)
	}

	// Assert: Fail-open allows the original chunk to pass without warnings
	if !strings.Contains(resStr, "Conteúdo original.") {
		t.Errorf("Expected original content to be present in fail-open mode")
	}
	if strings.Contains(resStr, "[ALERTA DE EXTRAPOLAÇÃO") {
		t.Errorf("No alerts should be injected in fail-open mode")
	}
}
