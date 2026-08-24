package middleware

// Autenticação das rotas HTTP do frontend (DT-59, fatia 1).
//
// POR QUE ESTE ARQUIVO EXISTE
//
// Até aqui o grupo /api/v1/admin/* não tinha autenticação NENHUMA — o
// middleware global era só RequestID/CORS/Logger/Recovery. Nove rotas ficavam
// abertas, entre elas DELETE /knowledge/documents/:id e
// POST /knowledge/playground/rag (que gasta crédito de LLM a cada chamada),
// além de POST /admin/reload-knowledge. O próprio frontend documentava o
// buraco com um comentário ("In a real scenario, attach the JWT token here").
// Só não vazou porque a stack roda em localhost — no dia em que o servidor
// ganhar IP público (DT-38), vira exposição direta.
//
// COMO O TOKEN É VERIFICADO
//
// Este projeto Supabase assina os JWT com chaves ASSIMÉTRICAS (ES256),
// publicadas em /auth/v1/.well-known/jwks.json — não com o segredo HS256
// legado. Isso é melhor de operar: não há segredo novo para guardar no .env,
// basta o SUPABASE_URL que já existe. Em troca, é preciso buscar e cachear o
// conjunto de chaves, e rebuscá-lo quando aparecer um `kid` desconhecido
// (rotação de chave — o projeto já publica duas).
//
// O algoritmo é fixado em ES256 na verificação. Sem essa trava, um token
// forjado com alg "none" ou HS256 (usando a chave pública como se fosse
// segredo compartilhado) seria aceito — é a classe de ataque de confusão de
// algoritmo, e o jeito de fechá-la é nunca deixar o token escolher como é
// verificado.

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	// ContextUserID é a chave sob a qual o `sub` do token (o auth.users.id)
	// fica disponível para os handlers.
	ContextUserID = "auth_user_id"
	// ContextUserRole é o papel declarado no token ("authenticated",
	// "service_role", ...). NÃO confundir com o papel de aplicação
	// (profiles.role), que diz se a pessoa é admin do painel.
	ContextUserRole = "auth_user_role"
	// ContextUserEmail é o e-mail do token, quando presente.
	ContextUserEmail = "auth_user_email"
	// ContextRawToken guarda o JWT bruto (sem "Bearer "), para o gateway REST
	// (DT-59, fatia 3) reencaminhar ao PostgREST — auth.uid() dentro das RPCs
	// SECURITY DEFINER so resolve com o token de verdade do produtor, nunca
	// com a chave de servico.
	ContextRawToken = "auth_raw_token"

	// jwksMinRefetchInterval evita que uma enxurrada de tokens com `kid`
	// inválido vire uma enxurrada de requisições ao Supabase — um vetor de
	// negação de serviço barato se a rebusca fosse irrestrita.
	jwksMinRefetchInterval = 1 * time.Minute
)

// JWKSVerifier busca, cacheia e aplica as chaves públicas do Supabase.
type JWKSVerifier struct {
	url    string
	client *http.Client

	mu          sync.RWMutex
	keys        map[string]*jwksKey
	lastFetched time.Time
}

type jwksKey struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksDocument struct {
	Keys []*jwksKey `json:"keys"`
}

// publicKey converte a chave do JWKS em uma chave pública utilizável.
//
// Só EC/P-256 é aceito, que é o que este projeto publica (ES256). Recusar o
// resto é deliberado: aceitar RSA aqui abriria caminho para um par de chaves
// inesperado ser tratado como legítimo, e não há caso de uso para isso — se um
// dia o Supabase mudar de curva, é melhor falhar alto do que verificar com
// suposição errada.
func (k *jwksKey) publicKey() (interface{}, error) {
	if k.Kty != "EC" {
		return nil, fmt.Errorf("jwks: tipo de chave %q não suportado (esperado EC)", k.Kty)
	}
	if k.Crv != "P-256" {
		return nil, fmt.Errorf("jwks: curva %q não suportada (esperado P-256)", k.Crv)
	}

	x, err := base64.RawURLEncoding.DecodeString(k.X)
	if err != nil {
		return nil, fmt.Errorf("jwks: coordenada X inválida: %w", err)
	}
	y, err := base64.RawURLEncoding.DecodeString(k.Y)
	if err != nil {
		return nil, fmt.Errorf("jwks: coordenada Y inválida: %w", err)
	}

	pub := &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(x),
		Y:     new(big.Int).SetBytes(y),
	}

	// Um ponto fora da curva não é uma chave válida e, dependendo do uso,
	// abre espaço para ataque de curva inválida. Barato de checar aqui.
	if !pub.Curve.IsOnCurve(pub.X, pub.Y) {
		return nil, fmt.Errorf("jwks: ponto da chave %q não está na curva P-256", k.Kid)
	}

	return pub, nil
}

// NewJWKSVerifier monta o verificador a partir da URL do projeto Supabase
// (a mesma SUPABASE_URL já usada pelo resto do sistema).
func NewJWKSVerifier(supabaseURL string) *JWKSVerifier {
	return &JWKSVerifier{
		url:    strings.TrimSuffix(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json",
		client: &http.Client{Timeout: 10 * time.Second},
		keys:   make(map[string]*jwksKey),
	}
}

// refresh rebusca o conjunto de chaves. `force` ignora o cache, mas nunca o
// intervalo mínimo entre buscas.
func (v *JWKSVerifier) refresh(force bool) error {
	v.mu.RLock()
	fresh := len(v.keys) > 0 && time.Since(v.lastFetched) < time.Hour
	recent := time.Since(v.lastFetched) < jwksMinRefetchInterval
	v.mu.RUnlock()

	if fresh && !force {
		return nil
	}
	if force && recent {
		return fmt.Errorf("jwks: rebusca ignorada (intervalo mínimo de %s não decorrido)", jwksMinRefetchInterval)
	}

	resp, err := v.client.Get(v.url)
	if err != nil {
		return fmt.Errorf("jwks: busca falhou: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("jwks: status inesperado %d", resp.StatusCode)
	}

	var doc jwksDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return fmt.Errorf("jwks: decode falhou: %w", err)
	}
	if len(doc.Keys) == 0 {
		return fmt.Errorf("jwks: documento sem chaves")
	}

	novo := make(map[string]*jwksKey, len(doc.Keys))
	for _, k := range doc.Keys {
		if k.Kid != "" {
			novo[k.Kid] = k
		}
	}

	v.mu.Lock()
	v.keys = novo
	v.lastFetched = time.Now()
	v.mu.Unlock()

	log.Printf("🔐 [Auth] JWKS carregado: %d chave(s) do Supabase", len(novo))
	return nil
}

// keyFor devolve a chave pública correspondente ao `kid`, rebuscando o
// conjunto uma única vez se o `kid` for desconhecido (caso de rotação).
func (v *JWKSVerifier) keyFor(kid string) (interface{}, error) {
	if err := v.refresh(false); err != nil {
		return nil, err
	}

	v.mu.RLock()
	k, ok := v.keys[kid]
	v.mu.RUnlock()

	if !ok {
		// `kid` desconhecido é o sintoma esperado de rotação de chave —
		// rebuscar uma vez antes de recusar evita derrubar todo mundo no
		// momento em que o Supabase troca o par.
		if err := v.refresh(true); err != nil {
			return nil, fmt.Errorf("jwks: kid %q desconhecido e rebusca falhou: %w", kid, err)
		}
		v.mu.RLock()
		k, ok = v.keys[kid]
		v.mu.RUnlock()
	}

	if !ok {
		return nil, fmt.Errorf("jwks: nenhuma chave com kid %q", kid)
	}

	return k.publicKey()
}

// Claims é o subconjunto do token que interessa às rotas.
type Claims struct {
	Subject string
	Role    string
	Email   string
}

// Verify valida assinatura, expiração e emissor, devolvendo os claims úteis.
func (v *JWKSVerifier) Verify(tokenString string) (*Claims, error) {
	parsed, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, fmt.Errorf("token sem kid no cabeçalho")
		}
		return v.keyFor(kid)
	},
		// Algoritmo fixo: sem isto, um token forjado com "none" ou HS256
		// passaria. jwt.Parse já valida `exp`/`nbf` por padrão.
		jwt.WithValidMethods([]string{"ES256"}),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	if !parsed.Valid {
		return nil, fmt.Errorf("token inválido")
	}

	mapClaims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("claims em formato inesperado")
	}

	sub, _ := mapClaims["sub"].(string)
	if sub == "" {
		return nil, fmt.Errorf("token sem `sub` — não identifica usuário")
	}
	role, _ := mapClaims["role"].(string)
	email, _ := mapClaims["email"].(string)

	return &Claims{Subject: sub, Role: role, Email: email}, nil
}

// RequireAuth exige um JWT válido do Supabase e publica os claims no contexto.
//
// Se o verificador for nil (SUPABASE_URL ausente), o middleware RECUSA tudo em
// vez de deixar passar. Falhar fechado é deliberado: a configuração ausente é
// justamente o cenário em que passar aberto reproduz o buraco que este arquivo
// existe para fechar.
func RequireAuth(v *JWKSVerifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		if v == nil {
			log.Printf("🔒 [Auth] Requisição recusada: verificador JWT não configurado (SUPABASE_URL ausente)")
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "autenticação não configurada no servidor",
			})
			return
		}

		header := c.GetHeader("Authorization")
		const prefixo = "Bearer "
		if len(header) <= len(prefixo) || !strings.EqualFold(header[:len(prefixo)], prefixo) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "cabeçalho Authorization: Bearer <token> ausente",
			})
			return
		}

		rawToken := strings.TrimSpace(header[len(prefixo):])
		claims, err := v.Verify(rawToken)
		if err != nil {
			// A mensagem detalhada fica no log do servidor; o cliente recebe
			// só "token inválido". Detalhar ao cliente qual parte falhou
			// ajuda mais quem está sondando do que quem está integrando.
			log.Printf("🔒 [Auth] Token recusado: %v", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token inválido"})
			return
		}

		c.Set(ContextUserID, claims.Subject)
		c.Set(ContextUserRole, claims.Role)
		c.Set(ContextUserEmail, claims.Email)
		c.Set(ContextRawToken, rawToken)

		c.Next()
	}
}

// AdminChecker responde se um usuário é admin do painel. Fica como função em
// vez de acoplar o middleware ao pacote supabase — o papel de aplicação mora
// em profiles.role, não no JWT, e o middleware não deve saber consultar banco.
type AdminChecker func(userID string) (bool, error)

// RequireAdmin roda DEPOIS de RequireAuth e exige papel de admin.
//
// O papel vem do banco (profiles.role), não do claim `role` do token: o claim
// do Supabase diz "authenticated" para todo usuário logado, inclusive um
// produtor comum. Confiar nele para autorizar o painel administrativo daria
// acesso de admin a qualquer pessoa com conta.
func RequireAdmin(ehAdmin AdminChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString(ContextUserID)
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "não autenticado"})
			return
		}

		if ehAdmin == nil {
			log.Printf("🔒 [Auth] Verificação de admin indisponível — recusando %s", userID)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "verificação de permissão indisponível",
			})
			return
		}

		ok, err := ehAdmin(userID)
		if err != nil {
			log.Printf("🔒 [Auth] Falha ao verificar admin de %s: %v", userID, err)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "não foi possível verificar permissão",
			})
			return
		}
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "acesso restrito a administradores"})
			return
		}

		c.Next()
	}
}
