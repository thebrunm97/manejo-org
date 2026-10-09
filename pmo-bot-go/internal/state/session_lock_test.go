package state

import (
	"sync"
	"sync/atomic"
	"testing"
)

// DT-112: a trava serializa a mesma conversa e não deixa entrada no mapa.
func TestLockSession(t *testing.T) {
	var dentro, maxDentro int32
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer lockSession("conv-1")()
			n := atomic.AddInt32(&dentro, 1)
			for {
				m := atomic.LoadInt32(&maxDentro)
				if n <= m || atomic.CompareAndSwapInt32(&maxDentro, m, n) {
					break
				}
			}
			atomic.AddInt32(&dentro, -1)
		}()
	}
	wg.Wait()

	if maxDentro != 1 {
		t.Errorf("%d execuções simultâneas da mesma conversa", maxDentro)
	}
	sessionMapMu.Lock()
	defer sessionMapMu.Unlock()
	if len(sessionLocks) != 0 {
		t.Errorf("mapa de travas ficou com %d entradas", len(sessionLocks))
	}
}
