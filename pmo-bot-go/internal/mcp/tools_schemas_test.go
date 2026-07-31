package mcp

import (
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestRegistrarColheitaSchema_NoSensitiveFields
// CRÍTICO: Garante que schema NÃO expõe IDs ao LLM
func TestRegistrarColheitaSchema_NoSensitiveFields(t *testing.T) {
	typ := reflect.TypeOf(RegistrarColheitaSchema{})
	
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		jsonTag := field.Tag.Get("json")
		
		assert.False(t, strings.Contains(jsonTag, "pmo_id"), "pmo_id não deve estar no schema")
		assert.False(t, strings.Contains(jsonTag, "propriedade_id"), "propriedade_id não deve estar no schema")
		assert.False(t, strings.Contains(jsonTag, "user_id"), "user_id não deve estar no schema")
	}
}


