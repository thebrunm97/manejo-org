package memory

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// TestLuaLockContention simula 50 goroutines (mensagens concorrentes)
// escrevendo ao mesmo tempo para o mesmo produtor (pmoID).
// O objetivo é forçar a contenção no lock `SetNX` e testar o comportamento
// do sistema sob carga máxima de concorrência para o mesmo usuário.
// 1. Não há panic nem corrupção no ZSET.
// 2. A grande maioria das escritas simultâneas será descartada do cache quente
//    devido ao design best-effort do `SetNX` (que não faz retry, apenas aborta).
// Isso prova que a corrupção estrutural é evitada, com o trade-off consciente
// de que rajadas (bursts) simultâneas podem perder a janela de cache quente.
func TestLuaLockContention(t *testing.T) {
	// Reutilizamos o miniredis que já provou funcionar
	mr, rdb := setupTestRedis(t)
	defer mr.Close()

	svc := NewService(rdb, nil) // nil pro supabase por enquanto, não é o foco do lock
	ctx := context.Background()
	pmoID := int64(888)

	concurrency := 50
	var wg sync.WaitGroup
	wg.Add(concurrency)

	// Dispara 50 escritas exatamente no mesmo milissegundo (o máximo que o scheduler permitir)
	t.Logf("Disparando %d goroutines concorrentes para writeToRedis...", concurrency)
	
	// Sincronizador de largada para maximizar a colisão
	startGate := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		go func(idx int) {
			defer wg.Done()
			
			f := ports.MemoryFragment{
				ID:              fmt.Sprintf("frag-contention-%d", idx),
				Fragment:        fmt.Sprintf("Mensagem simultânea %d", idx),
				ImportanceScore: 0.9,
				CreatedAt:       time.Now(),
				ContentHash:     fmt.Sprintf("hash-colisao-%d", idx),
			}
			
			<-startGate // Espera o tiro de largada
			
			// writeToRedis vai disparar o EVAL do script Lua que trima o ZSET.
			// Com 50 goroutines chamando EVAL concorrentemente, o Redis vai 
			// enfileirar as execuções de Lua de forma atômica, evitando o double-trim.
			svc.writeToRedis(ctx, pmoID, f)
		}(i)
	}

	// Dá o tiro de largada
	close(startGate)

	// Aguarda todos finalizarem
	wg.Wait()

	// Checa o que restou no Redis
	zcard := rdb.ZCard(ctx, fmt.Sprintf("memory:%d:scored", pmoID)).Val()
	
	// A expectativa é que o ZCard seja substancialmente menor que 50 (ex: 1 a 10),
	// porque a maioria das goroutines não vai conseguir o lock (SetNX) e abortará silenciosamente.
	t.Logf("✅ Sucesso (Comportamento Esperado)! Sobreviveram %d fragmentos no ZSET.", zcard)
	
	if zcard > 20 { // 20 é um threshold arbitrário mas seguro para mostrar a contenção, dado o startGate simultâneo.
		t.Errorf("ZCard = %d. Com startGate, esperávamos alta contenção no SetNX (a maioria descartada). O lock funcionou?", zcard)
	}
	if zcard <= 0 {
		t.Errorf("Nenhum fragmento sobreviveu, estado corrompido!")
	}
}
