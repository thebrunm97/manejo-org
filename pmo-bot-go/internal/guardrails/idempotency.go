package guardrails

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// NormalizeCanonicalJSON converts an arbitrary JSON-compatible map or value
// into a deterministic canonical representation (sorted keys, trimmed strings).
func NormalizeCanonicalJSON(v interface{}) ([]byte, error) {
	canonical := canonicalize(v)
	return json.Marshal(canonical)
}

func canonicalize(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		// Extract and sort keys to guarantee deterministic order
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		ordered := make([]canonicalKVPair, 0, len(keys))
		for _, k := range keys {
			ordered = append(ordered, canonicalKVPair{
				Key:   k,
				Value: canonicalize(val[k]),
			})
		}
		return ordered

	case []interface{}:
		res := make([]interface{}, len(val))
		for i, item := range val {
			res[i] = canonicalize(item)
		}
		return res

	case string:
		return strings.TrimSpace(val)

	default:
		return val
	}
}

type canonicalKVPair struct {
	Key   string      `json:"k"`
	Value interface{} `json:"v"`
}

// GenerateIdempotencyKey generates a collision-free, stable SHA256 key for a specific tool call.
// Formula: SHA256(phone + ":" + message_id + ":" + tool_name + ":" + canonical_args_json + ":" + occurrence_index)
func GenerateIdempotencyKey(phone, messageID, toolName string, args map[string]interface{}, occurrenceIndex int) (string, error) {
	canonicalJSON, err := NormalizeCanonicalJSON(args)
	if err != nil {
		return "", fmt.Errorf("canonicalize args: %w", err)
	}

	rawString := fmt.Sprintf("%s:%s:%s:%s:%d",
		strings.TrimSpace(phone),
		strings.TrimSpace(messageID),
		strings.TrimSpace(toolName),
		string(canonicalJSON),
		occurrenceIndex,
	)

	hash := sha256.Sum256([]byte(rawString))
	return hex.EncodeToString(hash[:]), nil
}
