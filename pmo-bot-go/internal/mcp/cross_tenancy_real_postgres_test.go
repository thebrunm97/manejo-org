//go:build real_postgres

// Requer Postgres/PostgREST real — não roda em CI (DT-30). Local:
//
//	go test -tags=real_postgres ./internal/mcp/... -run RealPostgreSQL

package mcp

// DT-66: prova real de isolamento entre tenants no módulo financeiro.
//
// Os testes mais "específicos" da suíte de multitenancy nunca de fato liam
// ou escreviam um dado de um tenant e verificavam se vazava para outro:
// TestIsolation_CrossPMOWrite_ArgsInjectionIgnored monta um mapa de args com
// pmo_id=999 mas nunca chama nenhum handler, e TestRead_WithRealDB_PMOACannotSeePMOBData
// termina comparando só profileA.PmoAtivoID != profileB.PmoAtivoID — ambas
// as asserções seriam verdadeiras mesmo que o isolamento real estivesse
// quebrado. Este teste registra uma despesa de verdade sob a propriedade A,
// pelo MESMO handler de produção (handleRegistrarDespesa), e confirma —
// também pelo handler de produção (handleConsultarBalancoFinanceiro) — que
// a propriedade B não a enxerga, com um controle positivo garantindo que a
// propriedade A enxerga a própria despesa (sem isso, um teste que sempre
// retornasse zero passaria mesmo com o pipeline de escrita quebrado).
//
// Requer Postgres/PostgREST real — mesma exigência de
// internal/queue/message_buffer_real_postgres_test.go (DT-68): `supabase
// start` local (127.0.0.1:54321) com as migrations aplicadas, ou
// SUPABASE_TEST_URL/SUPABASE_TEST_SERVICE_KEY apontando para staging. Sem
// isso, FALHA na primeira chamada HTTP — não pula silenciosamente, que é
// exatamente o defeito que este débito técnico existe para corrigir.
//
// Reaproveita duas propriedades já existentes no seed local/staging (id 1 e
// 2, cada uma ligada a um pmo distinto) em vez de criar fixtures novas —
// evita lidar com a FK de propriedades.user_id para auth.users. Isola
// qualquer poluição de dados usando o ano 2099, que não deve ter nenhuma
// transação legítima em nenhum ambiente.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func testFinanceiroSupabaseConn() (url, key string) {
	url = os.Getenv("SUPABASE_TEST_URL")
	if url == "" {
		url = "http://127.0.0.1:54321"
	}
	key = os.Getenv("SUPABASE_TEST_SERVICE_KEY")
	if key == "" {
		key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
	}
	return url, key
}

const (
	dt66PropriedadeA int64 = 1
	dt66PmoA         int64 = 1
	dt66PropriedadeB int64 = 2
	dt66PmoB         int64 = 2
	dt66AnoIsolado   int  = 2099
)

func TestFinanceiroBalanco_CrossTenantIsolation_RealPostgreSQL(t *testing.T) {
	url, key := testFinanceiroSupabaseConn()

	client, err := supabase.NewClient(supabase.Config{URL: url, Key: key})
	require.NoError(t, err)

	server := &Server{supabase: client}
	ctx := context.Background()
	defer deleteDT66TestTransacoes(t, url, key)

	// UserID precisa ser um UUID de verdade — transacoes_financeiras.user_id
	// é NOT NULL REFERENCES auth.users(id), e rpc_registrar_transacao_com_rateio
	// faz (p_payload->>'user_id')::UUID, então uma string qualquer aqui
	// derruba o INSERT com "invalid input syntax for type uuid". Reaproveita
	// os user_id já ligados às propriedades 1 e 2 no seed local/staging.
	tenantA := TenantCtx{PmoID: dt66PmoA, PropriedadeID: dt66PropriedadeA, UserID: "2b070f3e-4753-4849-b4b1-aa5cef96b0d6"}
	tenantB := TenantCtx{PmoID: dt66PmoB, PropriedadeID: dt66PropriedadeB, UserID: "d91388f0-a486-424d-a614-95809c371055"}

	const valorDespesaA = 123456.78

	_, err = server.handleRegistrarDespesa(ctx, map[string]interface{}{
		"valor_total": valorDespesaA,
		"descricao":   "DT-66 isolation test fixture — seguro apagar",
		"data":        fmt.Sprintf("%d-06-15", dt66AnoIsolado),
	}, tenantA)
	require.NoError(t, err, "setup: registrar despesa da propriedade A")

	despesasB := getDespesasDoBalanco(t, ctx, server, tenantB, dt66AnoIsolado)
	assert.Equal(t, 0.0, despesasB, "propriedade B não deveria enxergar despesa registrada sob a propriedade A")

	despesasA := getDespesasDoBalanco(t, ctx, server, tenantA, dt66AnoIsolado)
	assert.Equal(t, valorDespesaA, despesasA, "propriedade A deveria enxergar a própria despesa")
}

func getDespesasDoBalanco(t *testing.T, ctx context.Context, server *Server, tenant TenantCtx, ano int) float64 {
	t.Helper()
	res, err := server.handleConsultarBalancoFinanceiro(ctx, map[string]interface{}{"ano": float64(ano)}, tenant)
	require.NoError(t, err)
	raw, ok := res.(string)
	require.True(t, ok, "handleConsultarBalancoFinanceiro deveria retornar string JSON")

	var balanco struct {
		Despesas float64 `json:"despesas"`
	}
	require.NoError(t, json.Unmarshal([]byte(raw), &balanco))
	return balanco.Despesas
}

func deleteDT66TestTransacoes(t *testing.T, url, key string) {
	t.Helper()
	reqURL := fmt.Sprintf("%s/rest/v1/transacoes_financeiras?propriedade_id=eq.%d&data_competencia=gte.%d-01-01",
		url, dt66PropriedadeA, dt66AnoIsolado)
	req, err := http.NewRequest(http.MethodDelete, reqURL, nil)
	if err != nil {
		t.Logf("aviso: falha ao montar limpeza da fixture do DT-66: %v", err)
		return
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("aviso: falha ao limpar fixture do DT-66: %v", err)
		return
	}
	defer resp.Body.Close()
}
