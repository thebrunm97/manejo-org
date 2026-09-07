package memory

import (
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// deduplicateByHash remove duplicatas preservando a ordem da primeira ocorrência.
func deduplicateByHash(frags []ports.MemoryFragment) []ports.MemoryFragment {
	seen := make(map[string]bool, len(frags))
	result := make([]ports.MemoryFragment, 0, len(frags))
	for _, f := range frags {
		key := f.ContentHash
		if key == "" {
			key = f.ID
		}
		if !seen[key] {
			seen[key] = true
			result = append(result, f)
		}
	}
	return result
}

// mergeDedup combina fragmentos recentes e ranqueados:
// 1. Dá prioridade aos recentes (contexto temporal imediato).
// 2. Complementa com os de maior score do ZSET que não estejam em 'recent'.
// 3. Em caso de colisão de ContentHash, mantém o fragmento recente (timestamp mais fresco),
//    mas eleva seu ImportanceScore para o maior entre os dois.
func mergeDedup(recent, scored []ports.MemoryFragment, maxTotal int) []ports.MemoryFragment {
	seen := make(map[string]int, maxTotal) // content_hash -> índice em result
	result := make([]ports.MemoryFragment, 0, maxTotal)

	for _, f := range recent {
		key := f.ContentHash
		if key == "" {
			key = f.ID
		}
		if _, exists := seen[key]; !exists {
			seen[key] = len(result)
			result = append(result, f)
			if len(result) >= maxTotal {
				return result
			}
		}
	}

	for _, f := range scored {
		key := f.ContentHash
		if key == "" {
			key = f.ID
		}
		if idx, exists := seen[key]; exists {
			if f.ImportanceScore > result[idx].ImportanceScore {
				result[idx].ImportanceScore = f.ImportanceScore
			}
			continue
		}
		seen[key] = len(result)
		result = append(result, f)
		if len(result) >= maxTotal {
			break
		}
	}
	return result
}
