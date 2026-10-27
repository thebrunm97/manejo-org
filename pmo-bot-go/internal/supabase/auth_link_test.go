package supabase

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Usuário com e-mail entra pelo magiclink e a senha dele não é tocada.
func TestSessaoSemTrocarSenha_EmailNaoTrocaSenha(t *testing.T) {
	trocouSenha := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/auth/v1/admin/users/u1":
			w.Write([]byte(`{"id":"u1","email":"p@x.org","phone":"258841234567"}`))
		case r.Method == http.MethodPut:
			trocouSenha = true
		case r.URL.Path == "/auth/v1/admin/generate_link":
			var b map[string]string
			json.NewDecoder(r.Body).Decode(&b)
			if b["type"] != "magiclink" || b["email"] != "p@x.org" {
				t.Errorf("generate_link payload: %v", b)
			}
			w.Write([]byte(`{"id":"u1","hashed_token":"h123"}`))
		case r.URL.Path == "/auth/v1/verify":
			var b map[string]string
			json.NewDecoder(r.Body).Decode(&b)
			if b["token_hash"] != "h123" {
				t.Errorf("verify payload: %v", b)
			}
			w.Write([]byte(`{"access_token":"a","refresh_token":"r","expires_in":3600}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	c, _ := NewClient(Config{URL: srv.URL, Key: "k"})

	s, err := c.SessaoSemTrocarSenha("u1", "aleatoria")
	if err != nil {
		t.Fatal(err)
	}
	if s.AccessToken != "a" || s.RefreshToken != "r" {
		t.Errorf("sessão: %+v", s)
	}
	if trocouSenha {
		t.Error("não podia trocar a senha de quem tem e-mail")
	}
}
