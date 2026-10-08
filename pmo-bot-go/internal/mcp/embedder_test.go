package mcp

import "github.com/thebrunm97/pmo-bot-go/internal/supabase"

// A busca da base técnica precisa do embedder bge-m3 (mesmo espaço vetorial do
// acervo); esta linha garante que ele continua servindo ao servidor MCP.
var _ Embedder = (*supabase.BGEEmbedder)(nil)
