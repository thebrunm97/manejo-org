package supabase

import (
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

func TestIsProhibitedCheck_PalavraInteira(t *testing.T) {
	c := &Client{}
	for _, n := range []string{"NPK", "Ureia", "Adubo Químico NPK", "MAP", "Sulfato de amônio", "2,4-D", "Glifosato"} {
		c.blacklistCache = append(c.blacklistCache, utils.Normalize(n))
	}

	casos := map[string]bool{
		"NPK":                 true,
		"npk 12-24-12":        true,
		"NPK12-24-12":         true,
		"adubo químico NPK":   true,
		"uréia":               true,
		"sulfato de amonio":   true,
		"MAP":                 true,
		"herbicida 2,4-D":     true,
		"Roundup (glifosato)": true,
		"esterco de galinha":  false,
		"mapa":                false,
		"composto orgânico":   false,
		"fosfato natural":     false,
		"bokashi":             false,
	}
	for entrada, esperado := range casos {
		if got := c.IsProhibitedCheck(entrada); got != esperado {
			t.Errorf("IsProhibitedCheck(%q) = %v, esperado %v", entrada, got, esperado)
		}
	}
}
