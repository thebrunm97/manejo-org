package supabase_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestIdempotencyRPC_ConcurrentRequests(t *testing.T) {
	var insertCount int32
	var alreadyProcessedCount int32
	seenKeys := sync.Map{}

	// Mock HTTP Server that emulates PostgreSQL's UNIQUE constraint and RPC deduplication
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/insumos_proibidos" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}

		// Simula pequena latência de I/O de banco (5ms)
		time.Sleep(5 * time.Millisecond)

		var reqBody map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&reqBody)

		idempKey := r.Header.Get("Idempotency-Key")
		if idempKey == "" {
			if k, ok := reqBody["idempotency_key_arg"].(string); ok {
				idempKey = k
			} else if p, ok := reqBody["payload_arg"].(map[string]interface{}); ok {
				if k, ok := p["idempotency_key"].(string); ok {
					idempKey = k
				}
			}
		}

		if idempKey != "" {
			// Emulate Postgres UNIQUE constraint / check
			if _, exists := seenKeys.LoadOrStore(idempKey, true); exists {
				// Duplicate detected! Return already_processed
				atomic.AddInt32(&alreadyProcessedCount, 1)
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"status":  "already_processed",
					"id":      "caderno-row-12345",
					"message": "Operação já registrada anteriormente (Deduplicação de Idempotência).",
				})
				return
			}
		}

		// First insert
		atomic.AddInt32(&insertCount, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"id":      "caderno-row-12345",
			"message": "Operação de campo registrada com sucesso.",
		})
	}))
	defer mockServer.Close()

	client, err := supabase.NewClient(supabase.Config{
		URL: mockServer.URL,
		Key: "mock-key",
	})
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	testIdempKey := "sha256-test-key-5511999999999-msg001"
	ctx := context.WithValue(context.Background(), "idempotency_key", testIdempKey)

	// Disparar 10 goroutines concorrentes simultâneas com a MESMA chave de idempotência
	concurrency := 10
	var wg sync.WaitGroup
	wg.Add(concurrency)

	for i := 0; i < concurrency; i++ {
		go func(goroutineID int) {
			defer wg.Done()
			res, err := client.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
				"pmo_id_arg":  10,
				"user_id_arg": "user-uuid-123",
				"tipo_arg":    "Plantio",
				"payload_arg": map[string]interface{}{
					"produto":          "Tomate Cereja",
					"quantidade_valor": 500.0,
				},
			}, "2026-08-16")

			if err != nil {
				t.Errorf("goroutine %d failed: %v", goroutineID, err)
				return
			}

			status, _ := res["status"].(string)
			if status != "success" && status != "already_processed" {
				t.Errorf("goroutine %d received unexpected status: %s", goroutineID, status)
			}
		}(i)
	}

	wg.Wait()

	// Asserção: Exatamente 1 INSERT ocorreu no banco simulado
	if atomic.LoadInt32(&insertCount) != 1 {
		t.Errorf("Expected exactly 1 insert, but got %d", insertCount)
	}

	// Asserção: As outras 9 chamadas concorrentes foram deduplicadas
	if atomic.LoadInt32(&alreadyProcessedCount) != int32(concurrency-1) {
		t.Errorf("Expected %d already_processed responses, but got %d", concurrency-1, alreadyProcessedCount)
	}
}

func TestIdempotencyFinanceiroRPC_ConcurrentRequests(t *testing.T) {
	var insertCount int32
	var alreadyProcessedCount int32
	seenKeys := sync.Map{}

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/insumos_proibidos" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}

		time.Sleep(5 * time.Millisecond)

		var reqBody map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&reqBody)

		idempKey := r.Header.Get("Idempotency-Key")
		if idempKey == "" {
			if k, ok := reqBody["idempotency_key_arg"].(string); ok {
				idempKey = k
			}
		}

		if idempKey != "" {
			if _, exists := seenKeys.LoadOrStore(idempKey, true); exists {
				atomic.AddInt32(&alreadyProcessedCount, 1)
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"status":       "already_processed",
					"transacao_id": "tx-row-uuid-999",
					"message":      "Transação já registrada anteriormente (Deduplicação de Idempotência).",
				})
				return
			}
		}

		atomic.AddInt32(&insertCount, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":       "success",
			"transacao_id": "tx-row-uuid-999",
			"message":      "Transação financeira registrada com sucesso.",
		})
	}))
	defer mockServer.Close()

	client, err := supabase.NewClient(supabase.Config{
		URL: mockServer.URL,
		Key: "mock-key",
	})
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	testIdempKey := "sha256-finance-tx-5511999999999-msg002"
	ctx := context.WithValue(context.Background(), "idempotency_key", testIdempKey)

	concurrency := 10
	var wg sync.WaitGroup
	wg.Add(concurrency)

	for i := 0; i < concurrency; i++ {
		go func(goroutineID int) {
			defer wg.Done()
			res, err := client.RegistrarTransacaoComRateioRPC(ctx, map[string]interface{}{
				"propriedade_id": 5,
				"tipo":           "DESPESA",
				"valor_total":    1500.0,
				"categoria_id":   "cat-uuid-01",
			})

			if err != nil {
				t.Errorf("goroutine %d failed: %v", goroutineID, err)
				return
			}

			status, _ := res["status"].(string)
			if status != "success" && status != "already_processed" {
				t.Errorf("goroutine %d received unexpected status: %s", goroutineID, status)
			}
		}(i)
	}

	wg.Wait()

	if atomic.LoadInt32(&insertCount) != 1 {
		t.Errorf("Expected exactly 1 insert, but got %d", insertCount)
	}
	if atomic.LoadInt32(&alreadyProcessedCount) != int32(concurrency-1) {
		t.Errorf("Expected %d already_processed responses, but got %d", concurrency-1, alreadyProcessedCount)
	}
}

func TestIdempotencyCota_ConcurrentRequests(t *testing.T) {
	var insertCount int32
	seenKeys := sync.Map{}

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/v1/insumos_proibidos" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}

		time.Sleep(5 * time.Millisecond)

		if r.URL.Path == "/rest/v1/cotas_produtores" {
			var reqBody map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&reqBody)

			idempKey := r.Header.Get("Idempotency-Key")
			if idempKey == "" {
				if k, ok := reqBody["idempotency_key"].(string); ok {
					idempKey = k
				}
			}

			if idempKey != "" {
				if _, exists := seenKeys.LoadOrStore(idempKey, true); exists {
					w.WriteHeader(http.StatusConflict)
					w.Write([]byte(`{"code": "23505", "message": "duplicate key value violates unique constraint idx_cotas_produtores_idempotency_key"}`))
					return
				}
			}

			atomic.AddInt32(&insertCount, 1)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{"id": "cota-uuid-111"},
			})
			return
		}

		if r.URL.Path == "/rest/v1/cronograma_plantio" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{"id": "crono-uuid-222"},
			})
			return
		}
	}))
	defer mockServer.Close()

	client, err := supabase.NewClient(supabase.Config{
		URL: mockServer.URL,
		Key: "mock-key",
	})
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	testIdempKey := "sha256-cota-5511999999999-msg003"
	ctx := context.WithValue(context.Background(), "idempotency_key", testIdempKey)

	concurrency := 10
	var wg sync.WaitGroup
	wg.Add(concurrency)

	for i := 0; i < concurrency; i++ {
		go func(goroutineID int) {
			defer wg.Done()
			err := client.RegistrarCotaComCronograma(ctx, map[string]interface{}{
				"demanda_id":     "demanda-uuid-1",
				"propriedade_id": int64(10),
				"usuario_id":     "user-uuid-1",
				"quantidade":     500.0,
				"data_plantio":   "2026-09-01",
			})

			if err != nil {
				t.Errorf("goroutine %d failed unexpectedly: %v", goroutineID, err)
			}
		}(i)
	}

	wg.Wait()

	if atomic.LoadInt32(&insertCount) != 1 {
		t.Errorf("Expected exactly 1 insert, but got %d", insertCount)
	}
}
