package webhook

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// setupAuthTestRouter monta só o suficiente para exercitar a etapa 1 de
// handleWebhook (validação de token) — um corpo vazio já basta, porque o
// handler responde e retorna antes de tentar fazer parse do payload quando
// o token falha.
func setupAuthTestRouter(token string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewHandler(Config{Token: token})
	r := gin.New()
	h.RegisterRoutes(r)
	return r
}

// TestWebhookAuth_HeaderAutentica cobre o caminho que passou a ser o único
// aceito: Authorization: Bearer <token>.
func TestWebhookAuth_HeaderAutentica(t *testing.T) {
	r := setupAuthTestRouter("segredo-forte")

	req := httptest.NewRequest(http.MethodPost, "/webhook/evolution", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer segredo-forte")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if strings.Contains(rec.Body.String(), "token_invalid") {
		t.Fatalf("token correto via header deveria autenticar, resposta: %s", rec.Body.String())
	}
}

// TestWebhookAuth_QueryStringNaoAutenticaMais é a regressão central desta
// correção: o token na URL (?token=...) era o vetor de exposição — em log de
// proxy, histórico, e no próprio registro do webhook salvo em texto plano no
// banco da Evolution. Deixou de ser um caminho válido de autenticação.
func TestWebhookAuth_QueryStringNaoAutenticaMais(t *testing.T) {
	r := setupAuthTestRouter("segredo-forte")

	req := httptest.NewRequest(http.MethodPost, "/webhook/evolution?token=segredo-forte", bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if !strings.Contains(rec.Body.String(), "token_invalid") {
		t.Fatalf("token só na query string não deveria mais autenticar, resposta: %s", rec.Body.String())
	}
}

// TestWebhookAuth_TokenErradoRejeitado garante que a mudança não afrouxou a
// validação em si — só o transporte do token mudou.
func TestWebhookAuth_TokenErradoRejeitado(t *testing.T) {
	r := setupAuthTestRouter("segredo-forte")

	req := httptest.NewRequest(http.MethodPost, "/webhook/evolution", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer token-chutado")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if !strings.Contains(rec.Body.String(), "token_invalid") {
		t.Fatalf("token incorreto deveria ser rejeitado, resposta: %s", rec.Body.String())
	}
}
