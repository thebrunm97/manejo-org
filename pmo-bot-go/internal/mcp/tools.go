package mcp

import (
	"fmt"
	"log"
	"strings"
)

// InitializeTools registers the initial set of tools to the MCP server
func (s *Server) InitializeTools() {
	s.RegisterTool(Tool{
		Name:        "consultar_base_conhecimento",
		Description: "Usa esta ferramenta para pesquisar manuais, regras de plantio, histórico da fazenda e normas globais orgânicas.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id": map[string]interface{}{
					"type":        "integer",
					"description": "ID do PMO (fazenda) do usuário para filtrar os documentos.",
				},
				"pergunta": map[string]interface{}{
					"type":        "string",
					"description": "A pergunta ou termo de busca para pesquisar na base de conhecimento.",
				},
			},
			"required": []string{"pmo_id", "pergunta"},
		},
		Handler: s.handleConsultarBaseConhecimento,
	})
}

func (s *Server) handleConsultarBaseConhecimento(args map[string]interface{}) (interface{}, error) {
	pmoIDFloat, ok := args["pmo_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("pmo_id is required and must be an integer")
	}
	pmoID := int64(pmoIDFloat)

	pergunta, ok := args["pergunta"].(string)
	if !ok {
		return nil, fmt.Errorf("pergunta is required and must be a string")
	}

	log.Printf("🔍 [MCP-TOOL] Consultando base para PMO %d: %s", pmoID, pergunta)

	// 1. Gerar Embedding usando o Gemini
	embedding, err := s.gemini.GenerateEmbedding(pergunta)
	if err != nil {
		return nil, fmt.Errorf("erro ao gerar embedding: %w", err)
	}

	// 2. Buscar no Supabase (RPC match_farm_documents)
	// Threshold 0.4 e Count 5 para ser mais abrangente que o anterior
	matches, err := s.supabase.MatchFarmDocuments(pmoID, embedding, 0.4, 5)
	if err != nil {
		return nil, fmt.Errorf("erro na busca vetorial: %w", err)
	}

	if len(matches) == 0 {
		return "Nenhuma informação específica encontrada na base de conhecimento para esta pergunta.", nil
	}

	// 3. Formatar o resultado
	var sb strings.Builder
	sb.WriteString("Resultados encontrados na base de conhecimento:\n\n")

	for _, m := range matches {
		prefix := "[DADOS PRIVADOS DA SUA FAZENDA]"
		if m.IsGlobal {
			prefix = "[FONTE GERAL DO AGRO]"
		}
		sb.WriteString(fmt.Sprintf("%s (Documento: %s):\n%s\n\n", prefix, m.DocumentName, m.Content))
	}

	return sb.String(), nil
}
