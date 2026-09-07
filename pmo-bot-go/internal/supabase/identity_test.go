package supabase

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestGetOrCreateConversation_TenantVazioNaoQuebra cobre o caminho "sem
// tenant ainda" (ADR-010 em aberto, ver comentário na função): tenantID=""
// tem que virar `tenant_id=is.null` na busca e omitir a chave no INSERT, não
// mandar uma string vazia — que o PostgREST rejeitaria como UUID inválido
// (22P02) e derrubaria toda tentativa de resolver conversationID.
func TestGetOrCreateConversation_TenantVazioNaoQuebra(t *testing.T) {
	var getQuery string
	var postBody string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getQuery = r.URL.RawQuery
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`)) // nenhuma conversa ativa ainda
		case http.MethodPost:
			buf := make([]byte, r.ContentLength)
			r.Body.Read(buf)
			postBody = string(buf)
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`[{"id":"conv-123"}]`))
		}
	}))
	defer server.Close()

	client, err := NewClient(Config{URL: server.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("falha ao criar client: %v", err)
	}

	convID, err := client.GetOrCreateConversation(context.Background(), "", "user-abc", "whatsapp", "5511999999999")
	if err != nil {
		t.Fatalf("GetOrCreateConversation com tenantID vazio não deveria falhar: %v", err)
	}
	if convID != "conv-123" {
		t.Errorf("convID = %q, queria %q", convID, "conv-123")
	}

	if !strings.Contains(getQuery, "tenant_id=is.null") {
		t.Errorf("query GET deveria usar tenant_id=is.null, veio: %q", getQuery)
	}
	if strings.Contains(getQuery, "tenant_id=eq.") {
		t.Errorf("query GET não deveria comparar tenant_id a uma string vazia: %q", getQuery)
	}
	if strings.Contains(postBody, `"tenant_id"`) {
		t.Errorf("payload de INSERT não deveria incluir tenant_id quando vazio: %q", postBody)
	}
}

// TestGetOrCreateConversation_TenantPreenchidoUsaEq garante que o caminho
// "com tenant" — quando o ADR-010 fechar e algo passar a preencher
// tenantID — continua funcionando como antes desta mudança.
func TestGetOrCreateConversation_TenantPreenchidoUsaEq(t *testing.T) {
	var getQuery string
	var postBody string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getQuery = r.URL.RawQuery
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`))
		case http.MethodPost:
			buf := make([]byte, r.ContentLength)
			r.Body.Read(buf)
			postBody = string(buf)
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`[{"id":"conv-456"}]`))
		}
	}))
	defer server.Close()

	client, err := NewClient(Config{URL: server.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("falha ao criar client: %v", err)
	}

	convID, err := client.GetOrCreateConversation(context.Background(), "tenant-xyz", "user-abc", "whatsapp", "5511999999999")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if convID != "conv-456" {
		t.Errorf("convID = %q, queria %q", convID, "conv-456")
	}
	if !strings.Contains(getQuery, "tenant_id=eq.tenant-xyz") {
		t.Errorf("query GET deveria filtrar por tenant_id=eq.tenant-xyz, veio: %q", getQuery)
	}
	if !strings.Contains(postBody, `"tenant_id":"tenant-xyz"`) {
		t.Errorf("payload de INSERT deveria incluir tenant_id quando preenchido: %q", postBody)
	}
}
