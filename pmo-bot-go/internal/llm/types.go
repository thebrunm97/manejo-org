// Package llm defines provider-agnostic types and adapters for LLM tool calling.
// This is the single source of truth for tool definitions in the system.
// Adapters convert the canonical FerramentaAgnostica into provider-specific
// formats without any provider SDK leaking into business logic.
package llm

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/rand"

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
				Parameters:  MapToGenaiSchema(f.Parameters, true),
			},
		},
	}
}

// MapToGenaiSchema recursively converts a JSON-Schema-style map into a
// *genai.Schema. This is the core of the Google adapter.
//
// isRoot should be true only for the top-level Parameters object,
// which is always forced to TypeObject per Gemini's requirements.
func MapToGenaiSchema(m map[string]interface{}, isRoot bool) *genai.Schema {
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
					s.Properties[k] = MapToGenaiSchema(propMap, false)
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
				s.Items = MapToGenaiSchema(itemsMap, false)
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
	Role             Papel                        `json:"role"`
	Content          string                       `json:"content"`
	ToolCalls        []ChamadaFerramentaAgnostica `json:"tool_calls,omitempty"`
	ToolID           string                       `json:"tool_id,omitempty"`   // ID da chamada (OpenRouter) ou Nome da tool (Google)
	ToolName         string                       `json:"tool_name,omitempty"` // Nome da ferramenta para mensagens Tool (exigido pela spec OpenAI)
	ThoughtSignature string                       `json:"thought_signature,omitempty"`
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

		// 1. Thought Signature (mandatory for some Gemini 3.1 models if present)
		if m.ThoughtSignature != "" {
			sig, _ := base64.StdEncoding.DecodeString(m.ThoughtSignature)
			content.Parts = append(content.Parts, &genai.Part{
				ThoughtSignature: sig,
			})
		}

		// 2. Text Content
		if m.Content != "" {
			content.Parts = append(content.Parts, &genai.Part{Text: m.Content})
		}

		// 3. Tool Calls (Model -> Client)
		for _, tc := range m.ToolCalls {
			content.Parts = append(content.Parts, &genai.Part{
				FunctionCall: &genai.FunctionCall{
					Name: tc.Nome,
					Args: tc.Args,
				},
			})
		}

		// Tool Response (Client -> Model) - No Gemini 2.0 SDK, o papel é "tool".
		// CRÍTICO: FunctionResponse.Name deve ser o NOME da função (ex: "consultar_base_conhecimento"),
		// NÃO o ID da chamada (ex: "call_consultar_0_4821"). Usamos ToolName para isso.
		// ToolID é o identificador da chamada — usado apenas pela OpenAI/OpenRouter.
		if m.Role == PapelTool {
			funcName := m.ToolName
			if funcName == "" {
				// Fallback de retrocompatibilidade: mensagens antigas que não têm ToolName
				// ainda podem ter o nome em ToolID (antes da separação dos campos).
				funcName = m.ToolID
			}
			content.Role = "tool"
			content.Parts = []*genai.Part{
				{
					FunctionResponse: &genai.FunctionResponse{
						Name:     funcName,
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
// It ensures full OpenAI API conformance:
//   - Assistant messages with ToolCalls have IDs populated on every call.
//   - Tool messages have both ToolCallID (links to the call) and Name populated.
func ParaOpenRouterHistory(sysInst string, history []MensagemAgnostica) []openai.ChatCompletionMessage {
	var messages []openai.ChatCompletionMessage

	if sysInst != "" {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleSystem,
			Content: sysInst,
		})
	}

	for _, m := range history {
		msg := openai.ChatCompletionMessage{
			Role:    string(m.Role),
			Content: m.Content,
		}

		// Assistant message: populate ToolCalls with IDs and function names.
		// If the ID is empty (e.g. Google does not return call IDs), generate a
		// stable synthetic one here at the adapter boundary so that the matching
		// Tool response below can reference the same ID — conformidade OpenAI.
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				callID := tc.ID
				if callID == "" {
					callID = fmt.Sprintf("call_%s_%d", tc.Nome, rand.Intn(99999))
				}
				msg.ToolCalls = append(msg.ToolCalls, openai.ToolCall{
					ID:   callID,
					Type: openai.ToolTypeFunction,
					Function: openai.FunctionCall{
						Name:      tc.Nome,
						Arguments: marshalArgs(tc.Args),
					},
				})
			}
		}

		// Tool response message: MUST have ToolCallID (links to call) and Name.
		// Both are required by the OpenAI spec; missing either causes a 400.
		if m.Role == PapelTool {
			msg.ToolCallID = m.ToolID
			msg.Name = m.ToolName
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

// ─── Agnostic Intent & Extraction ───────────────────────────────────────────

// Intent represents the classified user intent from the Router.
type Intent string

const (
	IntentRAG      Intent = "RAG"
	IntentDatabase Intent = "DATABASE"
	IntentFinance  Intent = "REGISTRO_FINANCEIRO"
	IntentChat     Intent = "CHAT"
)

// Alocacao represents a distribution of values to specific areas (talhões).
type Alocacao struct {
	TalhaoNome string  `json:"talhao_nome" jsonschema:"description=Nome do talhão"`
	Valor      float64 `json:"valor" jsonschema:"description=Valor ou quantidade alocada"`
}

// Localizacao represents structured location data (TALHÕES/CANTEIROS).
type Localizacao struct {
	Talhao           string   `json:"talhao" jsonschema:"description=Nome do talhão principal"`
	Canteiros        []string `json:"canteiros" jsonschema:"description=Lista de canteiros específicos"`
	TalhoesAplicados []string `json:"talhoes_aplicados,omitempty" jsonschema:"description=Outros talhões afetados"`
}

// AcaoEstruturada represents a single extracted action or entity.
type AcaoEstruturada struct {
	Intencao          string      `json:"intencao,omitempty" jsonschema:"description=Mapeamento para fluxo legado: registro, limpeza, propagacao, compostagem, registro_financeiro, duvida, saudacao"`
	Atividade         string      `json:"atividade,omitempty" jsonschema:"description=Nome da atividade agrícola identificada"`
	InsumoCultura     string      `json:"insumo_cultura,omitempty" jsonschema:"description=Cultura principal ou insumo base"`
	InsumoAplicado    string      `json:"insumo_applied,omitempty" jsonschema:"description=Insumo específico aplicado"`
	InsumoGenerico    bool        `json:"insumo_generico,omitempty"`
	Quantidade        string      `json:"quantidade,omitempty" jsonschema:"description=Valor numérico da quantidade (ex: 10, 50.5)"`
	Unidade           string      `json:"unidade,omitempty" jsonschema:"description=Unidade de medida (kg, L, m, canteiros)"`
	Localizacao       Localizacao `json:"localizacao,omitempty"`
	Data              string      `json:"data,omitempty" jsonschema:"description=Data no formato YYYY-MM-DD"`
	AlertaOrganico    bool        `json:"alerta_organico,omitempty" jsonschema:"description=True se houver suspeita de insumo não permitido"`
	HouveDescartes    bool        `json:"houve_descartes,omitempty"`
	QtdDescartes      string      `json:"qtd_descartes,omitempty"`
	NecessitaMaisInfo bool        `json:"necessita_mais_info,omitempty" jsonschema:"description=True se informações obrigatórias estiverem faltando"`
	PerguntaAoUsuario string      `json:"pergunta_ao_usuario,omitempty" jsonschema:"description=Pergunta específica para solicitar dados faltantes"`
	Fornecedor        string      `json:"fornecedor,omitempty"`
	NotaFiscal        string      `json:"nota_fiscal,omitempty"`
	Marca             string      `json:"marca,omitempty"`
	Composicao        string      `json:"composicao,omitempty"`
	Procedencia       string      `json:"procedencia,omitempty"`
	ItemArea          string      `json:"item_area,omitempty"`
	TipoLimpeza       string      `json:"tipo_limpeza,omitempty"`
	ProdutoUtilizado  string      `json:"produto_utilizado,omitempty"`
	Dosagem           string      `json:"dosagem,omitempty"`
	Responsavel       string      `json:"responsavel,omitempty"`
	Lote              string      `json:"lote,omitempty"`
	Cliente           string      `json:"cliente,omitempty"`
	ValorTotal        string      `json:"valor_total,omitempty" jsonschema:"description=Valor financeiro total (ex: 1500.00)"`
}

// UnifiedIntentResult combines classification and multi-entity extraction.
// This is the SSOT (Single Source of Truth) for LLM structured responses.
type UnifiedIntentResult struct {
	Intents    []Intent `json:"intents" jsonschema:"required,minItems=1,enum=RAG,enum=DATABASE,enum=CHAT,enum=REGISTRO_FINANCEIRO" validate:"required,min=1,dive,oneof=RAG DATABASE CHAT REGISTRO_FINANCEIRO"`
	Confidence float64  `json:"confidence" jsonschema:"required,minimum=0,maximum=1" validate:"required,gte=0,lte=1"`
	Reasoning  string   `json:"reasoning" jsonschema:"required,description=Explicação técnica da decisão sobre a classificação e a segmentação das entidades" validate:"required"`

	// Multi-Entity Extraction
	Entities []AcaoEstruturada `json:"entidades" jsonschema:"minItems=1,description=Lista de ações ou entidades independentes detectadas na mensagem. Cada entrada deve representar uma operação completa."`
}

// EvidenceEvaluation represents the evaluation of a single RAG chunk.
type EvidenceEvaluation struct {
	ChunkIndex int    `json:"chunk_index" jsonschema:"required,description=Index of the chunk in the input list (0-based)" validate:"min=0"`
	Score      int    `json:"score" jsonschema:"required,description=Agronomic evidence relevance score (1 to 5)" validate:"required,min=1,max=5"`
	Reasoning  string `json:"reasoning" jsonschema:"required,description=Detailed reasoning for the score based on Crop, Management practice, and Target/Goal" validate:"required"`
}

// MetaRAGResult wraps a slice of EvidenceEvaluation for structured JSON output.
type MetaRAGResult struct {
	Evaluations []EvidenceEvaluation `json:"evaluations" jsonschema:"required,description=List of evidence evaluations" validate:"required,dive"`
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
	Texto            string                       `json:"texto"`
	ToolCalls        []ChamadaFerramentaAgnostica `json:"tool_calls,omitempty"`
	ThoughtSignature string                       `json:"thought_signature,omitempty"`
	Usage            UsoMetadados                 `json:"usage"`
	Model            string                       `json:"model"`
	Provider         string                       `json:"provider"` // "google" ou "openrouter"
}
