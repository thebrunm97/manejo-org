package webhook

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestKnowledgeUpload_RejectsMissingPmoID garante que o DT-82 está fechado:
// um multipart SEM o campo pmo_id deve retornar 400, nunca criar job com
// pmo_id = 0.
func TestKnowledgeUpload_RejectsMissingPmoID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(Config{Token: "test-token"})
	r := gin.New()
	h.RegisterRoutes(r)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	// Campo "file" obrigatório (precisa existir pra passar FormFile)
	fw, err := w.CreateFormFile("file", "test.pdf")
	if err != nil {
		t.Fatalf("criar form file: %v", err)
	}
	fw.Write([]byte("%PDF-1.4 fake"))

	// NÃO criamos campo "pmo_id" — é exatamente isso que o teste valida.

	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/knowledge/upload", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer test-token")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400 quando pmo_id ausente, recebeu %d — body: %s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, "pmo_id") {
		t.Fatalf("resposta deveria mencionar pmo_id, body: %s", body)
	}
}

// TestKnowledgeUpload_RejectsZeroPmoID garante que pmo_id = 0 (ou negativo)
// também é rejeitado — fecha o bypass que o DT-82 descreve.
func TestKnowledgeUpload_RejectsZeroPmoID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewHandler(Config{Token: "test-token"})
	r := gin.New()
	h.RegisterRoutes(r)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	fw, err := w.CreateFormFile("file", "test.pdf")
	if err != nil {
		t.Fatalf("criar form file: %v", err)
	}
	fw.Write([]byte("%PDF-1.4 fake"))

	w.WriteField("pmo_id", "0")

	w.Close()

	req := httptest.NewRequest(http.MethodPost, "/knowledge/upload", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer test-token")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400 quando pmo_id = 0, recebeu %d — body: %s", rec.Code, rec.Body.String())
	}
}
