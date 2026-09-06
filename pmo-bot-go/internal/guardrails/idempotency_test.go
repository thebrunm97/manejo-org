package guardrails_test

import (
	"sync"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
)

func TestCanonicalJSON_Determinism(t *testing.T) {
	// Map 1: keys inserted in one order
	map1 := map[string]interface{}{
		"produto":     "Adubo NPK",
		"valor_total": 450.0,
		"fornecedor":  "Agropecuária Central",
		"detalhes": map[string]interface{}{
			"marca":   "Yara",
			"lote":    "123",
			"origem":  "Nacional",
		},
	}

	// Map 2: identical data but different map construction/order
	map2 := map[string]interface{}{
		"fornecedor":  "Agropecuária Central",
		"detalhes": map[string]interface{}{
			"origem":  "Nacional",
			"marca":   "Yara",
			"lote":    "123",
		},
		"valor_total": 450.0,
		"produto":     "Adubo NPK ", // has trailing space that should be trimmed
	}

	json1, err1 := guardrails.NormalizeCanonicalJSON(map1)
	if err1 != nil {
		t.Fatalf("NormalizeCanonicalJSON map1 failed: %v", err1)
	}

	json2, err2 := guardrails.NormalizeCanonicalJSON(map2)
	if err2 != nil {
		t.Fatalf("NormalizeCanonicalJSON map2 failed: %v", err2)
	}

	if string(json1) != string(json2) {
		t.Errorf("Expected byte-for-byte equality, got:\nJSON 1: %s\nJSON 2: %s", string(json1), string(json2))
	}
}

func TestIdempotencyKey_PermutationInvariance(t *testing.T) {
	phone := "5511999999999"
	messageID := "msg-test-12345"

	// Scenario: Turn 1 produces [Plantio(A), Plantio(A), Despesa(B)]
	turn1Calls := []struct {
		ToolName string
		Args     map[string]interface{}
	}{
		{ToolName: "registrar_plantio", Args: map[string]interface{}{"cultura": "Alface", "qtd": 100.0}},
		{ToolName: "registrar_plantio", Args: map[string]interface{}{"cultura": "Alface", "qtd": 100.0}},
		{ToolName: "registrar_despesa", Args: map[string]interface{}{"valor": 50.0, "desc": "Diesel"}},
	}

	seen1 := make(map[string]int)
	var keys1 []string
	for _, call := range turn1Calls {
		cJSON, _ := guardrails.NormalizeCanonicalJSON(call.Args)
		groupKey := call.ToolName + ":" + string(cJSON)
		occ := seen1[groupKey]
		seen1[groupKey]++

		key, err := guardrails.GenerateIdempotencyKey(phone, messageID, call.ToolName, call.Args, occ)
		if err != nil {
			t.Fatalf("GenerateIdempotencyKey failed: %v", err)
		}
		keys1 = append(keys1, key)
	}

	// Scenario: Retry of the same turn produces [Despesa(B), Plantio(A), Plantio(A)] in a DIFFERENT order
	turn2Calls := []struct {
		ToolName string
		Args     map[string]interface{}
	}{
		{ToolName: "registrar_despesa", Args: map[string]interface{}{"desc": "Diesel", "valor": 50.0}}, // different key order
		{ToolName: "registrar_plantio", Args: map[string]interface{}{"qtd": 100.0, "cultura": "Alface"}},
		{ToolName: "registrar_plantio", Args: map[string]interface{}{"cultura": "Alface", "qtd": 100.0}},
	}

	seen2 := make(map[string]int)
	var keys2 []string
	for _, call := range turn2Calls {
		cJSON, _ := guardrails.NormalizeCanonicalJSON(call.Args)
		groupKey := call.ToolName + ":" + string(cJSON)
		occ := seen2[groupKey]
		seen2[groupKey]++

		key, err := guardrails.GenerateIdempotencyKey(phone, messageID, call.ToolName, call.Args, occ)
		if err != nil {
			t.Fatalf("GenerateIdempotencyKey failed: %v", err)
		}
		keys2 = append(keys2, key)
	}

	// Verify matches:
	// Plantio 1 in Turn 1 (index 0) must equal Plantio 1 in Turn 2 (index 1)
	if keys1[0] != keys2[1] {
		t.Errorf("Plantio 1 key mismatch across retries:\nTurn 1: %s\nTurn 2: %s", keys1[0], keys2[1])
	}

	// Plantio 2 in Turn 1 (index 1) must equal Plantio 2 in Turn 2 (index 2)
	if keys1[1] != keys2[2] {
		t.Errorf("Plantio 2 key mismatch across retries:\nTurn 1: %s\nTurn 2: %s", keys1[1], keys2[2])
	}

	// Despesa in Turn 1 (index 2) must equal Despesa in Turn 2 (index 0)
	if keys1[2] != keys2[0] {
		t.Errorf("Despesa key mismatch across retries:\nTurn 1: %s\nTurn 2: %s", keys1[2], keys2[0])
	}

	// The two identical Plantios in the same turn must have DIFFERENT keys
	if keys1[0] == keys1[1] {
		t.Errorf("Two distinct occurrences in the same turn should have different keys, but both were %s", keys1[0])
	}
}

func TestIdempotencyKey_Concurrency(t *testing.T) {
	// Simulate 100 parallel goroutines generating the key for the same operation
	phone := "5511999999999"
	messageID := "msg-concurrent-999"
	toolName := "registrar_despesa"
	args := map[string]interface{}{
		"valor": 1200.0,
		"item":  "Mudas de Morango",
	}

	var wg sync.WaitGroup
	results := make([]string, 100)

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			key, err := guardrails.GenerateIdempotencyKey(phone, messageID, toolName, args, 0)
			if err != nil {
				t.Errorf("goroutine %d failed: %v", idx, err)
				return
			}
			results[idx] = key
		}(i)
	}

	wg.Wait()

	expected := results[0]
	for i, k := range results {
		if k != expected {
			t.Fatalf("Concurrency race condition detected at index %d: expected %s, got %s", i, expected, k)
		}
	}
}
