package memory

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

func setupTestRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}

	client := redis.NewClient(&redis.Options{
		Addr:         mr.Addr(),
		MaxRetries:   0,
		DialTimeout:  50 * time.Millisecond,
		ReadTimeout:  50 * time.Millisecond,
		WriteTimeout: 50 * time.Millisecond,
	})
	return mr, client
}

func TestTenantIsolation(t *testing.T) {
	mr, rdb := setupTestRedis(t)
	defer mr.Close()
	defer rdb.Close()

	svc := NewService(rdb, nil)
	ctx := context.Background()

	pmo1 := int64(1)
	pmo2 := int64(2)

	// Write for PMO 1 (assíncrono) - texto gerará score de 0.45 para não ser podado e não chamar Supabase (score < 0.7)
	// Keywords: "plantio", "semente", "adubo" (3 hits)
	svc.WriteFragmentAsync(ctx, pmo1, "user-1", "plantio semente adubo", "text_message")

	// Write for PMO 2 (assíncrono)
	// Keywords: "colheita", "praga", "fungo" (3 hits)
	svc.WriteFragmentAsync(ctx, pmo2, "user-2", "colheita praga fungo", "text_message")

	// Aguarda goroutines de escrita concluírem
	time.Sleep(1 * time.Second)

	// Verify PMO 1 can't see PMO 2
	recent1, err := svc.readFromRedisRecent(ctx, pmo1, 5)
	if err != nil {
		t.Fatalf("readFromRedisRecent failed: %v", err)
	}
	if len(recent1) != 1 || recent1[0].Fragment != "plantio semente adubo" {
		t.Errorf("Expected 1 recent fragment for pmo1, got %v", recent1)
	}

	scored2, err := svc.readFromRedisScoredTop(ctx, pmo2, 5)
	if err != nil {
		t.Fatalf("readFromRedisScoredTop failed: %v", err)
	}
	if len(scored2) != 1 || scored2[0].Fragment != "colheita praga fungo" {
		t.Errorf("Expected 1 scored fragment for pmo2, got %v", scored2)
	}
}

func TestZSETPruning(t *testing.T) {
	mr, rdb := setupTestRedis(t)
	defer mr.Close()
	defer rdb.Close()

	svc := NewService(rdb, nil)
	ctx := context.Background()
	pmoID := int64(42)

	// Insert 55 fragments com scores crescentes
	// Isso garante que os de menor score (0.500 a 0.504) serão podados
	var lastID string
	for i := 0; i < 55; i++ {
		f := ports.MemoryFragment{
			ID:              fmt.Sprintf("uuid-%d", i),
			Fragment:        fmt.Sprintf("Fragmento %d", i),
			ImportanceScore: 0.5 + float64(i)*0.001, // Scores: 0.500 até 0.554
			CreatedAt:       time.Now(),
		}
		svc.writeToRedis(ctx, pmoID, f)
		lastID = f.ID
	}

	// Verifica cardinalidade real no Redis
	zkey := fmt.Sprintf("memory:%d:scored", pmoID)
	card, err := rdb.ZCard(ctx, zkey).Result()
	if err != nil {
		t.Fatalf("ZCard failed: %v", err)
	}

	if card != 50 {
		t.Errorf("Expected exactly 50 elements in ZSET after pruning, got %d", card)
	}

	// Verifica os hash keys órfãos
	// Miniredis permite iterar por todas as keys
	allKeys := mr.Keys()
	hashCount := 0
	for _, k := range allKeys {
		if strings.Contains(k, fmt.Sprintf("memory:%d:frag:", pmoID)) {
			hashCount++
		}
	}

	if hashCount != 50 {
		t.Errorf("Expected exactly 50 hash keys (orphan cleanup), got %d", hashCount)
	}

	// Verifica explicitamente que o menor score (uuid-0) foi deletado e o maior (uuid-54) sobreviveu
	if rdb.HExists(ctx, fmt.Sprintf("memory:%d:frag:uuid-0", pmoID), "score").Val() {
		t.Errorf("O item de menor score (uuid-0) não foi podado")
	}
	if !rdb.HExists(ctx, fmt.Sprintf("memory:%d:frag:%s", pmoID, lastID), "score").Val() {
		t.Errorf("O item de maior score (%s) foi podado incorretamente", lastID)
	}
}

func TestRedisDownGracefulDegradation(t *testing.T) {
	// Setup with a closed miniredis
	mr, rdb := setupTestRedis(t)
	mr.Close() // Fecha para forçar erros de conexão

	svc := NewService(rdb, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	pmoID := int64(99)
	f := ports.MemoryFragment{
		ID:              uuid.New().String(),
		Fragment:        "Teste Graceful Degradation",
		ImportanceScore: 0.8,
	}

	// 1. writeToRedis não deve entrar em panic, apenas logar erro silenciosamente
	done := make(chan struct{})
	go func() {
		svc.writeToRedis(ctx, pmoID, f)
		close(done)
	}()

	select {
	case <-done:
		// Success, no panic, e retorna imediatamente (já que MaxRetries=0 a falha é instantânea)
	case <-time.After(1 * time.Second):
		t.Fatal("writeToRedis hang ou deadlock com Redis offline (não falhou rápido como esperado)")
	}

	// 2. readFromRedisRecent e readFromRedisScoredTop devem retornar erro graciosamente
	recent, err := svc.readFromRedisRecent(ctx, pmoID, 3)
	if err == nil {
		t.Error("Expected error from readFromRedisRecent when Redis is down")
	}
	if len(recent) > 0 {
		t.Error("Expected 0 results when Redis is down")
	}

	scored, err := svc.readFromRedisScoredTop(ctx, pmoID, 5)
	if err == nil {
		t.Error("Expected error from readFromRedisScoredTop when Redis is down")
	}
	if len(scored) > 0 {
		t.Error("Expected 0 results when Redis is down")
	}
}


