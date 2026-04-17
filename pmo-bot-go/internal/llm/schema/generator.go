package schema

import (
	"encoding/json"
	"fmt"

	"github.com/go-playground/validator/v10"
	"github.com/invopop/jsonschema"
	"google.golang.org/genai"
)

var validate = validator.New()

// Reflect generates a JSON Schema (Draft 2020-12) from a Go struct.
// It is configured to produce a flat, inline schema without $defs or $refs,
// which is more compatible with LLM providers.
func Reflect[T any]() ([]byte, error) {
	var target T
	reflector := &jsonschema.Reflector{
		RequiredFromJSONSchemaTags: true,
		DoNotReference:             true,
		ExpandedStruct:             true,
	}
	schema := reflector.Reflect(&target)
	return json.Marshal(schema)
}

// ForOpenRouter wraps the JSON schema into the OpenAI-compatible response_format envelope.
// It forces strict: true and additionalProperties: false for reliable structured output.
func ForOpenRouter(jsonBytes []byte, name string) (map[string]any, error) {
	var schemaMap map[string]any
	if err := json.Unmarshal(jsonBytes, &schemaMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema for openrouter: %w", err)
	}

	// OpenAI 'strict' mode requires additionalProperties: false in all objects.
	applyStrict(schemaMap)

	return map[string]any{
		"type": "json_schema",
		"json_schema": map[string]any{
			"name":   name,
			"strict": true,
			"schema": schemaMap,
		},
	}, nil
}

// ForGoogle converts the JSON schema bytes into a *genai.Schema.
func ForGoogle(jsonBytes []byte) (*genai.Schema, error) {
	// Strategy: Try direct unmarshal first as suggested.
	// The genai.Schema struct fields match standard JSON Schema keys.
	var s genai.Schema
	if err := json.Unmarshal(jsonBytes, &s); err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema for google: %w", err)
	}

	// Gemini often requires TypeObject at the root.
	if s.Type == "" {
		s.Type = genai.TypeObject
	}
	
	// Gemini specific tweaks can be added here (e.g., removing unsupported keywords).
	// For now, we trust the direct unmarshal.
	return &s, nil
}

// DecodeAndValidate unmarshals a raw JSON string from an LLM and validates
// it against the struct's business rules (validator/v10 tags).
func DecodeAndValidate[T any](rawJSON string) (T, error) {
	var result T
	if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
		return result, fmt.Errorf("unmarshal error: %w", err)
	}

	if err := validate.Struct(result); err != nil {
		return result, fmt.Errorf("validation error: %w", err)
	}

	return result, nil
}

// applyStrict recursively adds additionalProperties: false to all object-type nodes.
// required for OpenAI/OpenRouter strict mode.
func applyStrict(m map[string]any) {
	t, ok := m["type"].(string)
	if !ok {
		// If no type is specified but it has properties, it's likely an object
		if _, hasProps := m["properties"]; hasProps {
			t = "object"
		}
	}

	if t == "object" {
		m["additionalProperties"] = false
		if props, ok := m["properties"].(map[string]any); ok {
			for _, v := range props {
				if propMap, ok := v.(map[string]any); ok {
					applyStrict(propMap)
				}
			}
		}
	} else if t == "array" {
		if items, ok := m["items"].(map[string]any); ok {
			applyStrict(items)
		}
	}
}
