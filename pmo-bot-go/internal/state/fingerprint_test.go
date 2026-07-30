package state

import (
	"encoding/json"
	"testing"
)

func TestJSONMarshalStability(t *testing.T) {
	// Create two maps with identical keys/values but populated in different orders
	m1 := map[string]interface{}{
		"b": 2,
		"a": 1,
		"c": 3,
	}

	m2 := map[string]interface{}{
		"c": 3,
		"b": 2,
		"a": 1,
	}

	b1, err1 := json.Marshal(m1)
	if err1 != nil {
		t.Fatalf("Failed to marshal m1: %v", err1)
	}

	b2, err2 := json.Marshal(m2)
	if err2 != nil {
		t.Fatalf("Failed to marshal m2: %v", err2)
	}

	if string(b1) != string(b2) {
		t.Errorf("Fingerprints differ! \\nb1: %s \\nb2: %s", string(b1), string(b2))
	} else {
		t.Logf("Stability confirmed: %s", string(b1))
	}
}
