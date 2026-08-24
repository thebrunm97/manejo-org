package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/middleware"
)

// fakePostgREST grava a requisição que recebeu, para os testes verificarem
// que o Authorization encaminhado é o do produtor, não uma chave fixa.
type fakePostgREST struct {
	srv           *httptest.Server
	recebidoAuth  string
	recebidoApiKey string
	recebidoPath  string
	recebidoBody  string
	respostaCode  int
	respostaBody  string
}

func novoFakePostgREST(t *testing.T) *fakePostgREST {
	t.Helper()
	f := &fakePostgREST{respostaCode: http.StatusOK, respostaBody: `{"id":1}`}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.recebidoAuth = r.Header.Get("Authorization")
		f.recebidoApiKey = r.Header.Get("apikey")
		f.recebidoPath = r.URL.Path
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		f.recebidoBody = string(buf)
		w.WriteHeader(f.respostaCode)
		_, _ = w.Write([]byte(f.respostaBody))
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func rotear(t *testing.T, h *Handler, autenticado bool, userID string) *httptest.Server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if autenticado {
			c.Set(middleware.ContextUserID, userID)
			c.Set(middleware.ContextRawToken, "token-do-produtor-"+userID)
		}
		c.Next()
	})
	rg := r.Group("/api/v1")
	h.RegisterRoutes(rg)
	return httptest.NewServer(r)
}

func TestRPCForaDoAllowlistDaQuatroZeroQuatro(t *testing.T) {
	fake := novoFakePostgREST(t)
	h := NewHandler(fake.srv.URL, "chave-do-projeto")
	srv := rotear(t, h, true, "user-1")
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/rpc/drop_todas_as_tabelas", "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatalf("request falhou: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("RPC fora do allowlist deveria dar 404, deu %d", resp.StatusCode)
	}
	if fake.recebidoPath != "" {
		t.Error("nenhuma requisição deveria ter chegado ao PostgREST para uma RPC fora do allowlist")
	}
}

func TestRPCPermitidaEncaminhaTokenDoProdutorNaoChaveDeServico(t *testing.T) {
	fake := novoFakePostgREST(t)
	h := NewHandler(fake.srv.URL, "chave-do-projeto")
	srv := rotear(t, h, true, "produtor-123")
	defer srv.Close()

	corpo := `{"p_payload":{"nome":"Talhão Novo"}}`
	resp, err := http.Post(srv.URL+"/api/v1/rpc/create_talhao", "application/json", strings.NewReader(corpo))
	if err != nil {
		t.Fatalf("request falhou: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("RPC permitida deveria passar, deu %d", resp.StatusCode)
	}
	if fake.recebidoPath != "/rest/v1/rpc/create_talhao" {
		t.Errorf("path encaminhado errado: %q", fake.recebidoPath)
	}
	if fake.recebidoAuth != "Bearer token-do-produtor-produtor-123" {
		t.Errorf("deveria encaminhar o token do PRODUTOR, encaminhou %q", fake.recebidoAuth)
	}
	if fake.recebidoApiKey != "chave-do-projeto" {
		t.Errorf("apikey do gateway errada: %q", fake.recebidoApiKey)
	}
	if fake.recebidoBody != corpo {
		t.Errorf("corpo não foi encaminhado intacto: %q != %q", fake.recebidoBody, corpo)
	}
}

func TestSemAutenticacaoRecusaAntesDeChamarOBanco(t *testing.T) {
	fake := novoFakePostgREST(t)
	h := NewHandler(fake.srv.URL, "chave-do-projeto")
	srv := rotear(t, h, false, "")
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/rpc/create_talhao", "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatalf("request falhou: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("sem autenticação deveria dar 401, deu %d", resp.StatusCode)
	}
	if fake.recebidoPath != "" {
		t.Error("nenhuma requisição deveria ter chegado ao PostgREST sem autenticação")
	}
}

// Um erro de negócio (ex: "Propriedade inválida ou não pertence ao usuário")
// devolvido pela RPC precisa chegar ao frontend com o MESMO status e corpo
// que o PostgREST usa — é o contrato que os services do frontend já esperam.
func TestStatusEErroDaRPCSaoRepassadosIntactos(t *testing.T) {
	fake := novoFakePostgREST(t)
	fake.respostaCode = http.StatusBadRequest
	fake.respostaBody = `{"message":"Propriedade inválida ou não pertence ao usuário"}`
	h := NewHandler(fake.srv.URL, "chave-do-projeto")
	srv := rotear(t, h, true, "user-1")
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/api/v1/rpc/create_talhao", "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatalf("request falhou: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status da RPC deveria ser repassado, veio %d", resp.StatusCode)
	}
}
