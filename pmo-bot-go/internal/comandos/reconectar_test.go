package comandos

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type fakeRecon struct {
	conectou  bool
	codigo    string
	errPair   error
	pediuPara string
}

func (f *fakeRecon) Conectar(ctx context.Context) error {
	f.conectou = true
	return nil
}

func (f *fakeRecon) PedirCodigoPareamento(ctx context.Context, telefone string) (string, error) {
	f.pediuPara = telefone
	return f.codigo, f.errPair
}

type fakeResp struct {
	ch chan string
}

func (f *fakeResp) EnviarTexto(ctx context.Context, texto string) error {
	f.ch <- texto
	return nil
}

const (
	segredoTeste = "segredo-teste"
	chatTeste    = "123456"
)

func montarRouter(h *ReconectarHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/telegram/webhook", h.Handle)
	return r
}

func requisicao(body, segredo string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/telegram/webhook", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if segredo != "" {
		req.Header.Set("X-Telegram-Bot-Api-Secret-Token", segredo)
	}
	return req
}

func updateComTexto(chatID, texto string) string {
	return `{"message":{"text":"` + texto + `","chat":{"id":` + chatID + `}}}`
}

func TestRejeitaSegredoErrado(t *testing.T) {
	rec := &fakeRecon{}
	resp := &fakeResp{ch: make(chan string, 10)}
	h := NewReconectarHandler(segredoTeste, chatTeste, rec, resp)
	r := montarRouter(h)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, requisicao(updateComTexto(chatTeste, "/reconectar 5534997202727"), "errado"))

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, queria 401", w.Code)
	}
	if rec.conectou || rec.pediuPara != "" {
		t.Fatal("update sem segredo válido não deveria disparar o pareamento")
	}
}

func TestIgnoraChatQueNaoEOOperador(t *testing.T) {
	rec := &fakeRecon{}
	resp := &fakeResp{ch: make(chan string, 10)}
	h := NewReconectarHandler(segredoTeste, chatTeste, rec, resp)
	r := montarRouter(h)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, requisicao(updateComTexto("999", "/reconectar 5534997202727"), segredoTeste))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, queria 200", w.Code)
	}
	if rec.conectou || rec.pediuPara != "" {
		t.Fatal("chat fora da lista não deveria disparar o pareamento")
	}
	if len(resp.ch) != 0 {
		t.Fatal("chat fora da lista não deveria receber resposta")
	}
}

func TestUsoInvalidoResponde(t *testing.T) {
	rec := &fakeRecon{}
	resp := &fakeResp{ch: make(chan string, 10)}
	h := NewReconectarHandler(segredoTeste, chatTeste, rec, resp)
	r := montarRouter(h)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, requisicao(updateComTexto(chatTeste, "/reconectar 12"), segredoTeste))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, queria 200", w.Code)
	}
	if rec.conectou {
		t.Fatal("número inválido não deveria chamar Conectar")
	}
	// A resposta de uso é síncrona, então já está no canal.
	select {
	case txt := <-resp.ch:
		if !strings.HasPrefix(txt, "Uso:") {
			t.Fatalf("resposta = %q, queria mensagem de uso", txt)
		}
	default:
		t.Fatal("esperava mensagem de uso")
	}
}

func TestFluxoFelizDevolveCodigo(t *testing.T) {
	rec := &fakeRecon{codigo: "ABCD-1234"}
	resp := &fakeResp{ch: make(chan string, 10)}
	h := NewReconectarHandler(segredoTeste, chatTeste, rec, resp)
	h.pausaAposConectar = 0
	r := montarRouter(h)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, requisicao(updateComTexto(chatTeste, "/reconectar 5534997202727"), segredoTeste))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, queria 200", w.Code)
	}

	select {
	case txt := <-resp.ch:
		if !strings.Contains(txt, "ABCD-1234") {
			t.Fatalf("resposta = %q, queria o código", txt)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout esperando a resposta com o código")
	}

	if !rec.conectou {
		t.Error("deveria ter chamado Conectar antes de pedir o código")
	}
	if rec.pediuPara != "5534997202727" {
		t.Errorf("pediu pareamento para %q", rec.pediuPara)
	}
}

func TestFalhaDePareamentoAvisaSemVazarNada(t *testing.T) {
	rec := &fakeRecon{errPair: errors.New("pareamento retornou código vazio")}
	resp := &fakeResp{ch: make(chan string, 10)}
	h := NewReconectarHandler(segredoTeste, chatTeste, rec, resp)
	h.pausaAposConectar = 0
	r := montarRouter(h)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, requisicao(updateComTexto(chatTeste, "/reconectar 5534997202727"), segredoTeste))

	select {
	case txt := <-resp.ch:
		if !strings.Contains(txt, "Não consegui gerar") {
			t.Fatalf("resposta = %q, queria aviso de falha", txt)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout esperando aviso de falha")
	}
}
