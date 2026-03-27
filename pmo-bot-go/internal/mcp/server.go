package mcp

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/generative-ai-go/genai"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// LoopGuard prevents infinite tool-calling loops by tracking repeated calls with same args.
type LoopGuard struct {
	MaxRepeats int
	History    map[string]int // hash(name+args) -> count
}

func NewLoopGuard(max int) *LoopGuard {
	return &LoopGuard{
		MaxRepeats: max,
		History:    make(map[string]int),
	}
}

// CheckAndRecord returns true if the call is allowed, false if it's a loop.
func (lg *LoopGuard) CheckAndRecord(name string, args map[string]interface{}) bool {
	argJSON, _ := json.Marshal(args)
	key := fmt.Sprintf("%s:%s", name, string(argJSON))

	lg.History[key]++
	if lg.History[key] > lg.MaxRepeats {
		return false
	}
	return true
}

// Server represents an MCP server that manages tools and interacts with Supabase
type Server struct {
	supabase *supabase.Client
	gemini   *gemini.Client
	tools    map[string]Tool
}

// ToolCategory defines if a tool is for knowledge (RAG) or farm records (DATABASE)
type ToolCategory string

const (
	CategoryRAG      ToolCategory = "RAG"      // Knowledge retrieval
	CategoryDatabase ToolCategory = "DATABASE" // Farm management records (CRUD)
)

// Tool represents a registered MCP tool
type Tool struct {
	Name        string                                                 `json:"name"`
	Description string                                                 `json:"description"`
	Category    ToolCategory                                           `json:"category"`
	InputSchema map[string]interface{}                                 `json:"inputSchema"`
	Handler     func(args map[string]interface{}) (interface{}, error) `json:"-"`
}

// NewServer initializes a new MCP server
func NewServer(sb *supabase.Client, gem *gemini.Client) *Server {
	return &Server{
		supabase: sb,
		gemini:   gem,
		tools:    make(map[string]Tool),
	}
}

// RegisterTool adds a tool to the server
func (s *Server) RegisterTool(tool Tool) {
	s.tools[tool.Name] = tool
	log.Printf("🛠️ [MCP] Ferramenta registrada: %s", tool.Name)
}

// ListTools returns the list of registered tools for the MCP protocol
func (s *Server) ListTools() []Tool {
	var list []Tool
	for _, t := range s.tools {
		list = append(list, t)
	}
	return list
}

// GetToolsForIntent filters registered tools based on the user's classified intent.
// RAG: Knowledge base + local farm data consultation.
// DATABASE: Production records + local farm data consultation.
// CHAT: No tools.
func (s *Server) GetToolsForIntent(intent gemini.Intent) []*genai.Tool {
	var filtered []*genai.Tool

	for _, t := range s.tools {
		include := false

		switch intent {
		case gemini.IntentRAG:
			// RAG specialist gets knowledge base and farm data lookups
			// UPDATED: Also gets database tools to allow "advice + action" flow.
			if t.Category == CategoryRAG || t.Category == CategoryDatabase {
				include = true
			}

		case gemini.IntentDatabase:
			// DB specialist gets all write tools + farm data lookups (but NOT knowledge base)
			if t.Category == CategoryDatabase || t.Name == "consultar_dados_fazenda" {
				include = true
			}

		case gemini.IntentChat:
			// Basic chat gets no tools to keep it light
			include = false
		}

		if include {
			filtered = append(filtered, &genai.Tool{
				FunctionDeclarations: []*genai.FunctionDeclaration{
					{
						Name:        t.Name,
						Description: t.Description,
						Parameters:  mapToSchema(t.InputSchema),
					},
				},
			})
		}
	}

	return filtered
}

// mapToSchema converts the generic InputSchema map to a genai.Schema
func mapToSchema(m map[string]interface{}) *genai.Schema {
	jsonBytes, _ := json.Marshal(m)
	var s genai.Schema
	_ = json.Unmarshal(jsonBytes, &s)
	return &s
}

// GetToolDeclarations returns tools formatted for Gemini's genai SDK
func (s *Server) GetToolDeclarations() []*genai.Tool {
	var declarations []*genai.FunctionDeclaration

	for _, t := range s.tools {
		// 1. Safe extraction of required fields (handling []string or []interface{})
		var required []string
		if reqVal, ok := t.InputSchema["required"]; ok {
			if reqList, ok := reqVal.([]string); ok {
				required = reqList
			} else if reqList, ok := reqVal.([]interface{}); ok {
				for _, r := range reqList {
					if s, ok := r.(string); ok {
						required = append(required, s)
					}
				}
			}
		}

		decl := &genai.FunctionDeclaration{
			Name:        t.Name,
			Description: t.Description,
			Parameters: &genai.Schema{
				Type:       genai.TypeObject,
				Properties: make(map[string]*genai.Schema),
				Required:   required,
			},
		}

		// 2. Safe extraction of properties
		props, _ := t.InputSchema["properties"].(map[string]interface{})
		if props == nil {
			props = make(map[string]interface{})
		}

		for k, v := range props {
			propMap, ok := v.(map[string]interface{})
			if !ok {
				continue
			}

			propType := genai.TypeString
			if pType, ok := propMap["type"].(string); ok {
				switch pType {
				case "integer":
					propType = genai.TypeInteger
				case "number":
					propType = genai.TypeNumber
				case "boolean":
					propType = genai.TypeBoolean
				}
			}

			desc, _ := propMap["description"].(string)

			propSchema := &genai.Schema{
				Type:        propType,
				Description: desc,
			}

			// Handle Enums manually
			if enumVal, exists := propMap["enum"]; exists {
				if enumList, ok := enumVal.([]string); ok {
					propSchema.Enum = enumList
				} else if enumList, ok := enumVal.([]interface{}); ok {
					// Handle cases where we get []interface{} from JSON
					var strList []string
					for _, item := range enumList {
						if s, ok := item.(string); ok {
							strList = append(strList, s)
						}
					}
					propSchema.Enum = strList
				}
			}

			decl.Parameters.Properties[k] = propSchema
		}
		declarations = append(declarations, decl)
	}

	return []*genai.Tool{
		{FunctionDeclarations: declarations},
	}
}

// JSON-RPC models for MCP
type RPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type RPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// HandleProcess handles an incoming JSON-RPC 2.0 request
func (s *Server) HandleProcess(payload []byte) ([]byte, error) {
	var req RPCRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, err
	}

	var result interface{}
	var err error

	switch req.Method {
	case "tools/list":
		result = map[string]interface{}{
			"tools": s.ListTools(),
		}
	case "tools/call":
		var params struct {
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return nil, err
		}
		result, err = s.CallTool(params.Name, params.Arguments)
	default:
		return nil, fmt.Errorf("method not supported: %s", req.Method)
	}

	if err != nil {
		resp := RPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &RPCError{
				Code:    -32000,
				Message: err.Error(),
			},
		}
		return json.Marshal(resp)
	}

	resp := RPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}
	return json.Marshal(resp)
}

// CallTool executes a tool by name
// CallToolWithGuard executes a tool while checking for infinite loops.
func (s *Server) CallToolWithGuard(lg *LoopGuard, name string, args map[string]interface{}) (interface{}, error) {
	if lg != nil {
		if !lg.CheckAndRecord(name, args) {
			return nil, fmt.Errorf("loop detectado: a ferramenta '%s' foi chamada repetidamente com os mesmos parâmetros", name)
		}
	}
	return s.CallTool(name, args)
}

func (s *Server) CallTool(name string, args map[string]interface{}) (interface{}, error) {
	tool, ok := s.tools[name]
	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	return tool.Handler(args)
}
