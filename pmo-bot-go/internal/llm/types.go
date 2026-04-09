// Package llm defines provider-agnostic types and adapters for LLM tool calling.
// This is the single source of truth for tool definitions in the system.
// Adapters convert the canonical FerramentaAgnostica into provider-specific
// formats without any provider SDK leaking into business logic.
package llm

import (
	"encoding/json"

	openai "github.com/sashabaranov/go-openai"
	genai "google.golang.org/genai"
)

// FerramentaAgnostica is the canonical, provider-agnostic representation of an
// LLM tool (function). It is the single source of truth — all provider-specific
// formats are derived from it via adapter methods.
//
// Parameters must follow the JSON Schema object format, e.g.:
//
//	map[string]interface{}{
//	    "type": "object",
//	    "properties": map[string]interface{}{...},
//	    "required": []string{...},
//	}
type FerramentaAgnostica struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ─── OpenRouter / OpenAI Adapter ─────────────────────────────────────────────

// ParaOpenRouter converts the canonical tool definition into an openai.Tool,
// ready to be sent to any OpenAI-compatible API (OpenRouter, OpenAI, etc.).
//
// Strategy: We serialize Parameters to raw JSON and embed it directly as the
// function's parameters. This avoids brittle manual mapping from
// map[string]interface{} to jsonschema structs, while still producing a
// perfectly valid Function Calling payload. The OpenAI SDK accepts
// json.RawMessage for Parameters.
func (f FerramentaAgnostica) ParaOpenRouter() openai.Tool {
	rawParams, err := json.Marshal(f.Parameters)
	if err != nil {
		// Fallback to empty object schema on serialization error.
		rawParams = []byte(`{"type":"object","properties":{}}`)
	}

	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        f.Name,
			Description: f.Description,
			Parameters:  json.RawMessage(rawParams),
		},
	}
}

// ─── Google Gemini Adapter ────────────────────────────────────────────────────

// ParaGoogle converts the canonical tool definition into a *genai.Tool,
// ready to be passed to the Google GenAI SDK.
//
// Strategy: We recursively convert the Parameters map into a *genai.Schema.
// This is necessary because the Google SDK requires strongly-typed schemas
// (TypeObject, TypeString, etc.) for Function Calling, unlike OpenAI which
// accepts raw JSON. The mapToGenaiSchema helper handles the recursive walk.
func (f FerramentaAgnostica) ParaGoogle() *genai.Tool {
	return &genai.Tool{
		FunctionDeclarations: []*genai.FunctionDeclaration{
			{
				Name:        f.Name,
				Description: f.Description,
				Parameters:  mapToGenaiSchema(f.Parameters, true),
			},
		},
	}
}

// mapToGenaiSchema recursively converts a JSON-Schema-style map into a
// *genai.Schema. This is the core of the Google adapter.
//
// isRoot should be true only for the top-level Parameters object,
// which is always forced to TypeObject per Gemini's requirements.
func mapToGenaiSchema(m map[string]interface{}, isRoot bool) *genai.Schema {
	if m == nil {
		m = make(map[string]interface{})
	}

	s := &genai.Schema{}

	// Force TypeObject for the root parameters node.
	if isRoot {
		s.Type = genai.TypeObject
	} else if pType, ok := m["type"].(string); ok {
		switch pType {
		case "integer":
			s.Type = genai.TypeInteger
		case "number":
			s.Type = genai.TypeNumber
		case "boolean":
			s.Type = genai.TypeBoolean
		case "string":
			s.Type = genai.TypeString
		case "object":
			s.Type = genai.TypeObject
		case "array":
			s.Type = genai.TypeArray
		default:
			s.Type = genai.TypeString
		}
	} else {
		s.Type = genai.TypeString
	}

	if desc, ok := m["description"].(string); ok {
		s.Description = desc
	}

	// Enum handling: forces TypeString and populates the enum list.
	if enumVal, exists := m["enum"]; exists {
		s.Type = genai.TypeString
		var items []string
		switch v := enumVal.(type) {
		case []string:
			items = v
		case []interface{}:
			for _, item := range v {
				items = append(items, toString(item))
			}
		}
		s.Enum = items
	}

	// Object: recurse into properties and map required fields.
	if s.Type == genai.TypeObject {
		s.Properties = make(map[string]*genai.Schema)
		if props, ok := m["properties"].(map[string]interface{}); ok {
			for k, v := range props {
				if propMap, ok := v.(map[string]interface{}); ok {
					s.Properties[k] = mapToGenaiSchema(propMap, false)
				}
			}
		}

		if reqVal, exists := m["required"]; exists {
			var required []string
			switch r := reqVal.(type) {
			case []string:
				required = r
			case []interface{}:
				for _, item := range r {
					required = append(required, toString(item))
				}
			}
			s.Required = required
		}

		// Gemini requires at least one property on object schemas.
		if isRoot && len(s.Properties) == 0 {
			s.Properties["_unused"] = &genai.Schema{
				Type:        genai.TypeString,
				Description: "Placeholder — tool takes no parameters.",
			}
		}
	}

	// Array: recurse into items schema.
	if s.Type == genai.TypeArray {
		if itemsVal, exists := m["items"]; exists {
			if itemsMap, ok := itemsVal.(map[string]interface{}); ok {
				s.Items = mapToGenaiSchema(itemsMap, false)
			}
		}
		if s.Items == nil {
			s.Items = &genai.Schema{Type: genai.TypeString}
		}
	}

	return s
}

// toString safely converts an interface{} to its string representation.
func toString(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	b, _ := json.Marshal(v)
	return string(b)
}

// ─── Agnostic Memory ─────────────────────────────────────────────────────────

// Papel represents the role of a message in a conversation.
type Papel string

const (
	PapelSystem    Papel = "system"
	PapelUser      Papel = "user"
	PapelAssistant Papel = "assistant"
	PapelTool      Papel = "tool"
)

// ChamadaFerramentaAgnostica represents a tool call initiated by the LLM.
type ChamadaFerramentaAgnostica struct {
	ID   string                 `json:"id"`
	Nome string                 `json:"nome"`
	Args map[string]interface{} `json:"args"`
}

// MensagemAgnostica is a provider-neutral representation of a message in a conversation.
type MensagemAgnostica struct {
	Role      Papel                        `json:"role"`
	Content   string                       `json:"content"`
	ToolCalls []ChamadaFerramentaAgnostica `json:"tool_calls,omitempty"`
	ToolID    string                       `json:"tool_id,omitempty"` // Identificador da chamada (OpenRouter) ou Nome da tool (Google)
}

// ParaGoogleHistory converts agnostic messages to Gemini's genai.Content format.
func ParaGoogleHistory(history []MensagemAgnostica) []*genai.Content {
	var contents []*genai.Content
	for _, m := range history {
		role := string(m.Role)
		if m.Role == PapelAssistant {
			role = "model"
		} else if m.Role == PapelSystem {
			role = "user" // Fallback: Gemini trata system instruction separadamente no config
		}

		content := &genai.Content{
			Role: role,
		}

		if m.Content != "" {
			content.Parts = append(content.Parts, &genai.Part{Text: m.Content})
		}

		// Tool Calls (Model -> Client)
		for _, tc := range m.ToolCalls {
			content.Parts = append(content.Parts, &genai.Part{
				FunctionCall: &genai.FunctionCall{
					Name: tc.Nome,
					Args: tc.Args,
				},
			})
		}

		// Tool Response (Client -> Model) - No Gemini 2.0 SDK, o papel é "tool"
		if m.Role == PapelTool {
			content.Role = "tool"
			content.Parts = []*genai.Part{
				{
					FunctionResponse: &genai.FunctionResponse{
						Name:     m.ToolID, // Nome da função original
						Response: map[string]interface{}{"result": m.Content},
					},
				},
			}
		}

		contents = append(contents, content)
	}
	return contents
}

// ParaOpenRouterHistory converts agnostic messages to OpenAI-compatible ChatCompletionMessage.
func ParaOpenRouterHistory(history []MensagemAgnostica) []openai.ChatCompletionMessage {
	var messages []openai.ChatCompletionMessage
	for _, m := range history {
		msg := openai.ChatCompletionMessage{
			Role:    string(m.Role),
			Content: m.Content,
		}

		// Tool Calls
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, openai.ToolCall{
					ID:   tc.ID,
					Type: openai.ToolTypeFunction,
					Function: openai.FunctionCall{
						Name:      tc.Nome,
						Arguments: marshalArgs(tc.Args),
					},
				})
			}
		}

		// Tool Response
		if m.Role == PapelTool {
			msg.ToolCallID = m.ToolID
		}

		messages = append(messages, msg)
	}
	return messages
}

// marshalArgs helper to convert map to JSON string for OpenAI.
func marshalArgs(args map[string]interface{}) string {
	b, _ := json.Marshal(args)
	return string(b)
}

// ─── Agnostic Response ───────────────────────────────────────────────────────

// UsoMetadados identifies the token usage of a request.
type UsoMetadados struct {
	PromptTokens     int32
	CandidatesTokens int32
	TotalTokens      int32
}

// RespostaAgnostica is a provider-neutral representation of an LLM response.
type RespostaAgnostica struct {
	Texto     string                       `json:"texto"`
	ToolCalls []ChamadaFerramentaAgnostica `json:"tool_calls,omitempty"`
	Usage     UsoMetadados                 `json:"usage"`
	Model     string                       `json:"model"`
	Provider  string                       `json:"provider"` // "google" ou "openrouter"
}
