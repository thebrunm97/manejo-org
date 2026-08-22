package mcp

import (
	"encoding/json"
	"sort"
	"testing"
)

// DT-33 — instrumento de medição, não asserção de comportamento.
//
// Existe para responder objetivamente "quanto payload vai em cada chamada ao
// LLM?", já que a telemetria mostrou timeout persistindo mesmo após a troca do
// modelo preview pelo GA. Rode com:
//
//	go test ./internal/mcp/ -run PayloadSize -v
func TestPayloadSizePerIntent(t *testing.T) {
	s := NewServer(nil, nil, nil, nil)
	s.InitializeTools()

	total := len(s.tools)
	t.Logf("Ferramentas registradas no total: %d", total)

	for _, intent := range []string{"RAG", "DATABASE", "CHAT"} {
		tools := s.GetToolsForIntent(intent)

		raw, err := json.Marshal(tools)
		if err != nil {
			t.Fatalf("falha ao serializar ferramentas de %s: %v", intent, err)
		}

		// Regra de bolso amplamente usada para estimar tokens em texto/JSON:
		// ~4 bytes por token. Serve para ordem de grandeza, não para cobrança.
		approxTokens := len(raw) / 4

		t.Logf("intent=%-9s ferramentas=%2d/%d  json=%6d bytes  ~%5d tokens (estimativa)",
			intent, len(tools), total, len(raw), approxTokens)
	}
}

// Lista as ferramentas mais caras em bytes: se poucas dominam o payload,
// enxugar as descrições delas rende mais que remover várias pequenas.
func TestPayloadSizeTopOffenders(t *testing.T) {
	s := NewServer(nil, nil, nil, nil)
	s.InitializeTools()

	type entry struct {
		name  string
		bytes int
	}
	var entries []entry

	for _, tool := range s.tools {
		raw, err := json.Marshal(tool.Definition)
		if err != nil {
			continue
		}
		entries = append(entries, entry{tool.Definition.Name, len(raw)})
	}

	sort.Slice(entries, func(i, j int) bool { return entries[i].bytes > entries[j].bytes })

	t.Log("Ferramentas mais pesadas (bytes de definição JSON):")
	limit := 10
	if len(entries) < limit {
		limit = len(entries)
	}
	var sum int
	for _, e := range entries {
		sum += e.bytes
	}
	for i := 0; i < limit; i++ {
		e := entries[i]
		t.Logf("  %2d. %-38s %5d bytes (%.1f%% do total)",
			i+1, e.name, e.bytes, 100*float64(e.bytes)/float64(sum))
	}
	t.Logf("Soma de todas as %d definições: %d bytes", len(entries), sum)
}
