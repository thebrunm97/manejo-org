package state

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// TestProcessMessage_ResolveConversationIDQuandoHaPerfil cobre a integração
// central deste plano: assim que ProcessMessage resolve um perfil existente,
// ele deve tentar popular msg.ConversationID via GetOrCreateConversation —
// hoje isso nunca acontecia em lugar nenhum do código de produção (achado da
// verificação do checkpoint da feature multicanal), e o WhatsApp só
// funcionava porque tudo mais cai de volta para o telefone.
//
// O teste não inspeciona o campo ConversationID diretamente (é local à
// função) — prova pelo efeito observável: o endpoint de conversations do
// stub é atingido exatamente uma vez, com o user_id do perfil resolvido.
func TestProcessMessage_ResolveConversationIDQuandoHaPerfil(t *testing.T) {
	var conversationHits int
	var lastConversationQuery string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/rest/v1/profiles"):
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"id":"user-abc","nome":"Ahmed Mesalam","telefone":"5511999999999"}]`))

		case strings.HasPrefix(r.URL.Path, "/rest/v1/conversations") && r.Method == http.MethodGet:
			conversationHits++
			lastConversationQuery = r.URL.RawQuery
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`)) // nenhuma conversa ativa ainda

		case strings.HasPrefix(r.URL.Path, "/rest/v1/conversations") && r.Method == http.MethodPost:
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`[{"id":"conv-nova"}]`))

		default:
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`))
		}
	}))
	defer server.Close()

	sbClient, err := supabase.NewClient(supabase.Config{URL: server.URL, Key: "stub-key"})
	if err != nil {
		t.Fatalf("falha ao criar client: %v", err)
	}

	sender := &mockSender{}
	historyManager := history.NewManager(45*60_000_000_000, 1000) // 45min em ns, mesmo padrão dos outros testes

	msg := ports.IncomingEnvelope{
		From: "5511999999999",
		Body: "oi", // saudação pura: retorna cedo pelo Ultra-Fast Greeting Guard,
		// que já roda DEPOIS do ponto onde ConversationID deveria ser
		// populado — suficiente para provar a integração sem depender do
		// resto do pipeline (LLM, MCP, etc.).
	}

	ProcessMessage(context.Background(), msg, sbClient, nil, sender, nil, nil, nil, historyManager, nil, RouterConfig{}, nil)

	if conversationHits != 1 {
		t.Fatalf("esperava 1 chamada a GetOrCreateConversation (via GET conversations), got %d", conversationHits)
	}
	if !strings.Contains(lastConversationQuery, "user_id=eq.user-abc") {
		t.Errorf("query deveria filtrar por user_id=eq.user-abc (o perfil resolvido), veio: %q", lastConversationQuery)
	}
	if !strings.Contains(lastConversationQuery, "tenant_id=is.null") {
		t.Errorf("com ADR-010 em aberto, deveria usar tenant_id=is.null, veio: %q", lastConversationQuery)
	}
}
