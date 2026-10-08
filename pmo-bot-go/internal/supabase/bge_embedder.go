package supabase

// BGEEmbedder expõe GetEmbedding (OpenRouter, baai/bge-m3, 1024 dimensões)
// como llm.Embedder/mcp.Embedder.
//
// Existe porque a busca da base técnica (consultar_base_conhecimento) recebia
// o embedder do PROVEDOR DE LLM: com o Gemini ativo, isso é
// gemini-embedding-001, que gera 3072 dimensões — enquanto todo o acervo em
// farm_documents.embedding_1024 foi indexado com bge-m3 (scripts/rag_ingest.py,
// upload de PDF, cmd/reindex). O Postgres recusava a comparação ("different
// vector dimensions 1024 and 3072") e a busca falhava sempre. Pergunta e
// documento precisam estar no MESMO espaço vetorial, independente de qual LLM
// gera as respostas.
type BGEEmbedder struct {
	client *Client
}

// NewBGEEmbedder cria o embedder de consulta alinhado ao acervo.
func NewBGEEmbedder(c *Client) *BGEEmbedder { return &BGEEmbedder{client: c} }

// GenerateEmbedding codifica um trecho de documento.
func (e *BGEEmbedder) GenerateEmbedding(text string) ([]float32, error) {
	return e.client.GetEmbedding(text, "BASE_CONHECIMENTO")
}

// GenerateQueryEmbedding codifica uma pergunta. O bge-m3 é simétrico (não usa
// prefixo de tarefa), então é o mesmo caminho do documento.
func (e *BGEEmbedder) GenerateQueryEmbedding(query string) ([]float32, error) {
	return e.client.GetEmbedding(query, "BASE_CONHECIMENTO")
}
