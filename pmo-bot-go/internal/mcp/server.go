package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
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

// EvidenceEvaluator define o contrato mínimo que o servidor MCP precisa de um
// provedor de LLM: avaliar evidências recuperadas (chunks) contra a pergunta
// do usuário no fluxo META-RAG. Estreita llm.LLMProvider (9 métodos) para o
// único método efetivamente usado por este pacote.
type EvidenceEvaluator interface {
	// EvaluateEvidenceListwise avalia uma lista de chunks recuperados contra a pergunta.
	EvaluateEvidenceListwise(ctx context.Context, query string, chunks []string) (llm.MetaRAGResult, error)
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
	agriRepo    ports.AgriculturalRepository[OperacaoLoteItem]
	embedder    Embedder
	llmProvider EvidenceEvaluator
	tools       map[string]Tool
}

// ToolCategory defines if a tool is for knowledge (RAG) or farm records (DATABASE)
type ToolCategory string

const (
	CategoryRAG      ToolCategory = "RAG"      // Knowledge retrieval
	CategoryDBRead   ToolCategory = "DB_READ"  // Read data from DB
	CategoryDBWrite  ToolCategory = "DB_WRITE" // Write data to DB
	CategoryChat     ToolCategory = "CHAT"     // Simple chat or calculation
)

// ToolHandler é a nova assinatura para todos os handlers de ferramenta MCP.
// ctx: contexto da operação (para timeouts, cancelamento)
// args: argumentos extraídos do LLM (APENAS dados de negócio, sem IDs sensíveis)
// profile: contexto do usuário atual (contém pmo_id, propriedade_id, user_id)
type ToolHandler func(
	ctx context.Context,
	args map[string]interface{},
	profile *supabase.Profile,
) (interface{}, error)

// Tool represents a registered MCP tool, wrapping its agnostic definition and handler.
type Tool struct {
	Definition llm.FerramentaAgnostica
	Category   ToolCategory
	Options    *ToolOptions // Opcional: Define regras de validação e confirmação
	Handler    ToolHandler  `json:"-"`
}

// NewServer initializes a new agnostic MCP server.
func NewServer(sb *supabase.Client, agriRepo ports.AgriculturalRepository[OperacaoLoteItem], emb Embedder, llmProvider EvidenceEvaluator) *Server {
	return &Server{
		supabase:    sb,
		agriRepo:    agriRepo,
		embedder:    emb,
		llmProvider: llmProvider,
		tools:       make(map[string]Tool),
	}
}

// RegisterTool adds a tool to the server.
func (s *Server) RegisterTool(tool Tool) {
	// Se a ferramenta tiver opções de middleware definidas, envolve o handler
	if tool.Options != nil {
		tool.Handler = wrapWithMiddleware(*tool.Options, tool.Handler)

		// Injeta propriedades no schema JSON da ferramenta dinamicamente
		if tool.Definition.Parameters != nil {
			if props, ok := tool.Definition.Parameters["properties"].(map[string]interface{}); ok {
				props["dry_run"] = map[string]interface{}{
					"type":        "boolean",
					"description": "Se verdadeiro, valida os dados sem executar a ação real. Use isto sempre que não tiver a certeza ou quiser testar a validade dos dados antes de pedir confirmação.",
				}
				if tool.Options.RequiresConfirmation {
					props["confirmed"] = map[string]interface{}{
						"type":        "boolean",
						"description": "Deve ser true APENAS SE o usuário confirmou explicitamente a execução desta ação. Caso contrário, omita este campo e a ferramenta pedirá a confirmação.",
					}
				}
			}
		}
	}

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

func (s *Server) GetAllMCPTools() []Tool {
	var list []Tool
	for _, t := range s.tools {
		list = append(list, t)
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
		case "RAG", "AGRONOMY":
			if t.Category == CategoryRAG || t.Category == CategoryDBWrite || t.Category == CategoryDBRead {
				include = true
			}

		case "DATABASE", "REGISTRO_FINANCEIRO", "FINANCE":
			if t.Category == CategoryDBWrite || t.Category == CategoryDBRead || t.Category == CategoryRAG {
				include = true
			}

		case "CHAT", "CLARIFICATION", "SCHEDULING", "WORKFLOW":
			// Allow Database tools in CHAT so that simple confirmations like "Sim" 
			// (which route to CHAT) can still trigger the pending tool call.
			if t.Category == CategoryDBWrite || t.Category == CategoryDBRead {
				include = true
			}
		default:
			// Fallback de segurança: expor ferramentas RAG se o intent for desconhecido
			// para evitar que o agente fique completamente cego (ex: erro de clima).
			if t.Category == CategoryRAG || t.Category == CategoryDBRead {
				include = true
			}
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
func (s *Server) HandleProcess(ctx context.Context, payload []byte, profile *supabase.Profile) ([]byte, error) {
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
		result, err = s.CallTool(ctx, params.Name, params.Arguments, profile)
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

// validateProfile garante que o profile é válido e tem PMO ativa.
// Retorna erro se profile for nulo ou se o usuário não tiver PMO selecionada.
func (s *Server) validateProfile(profile *supabase.Profile) error {
	if profile == nil {
		return fmt.Errorf("unauthorized: sessão expirada ou inválida")
	}
	if profile.PmoAtivoID == 0 {
		return fmt.Errorf("validation: usuário não tem PMO ativa selecionada")
	}
	return nil
}

// CallToolWithGuard executes a tool while checking for infinite loops.
func (s *Server) CallToolWithGuard(
	ctx context.Context,
	lg *LoopGuard,
	name string,
	args map[string]interface{},
	profile *supabase.Profile,
) (interface{}, error) {
	if err := s.validateProfile(profile); err != nil {
		return nil, err
	}

	if lg != nil {
		if !lg.CheckAndRecord(name, args) {
			return nil, fmt.Errorf("loop detectado: a ferramenta '%s' foi chamada repetidamente com os mesmos parâmetros", name)
		}
	}
	return s.CallTool(ctx, name, args, profile)
}

// CallTool executes a tool by name
func (s *Server) CallTool(
	ctx context.Context,
	name string,
	args map[string]interface{},
	profile *supabase.Profile,
) (interface{}, error) {
	if err := s.validateProfile(profile); err != nil {
		return nil, err
	}

	tool, ok := s.tools[name]
	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	return tool.Handler(ctx, args, profile)
}
