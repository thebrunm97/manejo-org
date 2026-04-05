package mcp

import (
	"encoding/json"
	"testing"

	"github.com/google/generative-ai-go/genai"
)

func TestMapToGenaiSchema(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		isRoot   bool
		validate func(*testing.T, *genai.Schema)
	}{
		{
			name:   "Root Tool with No Parameters (Empty Object)",
			isRoot: true,
			input:  map[string]interface{}{},
			validate: func(t *testing.T, s *genai.Schema) {
				if s.Type != genai.TypeObject {
					t.Errorf("expected root type Object, got %v", s.Type)
				}
				if _, ok := s.Properties["_dummy"]; !ok {
					t.Errorf("expected _dummy property injection for empty root")
				}
			},
		},
		{
			name:   "Enum Sanitize to String",
			isRoot: false,
			input: map[string]interface{}{
				"type":        "string",
				"description": "Some enum",
				"enum":        []interface{}{"Value1", 2, true},
			},
			validate: func(t *testing.T, s *genai.Schema) {
				if s.Type != genai.TypeString {
					t.Errorf("expected enum type String, got %v", s.Type)
				}
				if len(s.Enum) != 3 {
					t.Errorf("expected 3 enum values, got %d", len(s.Enum))
				}
				if s.Enum[1] != "2" || s.Enum[2] != "true" {
					t.Errorf("expected str cast '2' and 'true', got %s, %s", s.Enum[1], s.Enum[2])
				}
			},
		},
		{
			name:   "Required Fields Parsing",
			isRoot: true,
			input: map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"field1", "field2"},
				"properties": map[string]interface{}{
					"field1": map[string]interface{}{"type": "string"},
					"field2": map[string]interface{}{"type": "integer"},
				},
			},
			validate: func(t *testing.T, s *genai.Schema) {
				if len(s.Required) != 2 {
					t.Errorf("expected 2 required fields, got %d", len(s.Required))
				}
			},
		},
		{
			name:   "Array Falback Items",
			isRoot: false,
			input: map[string]interface{}{
				"type": "array",
			},
			validate: func(t *testing.T, s *genai.Schema) {
				if s.Type != genai.TypeArray {
					t.Errorf("expected Array type, got %v", s.Type)
				}
				if s.Items == nil {
					t.Errorf("expected fallback Items but got nil")
				} else if s.Items.Type != genai.TypeString {
					t.Errorf("expected fallback Items type String, got %v", s.Items.Type)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := mapToGenaiSchema(tt.input, tt.isRoot)
			
			// Optional: print marshalled to verify panic safety
			_, err := json.Marshal(result)
			if err != nil {
				t.Fatalf("failed to marshal resulting schema: %v", err)
			}
			
			tt.validate(t, result)
		})
	}
}
