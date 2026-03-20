package mcp

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/generative-ai-go/genai"
	"github.com/thebrunm97/pmo-bot-go/internal/gemini"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// Server represents an MCP server that manages tools and interacts with Supabase
type Server struct {
	supabase *supabase.Client
	gemini   *gemini.Client
	tools    map[string]Tool
}

// Tool represents a registered MCP tool
type Tool struct {
	Name        string                                                 `json:"name"`
	Description string                                                 `json:"description"`
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
func (s *Server) CallTool(name string, args map[string]interface{}) (interface{}, error) {
	tool, ok := s.tools[name]
	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	return tool.Handler(args)
}
