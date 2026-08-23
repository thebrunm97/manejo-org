package queue

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// supabaseFake simula o PostgREST: responde a consulta de presos com os jobs
// dados e grava os PATCH recebidos, para o teste inspecionar o que o reaper
// decidiu fazer com cada um.
type supabaseFake struct {
	presos    []stuckJob
	updates   map[string]map[string]interface{}
	queryURLs []string
}

func novoFake(presos ...stuckJob) *supabaseFake {
	return &supabaseFake{presos: presos, updates: map[string]map[string]interface{}{}}
}

func (f *supabaseFake) servidor(t *testing.T) (*httptest.Server, *StuckJobReaper) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			f.queryURLs = append(f.queryURLs, r.URL.String())
			_ = json.NewEncoder(w).Encode(f.presos)
		case http.MethodPatch:
			id := strings.TrimPrefix(r.URL.Query().Get("id"), "eq.")
			body, _ := io.ReadAll(r.Body)
			var campos map[string]interface{}
			_ = json.Unmarshal(body, &campos)
			f.updates[id] = campos
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Errorf("metodo inesperado: %s", r.Method)
		}
	}))
	t.Cleanup(srv.Close)

	reaper := NewStuckJobReaper(NewManager(srv.URL, "chave-de-teste"), time.Minute, 15*time.Minute)
	return srv, reaper
}

// Um job de IA preso precisa voltar para `ai_pending`, NAO para `pending`.
// Voltar para pending o faria reprocessar desde a transcricao, refazendo
// trabalho ja feito e gastando cota da Groq de novo.
func TestReaper_JobDeIAVoltaParaAIPending(t *testing.T) {
	f := novoFake(stuckJob{ID: "job-ia", Status: "ai_processing", AttemptCount: 0, MaxAttempts: 3})
	_, reaper := f.servidor(t)

	recuperados, mortos, err := reaper.ReapOnce(context.Background(), time.Now().UTC())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if recuperados != 1 || mortos != 0 {
		t.Fatalf("recuperados=%d mortos=%d, queria 1 e 0", recuperados, mortos)
	}

	up := f.updates["job-ia"]
	if up["status"] != "ai_pending" {
		t.Errorf("status = %v, queria ai_pending", up["status"])
	}
	if up["attempt_count"] != float64(1) {
		t.Errorf("attempt_count = %v, queria 1", up["attempt_count"])
	}
	if up["processed_at"] != nil {
		t.Errorf("processed_at deveria ser limpo, veio %v", up["processed_at"])
	}
}

func TestReaper_JobDeMidiaVoltaParaPending(t *testing.T) {
	f := novoFake(stuckJob{ID: "job-midia", Status: "processing", AttemptCount: 1, MaxAttempts: 3})
	_, reaper := f.servidor(t)

	if _, _, err := reaper.ReapOnce(context.Background(), time.Now().UTC()); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if got := f.updates["job-midia"]["status"]; got != "pending" {
		t.Errorf("status = %v, queria pending", got)
	}
}

// O laco de crash e o risco real do reaper: um job que derruba o worker seria
// reivindicado, derrubaria de novo, e voltaria para sempre. Ao esgotar as
// tentativas ele precisa ir para dead letter.
func TestReaper_NaoCriaLacoDeCrash(t *testing.T) {
	f := novoFake(stuckJob{ID: "job-veneno", Status: "ai_processing", AttemptCount: 2, MaxAttempts: 3})
	_, reaper := f.servidor(t)

	recuperados, mortos, err := reaper.ReapOnce(context.Background(), time.Now().UTC())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if recuperados != 0 || mortos != 1 {
		t.Fatalf("recuperados=%d mortos=%d, queria 0 e 1", recuperados, mortos)
	}

	up := f.updates["job-veneno"]
	if up["status"] != "failed" {
		t.Errorf("status = %v, queria failed", up["status"])
	}
	if msg, _ := up["error_msg"].(string); !strings.Contains(msg, "reaper") {
		t.Errorf("error_msg deveria identificar o reaper como origem, veio %q", msg)
	}
}

// Status de processamento desconhecido nao deve ser adivinhado: mexer no estado
// errado da fila e pior que deixar o job parado e visivel.
func TestReaper_IgnoraStatusDesconhecido(t *testing.T) {
	f := novoFake(stuckJob{ID: "job-estranho", Status: "status_que_nao_existe", AttemptCount: 0, MaxAttempts: 3})
	_, reaper := f.servidor(t)

	recuperados, mortos, err := reaper.ReapOnce(context.Background(), time.Now().UTC())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if recuperados != 0 || mortos != 0 {
		t.Errorf("recuperados=%d mortos=%d, queria 0 e 0", recuperados, mortos)
	}
	if len(f.updates) != 0 {
		t.Errorf("nao deveria ter alterado nada, alterou: %v", f.updates)
	}
}

// A consulta precisa filtrar por tempo E incluir claimed_at nulo: estar em
// processamento sem registro de quando foi reivindicado ja e inconsistencia.
func TestReaper_ConsultaFiltraPorCorteEIncluiNulos(t *testing.T) {
	f := novoFake()
	_, reaper := f.servidor(t)

	agora := time.Date(2026, 8, 23, 12, 0, 0, 0, time.UTC)
	if _, _, err := reaper.ReapOnce(context.Background(), agora); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if len(f.queryURLs) != 1 {
		t.Fatalf("esperava 1 consulta, veio %d", len(f.queryURLs))
	}
	q := f.queryURLs[0]

	for _, esperado := range []string{"status=in.", "processing", "ai_processing", "claimed_at.is.null"} {
		if !strings.Contains(q, esperado) {
			t.Errorf("consulta nao contem %q: %s", esperado, q)
		}
	}
	// 12:00 menos 15 minutos = 11:45
	if !strings.Contains(q, "11%3A45") && !strings.Contains(q, "11:45") {
		t.Errorf("consulta deveria cortar em 11:45 (agora - stuckAfter), veio: %s", q)
	}
}

// A decisao de dead letter segue IsDeadLetter (a mesma do MarkFailed), e NAO a
// coluna max_attempts. Um job com max_attempts zerado no banco nao pode ser
// descartado na primeira varredura — seria perder um job nunca tentado.
func TestReaper_UsaAMesmaRegraDeDeadLetterDoMarkFailed(t *testing.T) {
	f := novoFake(stuckJob{ID: "job-sem-max", Status: "ai_processing", AttemptCount: 0, MaxAttempts: 0})
	_, reaper := f.servidor(t)

	recuperados, mortos, err := reaper.ReapOnce(context.Background(), time.Now().UTC())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if recuperados != 1 || mortos != 0 {
		t.Errorf("recuperados=%d mortos=%d, queria 1 e 0 (MaxRetryAttempts=%d)", recuperados, mortos, MaxRetryAttempts)
	}
}
