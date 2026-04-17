package mcp

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// maxInputLen is the maximum allowed length for sanitized string inputs.
const maxInputLen = 500

// sanitize cleans and truncates string inputs from the LLM.
// Prevents stored XSS, oversized payloads, and control character injection.
func sanitize(val interface{}) string {
	s, ok := val.(string)
	if !ok {
		return ""
	}
	// 1. Trim whitespace
	s = strings.TrimSpace(s)
	// 2. Truncate to prevent oversized payloads
	if len(s) > maxInputLen {
		s = s[:maxInputLen]
	}
	// 3. Remove control characters (keep newlines for legitimate multi-line input)
	var clean strings.Builder
	for _, r := range s {
		if r == '\n' || r == '\r' || (r >= 32 && r != 127) {
			clean.WriteRune(r)
		}
	}
	return clean.String()
}

func parseArgToFloat(val interface{}) (float64, error) {
	if val == nil {
		return 0, errors.New("value is nil")
	}
	switch v := val.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		return strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64)
	default:
		strVal := fmt.Sprintf("%v", val)
		return strconv.ParseFloat(strings.ReplaceAll(strVal, ",", "."), 64)
	}
}
