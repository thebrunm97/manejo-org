package schema

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockSubStruct for testing nested schemas
type MockSubStruct struct {
	Detail string `json:"detail" jsonschema:"description=A detail field,required" validate:"required"`
}

// MockIntent for testing the schema generator
type MockIntent struct {
	Intent     string        `json:"intent" jsonschema:"enum=DATABASE,enum=RAG,enum=CHAT,required" validate:"required,oneof=DATABASE RAG CHAT"`
	Confidence float64       `json:"confidence" jsonschema:"minimum=0,maximum=1,required" validate:"required,gte=0,lte=1"`
	Metadata   MockSubStruct `json:"metadata" jsonschema:"required" validate:"required"`
}

func TestReflect(t *testing.T) {
	bytes, err := Reflect[MockIntent]()
	require.NoError(t, err)
	require.NotNil(t, bytes)

	var m map[string]interface{}
	err = json.Unmarshal(bytes, &m)
	require.NoError(t, err)

	assert.Equal(t, "object", m["type"])
	assert.Contains(t, m["required"], "intent")
	assert.Contains(t, m["required"], "confidence")
	assert.Contains(t, m["required"], "metadata")

	properties := m["properties"].(map[string]interface{})
	assert.Contains(t, properties, "intent")
	assert.Contains(t, properties, "confidence")
	assert.Contains(t, properties, "metadata")
}

func TestForOpenRouter(t *testing.T) {
	bytes, _ := Reflect[MockIntent]()
	envelope, err := ForOpenRouter(bytes, "MockIntent")
	require.NoError(t, err)

	assert.Equal(t, "json_schema", envelope["type"])
	js := envelope["json_schema"].(map[string]any)
	assert.Equal(t, "MockIntent", js["name"])
	assert.True(t, js["strict"].(bool))

	schema := js["schema"].(map[string]any)
	assert.False(t, schema["additionalProperties"].(bool))

	// Check nested additionalProperties
	properties := schema["properties"].(map[string]any)
	metadata := properties["metadata"].(map[string]any)
	assert.False(t, metadata["additionalProperties"].(bool))
}

func TestForGoogle(t *testing.T) {
	bytes, _ := Reflect[MockIntent]()
	s, err := ForGoogle(bytes)
	require.NoError(t, err)
	require.NotNil(t, s)

	// In genai.Schema, Type is an enum/string wrapper
	assert.NotEmpty(t, s.Type)
	assert.Contains(t, s.Required, "intent")
	assert.NotNil(t, s.Properties["metadata"])
}

func TestDecodeAndValidate(t *testing.T) {
	t.Run("Valid JSON", func(t *testing.T) {
		raw := `{"intent": "DATABASE", "confidence": 0.95, "metadata": {"detail": "all good"}}`
		result, err := DecodeAndValidate[MockIntent](raw)
		require.NoError(t, err)
		assert.Equal(t, "DATABASE", result.Intent)
		assert.Equal(t, 0.95, result.Confidence)
		assert.Equal(t, "all good", result.Metadata.Detail)
	})

	t.Run("Invalid Intent (Enums)", func(t *testing.T) {
		raw := `{"intent": "HACK", "confidence": 0.95, "metadata": {"detail": "bad"}}`
		_, err := DecodeAndValidate[MockIntent](raw)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "validation error")
	})

	t.Run("Invalid Confidence (Bounds)", func(t *testing.T) {
		raw := `{"intent": "DATABASE", "confidence": 1.5, "metadata": {"detail": "bad"}}`
		_, err := DecodeAndValidate[MockIntent](raw)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "validation error")
	})

	t.Run("Missing Required Field", func(t *testing.T) {
		raw := `{"intent": "DATABASE", "confidence": 0.9}`
		_, err := DecodeAndValidate[MockIntent](raw)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "validation error")
	})
}
