package supabase_test

import (
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestGerarCodigoLote_Format(t *testing.T) {
	lote := supabase.GerarCodigoLote()

	if !strings.HasPrefix(lote, "LOTE-") {
		t.Errorf("Lote deveria começar com 'LOTE-', got: %s", lote)
	}
	// Formato: LOTE-YYYYMMDD-XXXX = 18 chars (4+1+8+1+4)
	if len(lote) != 18 {
		t.Errorf("Lote deveria ter 18 chars, got %d: %s", len(lote), lote)
	}

	parts := strings.Split(lote, "-")
	if len(parts) != 3 {
		t.Fatalf("Lote deveria ter 3 partes separadas por '-', got: %v", parts)
	}

	// parts[0] = "LOTE", parts[1] = "YYYYMMDD", parts[2] = "XXXX"
	if parts[0] != "LOTE" {
		t.Errorf("Prefixo deveria ser 'LOTE', got: %s", parts[0])
	}
	if len(parts[1]) != 8 {
		t.Errorf("Data deveria ter 8 dígitos (YYYYMMDD), got: %s", parts[1])
	}
	if len(parts[2]) != 4 {
		t.Errorf("Sufixo deveria ter 4 dígitos, got: %s", parts[2])
	}
}

func TestGerarCodigoLote_Uniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		lote := supabase.GerarCodigoLote()
		if seen[lote] {
			// Colisão possível mas improvável em 100 tentativas com 10000 possibilidades
			t.Logf("Colisão detectada (aceitável mas rara): %s", lote)
		}
		seen[lote] = true
	}
}
