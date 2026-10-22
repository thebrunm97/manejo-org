package state

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// llmRoteirizado devolve as respostas na ordem e conta as chamadas.
type llmRoteirizado struct {
	respostas []llm.RespostaAgnostica
	chamadas  int
}

func (f *llmRoteirizado) GenerateContent(ctx context.Context, req llm.ContentRequest) (llm.RespostaAgnostica, error) {
	r := f.respostas[f.chamadas]
	f.chamadas++
	return r, nil
}
func (f *llmRoteirizado) ClassifyIntent(ctx context.Context, text string) (llm.UnifiedIntentResult, string, error) {
	return llm.UnifiedIntentResult{}, "", nil
}
func (f *llmRoteirizado) AskSimple(ctx context.Context, q, s string) (string, string, error) {
	return "", "", nil
}
func (f *llmRoteirizado) DescribeImage(ctx context.Context, b []byte, m string) (string, string, error) {
	return "", "", nil
}
func (f *llmRoteirizado) ModelName() string { return "fake" }

// A lista de consultar_registros vai ao produtor sem o LLM reescrever (em
// produção ele trocou "registos" por "registros" e acrescentou frase em pt-BR).
func TestConsultaVaiDiretoSemLLM(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/caderno_campo") {
			w.Write([]byte(`[{"id":"c1","data_registro":"2026-10-19","tipo_atividade":"Compra de Insumo","produto":"adubo","quantidade_valor":2,"quantidade_unidade":"sacos"}]`))
			return
		}
		w.Write([]byte(`[{"caderno_campo_id":"c1","valor_alocado":1350}]`))
	}))
	defer srv.Close()
	sb, err := supabase.NewClient(supabase.Config{URL: srv.URL, Key: "fake"})
	if err != nil {
		t.Fatal(err)
	}

	fake := &llmRoteirizado{respostas: []llm.RespostaAgnostica{
		{ToolCalls: []llm.ChamadaFerramentaAgnostica{{ID: "1", Nome: "consultar_registros", Args: map[string]interface{}{"tipo": "compra"}}}},
		{Texto: "Você comprou 2 sacos, 3 registros. ---"},
	}}
	srvMCP := mcp.NewServer(sb, nil, nil, nil)
	srvMCP.InitializeTools()
	o := NewOrchestrator(fake, sb, srvMCP)
	o.HITL, o.BusinessEvaluator, o.OutputJudge = nil, nil, nil
	profile := &supabase.Profile{ID: "u1", PmoAtivoID: 1610, Telefone: "258841234567"}

	resp, _, _, _, _, err := o.ExecuteAgenticLoop(context.Background(), profile, "", "o que comprei?", []llm.FerramentaAgnostica{{Name: "consultar_registros"}}, nil, mcp.NewLoopGuard(5), "", "", "", RouterResult{})
	if err != nil {
		t.Fatal(err)
	}
	if fake.chamadas != 1 {
		t.Errorf("LLM chamado %d vezes; a lista devia sair sem segunda chamada", fake.chamadas)
	}
	if !strings.HasPrefix(resp, "📒 *Compras* — 1 registo\n") || !strings.Contains(resp, "1.350,00 MT") || strings.Contains(resp, "Você") {
		t.Errorf("resposta reescrita: %q", resp)
	}
}
