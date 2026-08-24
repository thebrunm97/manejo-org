package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// chaveDeTeste gera um par ES256 e serve o JWKS correspondente, imitando o
// endpoint do Supabase. Assim os testes exercitam o caminho real de busca e
// verificação, em vez de injetar a chave por dentro.
type chaveDeTeste struct {
	priv *ecdsa.PrivateKey
	kid  string
	srv  *httptest.Server
}

func novaChaveDeTeste(t *testing.T) *chaveDeTeste {
	t.Helper()

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("não gerou chave: %v", err)
	}

	c := &chaveDeTeste{priv: priv, kid: "kid-de-teste"}

	mux := http.NewServeMux()
	mux.HandleFunc("/auth/v1/.well-known/jwks.json", func(w http.ResponseWriter, r *http.Request) {
		doc := jwksDocument{Keys: []*jwksKey{{
			Kid: c.kid,
			Kty: "EC",
			Alg: "ES256",
			Crv: "P-256",
			X:   base64.RawURLEncoding.EncodeToString(priv.PublicKey.X.Bytes()),
			Y:   base64.RawURLEncoding.EncodeToString(priv.PublicKey.Y.Bytes()),
		}}}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(doc)
	})

	c.srv = httptest.NewServer(mux)
	t.Cleanup(c.srv.Close)
	return c
}

func (c *chaveDeTeste) token(t *testing.T, sub string, exp time.Time) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"sub":  sub,
		"role": "authenticated",
		"exp":  exp.Unix(),
		"iat":  time.Now().Add(-time.Minute).Unix(),
	})
	tok.Header["kid"] = c.kid
	s, err := tok.SignedString(c.priv)
	if err != nil {
		t.Fatalf("não assinou token: %v", err)
	}
	return s
}

// rodar monta um router mínimo com o middleware e devolve o status da resposta.
func rodar(t *testing.T, v *JWKSVerifier, authHeader string) (int, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()

	var visto string
	r.GET("/protegido", RequireAuth(v), func(c *gin.Context) {
		visto = c.GetString(ContextUserID)
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/protegido", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code, visto
}

// O caso que motivou o arquivo inteiro: sem token, a rota não responde.
func TestSemTokenRecusa(t *testing.T) {
	c := novaChaveDeTeste(t)
	v := NewJWKSVerifier(c.srv.URL)

	if code, _ := rodar(t, v, ""); code != http.StatusUnauthorized {
		t.Errorf("sem Authorization deveria dar 401, deu %d", code)
	}
}

func TestTokenValidoPassaEPublicaOSub(t *testing.T) {
	c := novaChaveDeTeste(t)
	v := NewJWKSVerifier(c.srv.URL)

	tok := c.token(t, "user-123", time.Now().Add(time.Hour))
	code, sub := rodar(t, v, "Bearer "+tok)

	if code != http.StatusOK {
		t.Fatalf("token válido deveria passar, deu %d", code)
	}
	if sub != "user-123" {
		t.Errorf("o handler deveria enxergar sub=user-123, viu %q", sub)
	}
}

func TestTokenExpiradoRecusa(t *testing.T) {
	c := novaChaveDeTeste(t)
	v := NewJWKSVerifier(c.srv.URL)

	tok := c.token(t, "user-123", time.Now().Add(-time.Minute))
	if code, _ := rodar(t, v, "Bearer "+tok); code != http.StatusUnauthorized {
		t.Errorf("token expirado deveria dar 401, deu %d", code)
	}
}

// Assinatura de outra chave: é o teste que prova que a verificação
// criptográfica realmente acontece, e não só o parse dos claims.
func TestAssinaturaDeOutraChaveRecusa(t *testing.T) {
	c := novaChaveDeTeste(t)
	v := NewJWKSVerifier(c.srv.URL)

	intrusa, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("não gerou chave intrusa: %v", err)
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"sub": "invasor",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	tok.Header["kid"] = c.kid // finge ser a chave legítima
	s, err := tok.SignedString(intrusa)
	if err != nil {
		t.Fatalf("não assinou: %v", err)
	}

	if code, _ := rodar(t, v, "Bearer "+s); code != http.StatusUnauthorized {
		t.Errorf("token assinado por chave estranha deveria dar 401, deu %d", code)
	}
}

// Confusão de algoritmo: token "alg: none" não pode passar. Sem a trava de
// WithValidMethods, este é o caminho clássico de forjar acesso.
func TestAlgNoneRecusa(t *testing.T) {
	c := novaChaveDeTeste(t)
	v := NewJWKSVerifier(c.srv.URL)

	cabecalho := base64.RawURLEncoding.EncodeToString([]byte(
		fmt.Sprintf(`{"alg":"none","typ":"JWT","kid":%q}`, c.kid)))
	corpo := base64.RawURLEncoding.EncodeToString([]byte(
		fmt.Sprintf(`{"sub":"invasor","exp":%d}`, time.Now().Add(time.Hour).Unix())))
	forjado := cabecalho + "." + corpo + "."

	if code, _ := rodar(t, v, "Bearer "+forjado); code != http.StatusUnauthorized {
		t.Errorf("token alg=none deveria dar 401, deu %d", code)
	}
}

// Verificador não configurado deve FECHAR, não abrir. Se algum dia alguém
// tornar o SUPABASE_URL opcional, este teste é o que impede a regressão de
// virar "sem config = tudo liberado".
func TestVerificadorNilRecusaTudo(t *testing.T) {
	if code, _ := rodar(t, nil, "Bearer qualquer-coisa"); code == http.StatusOK {
		t.Error("verificador nil não pode deixar a requisição passar")
	}
}

func TestPrefixoBearerObrigatorio(t *testing.T) {
	c := novaChaveDeTeste(t)
	v := NewJWKSVerifier(c.srv.URL)
	tok := c.token(t, "user-123", time.Now().Add(time.Hour))

	// Token cru, sem "Bearer ".
	if code, _ := rodar(t, v, tok); code != http.StatusUnauthorized {
		t.Errorf("token sem prefixo Bearer deveria dar 401, deu %d", code)
	}
}

// RequireAdmin não pode confiar no claim `role` do token: o Supabase manda
// "authenticated" para todo usuário logado, inclusive produtor comum.
func TestRequireAdminBloqueiaNaoAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/admin", func(c *gin.Context) {
		c.Set(ContextUserID, "produtor-comum")
		c.Next()
	}, RequireAdmin(func(userID string) (bool, error) {
		return false, nil
	}), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/admin", nil))

	if w.Code != http.StatusForbidden {
		t.Errorf("não-admin deveria receber 403, recebeu %d", w.Code)
	}
}

// Falha ao consultar o papel não pode virar liberação.
func TestRequireAdminFalhaFechada(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/admin", func(c *gin.Context) {
		c.Set(ContextUserID, "alguem")
		c.Next()
	}, RequireAdmin(func(userID string) (bool, error) {
		return false, fmt.Errorf("banco indisponível")
	}), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/admin", nil))

	if w.Code == http.StatusOK {
		t.Error("erro ao verificar papel não pode liberar acesso")
	}
}
