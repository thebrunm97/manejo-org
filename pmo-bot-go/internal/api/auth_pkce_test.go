package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// mockRateLimiter sempre permite a requisição
type mockRateLimiter struct{}

func (m *mockRateLimiter) Allow(ctx context.Context, key string) (ports.RateLimitDecision, error) {
	return ports.RateLimitDecision{Allowed: true}, nil
}

func setupMockSupabaseServer() *httptest.Server {
	// Variáveis de estado para simular a tabela `onboarding_tokens`
	var tokensLock sync.Mutex
	usedTokens := make(map[string]bool)

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock do ExchangeOpaqueToken
		if strings.HasPrefix(r.URL.Path, "/rest/v1/onboarding_tokens") && r.Method == "PATCH" {
			// O PATCH verifica used=eq.false na query string, o que significa que atua como atomic check-and-set
			query := r.URL.Query()
			tokenHashEq := query.Get("token_hash")
			if !strings.HasPrefix(tokenHashEq, "eq.") {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			tokenHash := strings.TrimPrefix(tokenHashEq, "eq.")

			tokensLock.Lock()
			defer tokensLock.Unlock()

			if usedTokens[tokenHash] {
				// Simula: nenhum registro atualizado (token já usado)
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[]`))
				return
			}
			
			// Marca como usado
			usedTokens[tokenHash] = true

			// Retorna o "representation" simulado de 1 linha atualizada
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"user_id": "test-user-id", "expires_at": "2030-01-01T00:00:00Z"}]`))
			return
		}

		// Mock do UpdateUserPasswordAndLogin
		if strings.HasPrefix(r.URL.Path, "/auth/v1/admin/users/") && r.Method == "PUT" {
			// Sucesso na troca de senha
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"id": "test-user-id", "phone": "5511999999999"}`))
			return
		}

		if strings.HasPrefix(r.URL.Path, "/auth/v1/token") && r.Method == "POST" {
			// Sucesso no login após atualizar a senha
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"access_token": "mock_access", "refresh_token": "mock_refresh"}`))
			return
		}

		// Fallback
		w.WriteHeader(http.StatusNotFound)
	}))
}

func TestAuthExchange_RaceCondition(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Servidor mock do Supabase (simula PostgREST + GoTrue)
	mockSupa := setupMockSupabaseServer()
	defer mockSupa.Close()

	sbClient, _ := supabase.NewClient(supabase.Config{
		URL: mockSupa.URL,
		Key: "dummy_key",
	})

	handler := NewAuthHandler(sbClient, &mockRateLimiter{})
	router := gin.New()
	router.POST("/api/v1/auth/exchange", handler.Exchange)

	// Servidor Gin real de rede — as goroutines farão HTTP real, não ServeHTTP in-process.
	// Isso garante que o Go net/http server atenda cada requisição em sua própria goroutine,
	// e que concorrência real de rede seja exercida contra o mock do Supabase.
	ginServer := httptest.NewServer(router)
	defer ginServer.Close()

	var successCount int32
	var failCount int32
	var wg sync.WaitGroup

	const concurrentRequests = 5

	// startGate garante que todas as goroutines de cliente estejam prontas
	// antes que qualquer uma envie a requisição — sem ele, o scheduler poderia
	// serializar a execução e o teste não provaria concorrência real.
	startGate := make(chan struct{})

	wg.Add(concurrentRequests)
	for i := 0; i < concurrentRequests; i++ {
		go func() {
			defer wg.Done()

			// Aguarda o sinal de largada — todas as goroutines ficam bloqueadas aqui
			// até que o canal seja fechado pelo coordenador abaixo.
			<-startGate

			resp, err := http.Post(
				ginServer.URL+"/api/v1/auth/exchange",
				"application/json",
				strings.NewReader(`{"code": "token_valido"}`),
			)
			if err != nil {
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode == http.StatusOK {
				atomic.AddInt32(&successCount, 1)
			} else if resp.StatusCode == http.StatusUnauthorized {
				atomic.AddInt32(&failCount, 1)
			}
		}()
	}

	// Libera todas as goroutines simultaneamente
	close(startGate)

	wg.Wait()

	// Exatamente 1 deve ter conseguido a sessão; as outras 4 devem ter recebido 401.
	// Se o mock não tivesse mutex, poderíamos ter 0 (data race na leitura do mapa)
	// ou mais de 1 (duas goroutines entram na seção crítica antes do mark como usado).
	if successCount != 1 {
		t.Errorf("Race condition falhou: esperava exatamente 1 sucesso, obteve %d", successCount)
	}
	if failCount != concurrentRequests-1 {
		t.Errorf("Race condition falhou: esperava %d falhas (401), obteve %d", concurrentRequests-1, failCount)
	}
}

func TestAuthExchange_ExpiredToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Servidor que simula token expirado (sempre retorna array vazio pro PATCH com used=eq.false)
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/rest/v1/onboarding_tokens") && r.Method == "PATCH" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`))
			return
		}
	}))
	defer mockServer.Close()

	sbClient, _ := supabase.NewClient(supabase.Config{
		URL: mockServer.URL,
		Key: "dummy_key",
	})

	handler := NewAuthHandler(sbClient, &mockRateLimiter{})

	router := gin.New()
	router.POST("/api/v1/auth/exchange", handler.Exchange)

	payload := `{"code": "token_expirado"}`
	req, _ := http.NewRequest("POST", "/api/v1/auth/exchange", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Esperava 401 Unauthorized para token expirado, mas obteve %d", w.Code)
	}
}

