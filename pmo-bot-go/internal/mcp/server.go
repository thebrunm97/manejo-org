package mcp

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// Embedder defines the contract for generating text embeddings,
// allowing the MCP server to remain agnostic of the specific LLM provider.
type Embedder interface {
	// GenerateEmbedding encodes a document chunk for indexing (title|text format).
	GenerateEmbedding(text string) ([]float32, error)
	// GenerateQueryEmbedding encodes a search query with the asymmetric task prefix.
	GenerateQueryEmbedding(query string) ([]float32, error)
}

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

// Server represents an MCP server that manages tools and interacts with Supabase.
// It is now provider-agnostic.
type Server struct {
	supabase    *supabase.Client
	embedder    Embedder
	llmProvider llm.LLMProvider
	tools       map[string]Tool
}

// ToolCategory defines if a tool is for knowledge (RAG) or farm records (DATABASE)
type ToolCategory string

const (
	CategoryRAG      ToolCategory = "RAG"      // Knowledge retrieval
	CategoryDatabase ToolCategory = "DATABASE" // Farm management records (CRUD)
)

// Tool represents a registered MCP tool, wrapping its agnostic definition and handler.
type Tool struct {
	Definition llm.FerramentaAgnostica
	Category   ToolCategory
	Handler    func(args map[string]interface{}) (interface{}, error) `json:"-"`
}

// NewServer initializes a new agnostic MCP server.
func NewServer(sb *supabase.Client, emb Embedder, llmProvider llm.LLMProvider) *Server {
	return &Server{
		supabase:    sb,
		embedder:    emb,
		llmProvider: llmProvider,
		tools:       make(map[string]Tool),
	}
}

// RegisterTool adds a tool to the server.
func (s *Server) RegisterTool(tool Tool) {
	s.tools[tool.Definition.Name] = tool
	log.Printf("🛠️ [MCP] Ferramenta registrada: %s", tool.Definition.Name)
}

// ListTools returns the list of registered tools for the MCP protocol.
func (s *Server) ListTools() []llm.FerramentaAgnostica {
	var list []llm.FerramentaAgnostica
	for _, t := range s.tools {
		list = append(list, t.Definition)
	}
	return list
}

// GetToolsForIntent filters registered tools based on the user's classified intent.
// It returns agnostic definitions, leaving the provider-specific conversion to the caller.
func (s *Server) GetToolsForIntent(intent string) []llm.FerramentaAgnostica {
	log.Printf("🛠️ [MCP] GetToolsForIntent: intent='%s' total_registered=%d", intent, len(s.tools))
	var filtered []llm.FerramentaAgnostica

	for _, t := range s.tools {
		include := false

		switch intent {
		case "RAG":
			if t.Category == CategoryRAG || t.Category == CategoryDatabase {
				include = true
			}

		case "DATABASE", "REGISTRO_FINANCEIRO":
			if t.Category == CategoryDatabase || t.Definition.Name == "consultar_dados_fazenda" {
				include = true
			}

		case "CHAT":
			include = false
		}

		if include {
			filtered = append(filtered, t.Definition)
		}
	}

	return filtered
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

// CallToolWithGuard executes a tool while checking for infinite loops.
func (s *Server) CallToolWithGuard(lg *LoopGuard, name string, args map[string]interface{}) (interface{}, error) {
	if lg != nil {
		if !lg.CheckAndRecord(name, args) {
			return nil, fmt.Errorf("loop detectado: a ferramenta '%s' foi chamada repetidamente com os mesmos parâmetros", name)
		}
	}
	return s.CallTool(name, args)
}

// CallTool executes a tool by name
func (s *Server) CallTool(name string, args map[string]interface{}) (interface{}, error) {
	tool, ok := s.tools[name]
	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	return tool.Handler(args)
}

