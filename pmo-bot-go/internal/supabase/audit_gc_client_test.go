package supabase

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Regressao: a API de Storage do Supabase devolve HTTP 400 com
// "statusCode":"404" no corpo para objeto inexistente — nao um HTTP 404 de
// verdade. Verificado em producao contra um registro de teste apontando para
// um objeto que nunca existiu no bucket. Sem tratar isso como sucesso, TODO
// expurgo de um objeto ja removido falharia para sempre.
func TestDeleteStorageFile_ObjetoInexistenteEhSucesso(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"statusCode":"404","error":"not_found","message":"Object not found"}`))
	}))
	defer srv.Close()

	c := &Client{config: Config{URL: srv.URL, Key: "fake"}, httpClient: srv.Client()}

	if err := c.DeleteStorageFile(context.Background(), "audit-vault", "algum/caminho.ogg"); err != nil {
		t.Fatalf("objeto inexistente deveria ser tratado como sucesso, got: %v", err)
	}
}

// Um 400 genuíno de outra causa (bucket errado, payload malformado) continua
// sendo erro — só o padrão especifico de "nao existe" vira sucesso.
func TestDeleteStorageFile_400GenuinoContinuaSendoErro(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"statusCode":"400","error":"invalid_request","message":"bucket malformado"}`))
	}))
	defer srv.Close()

	c := &Client{config: Config{URL: srv.URL, Key: "fake"}, httpClient: srv.Client()}

	if err := c.DeleteStorageFile(context.Background(), "audit-vault", "x.ogg"); err == nil {
		t.Fatal("um 400 que nao e 'nao existe' deveria propagar erro")
	}
}

func TestDeleteStorageFile_SucessoReal(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &Client{config: Config{URL: srv.URL, Key: "fake"}, httpClient: srv.Client()}

	if err := c.DeleteStorageFile(context.Background(), "audit-vault", "x.ogg"); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
}
