package mcp

import (
	"encoding/json"
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

	s.RegisterTool(Tool{
		Name:        "consultar_dados_fazenda",
		Description: "Usa esta ferramenta para consultar dados estruturados da fazenda como talhões, canteiros ativos e registros recentes do caderno de campo.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id": map[string]interface{}{
					"type":        "integer",
					"description": "ID do PMO (fazenda) do usuário.",
				},
				"tabela": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"talhoes", "canteiros", "caderno_recente"},
					"description": "A categoria de dados que deseja consultar.",
				},
				"talhao_id": map[string]interface{}{
					"type":        "integer",
					"description": "Obrigatório se a tabela for 'canteiros'. ID do talhão para filtrar canteiros.",
				},
			},
			"required": []string{"pmo_id", "tabela"},
		},
		Handler: s.handleConsultarDadosFazenda,
	})

	s.RegisterTool(Tool{
		Name:        "criar_novo_talhao",
		Description: "Cria um novo talhão na fazenda com suporte a desenho de mapa posterior.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"nome_talhao": map[string]interface{}{
					"type":        "string",
					"description": "Nome descritivo do talhão (ex: Gleba A, Horta Norte).",
				},
				"area_hectares": map[string]interface{}{
					"type":        "number",
					"description": "Área total do talhão em hectares.",
				},
				"cultura": map[string]interface{}{
					"type":        "string",
					"description": "Cultura principal plantada neste talhão (opcional).",
				},
			},
			"required": []string{"nome_talhao", "area_hectares"},
		},
		Handler: s.handleCriarNovoTalhao,
	})

	s.RegisterTool(Tool{
		Name:        "criar_novos_canteiros",
		Description: "Cria uma sequência de canteiros numerados dentro de um talhão existente.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"talhao_id": map[string]interface{}{
					"type":        "integer",
					"description": "ID do talhão pai onde os canteiros serão criados.",
				},
				"quantidade": map[string]interface{}{
					"type":        "integer",
					"description": "Quantidade de canteiros a serem criados.",
				},
				"identificador_inicial": map[string]interface{}{
					"type":        "integer",
					"description": "Número do primeiro canteiro da sequência (ex: 1).",
				},
			},
			"required": []string{"talhao_id", "quantidade", "identificador_inicial"},
		},
		Handler: s.handleCriarNovosCanteiros,
	})
}

func (s *Server) handleConsultarDadosFazenda(args map[string]interface{}) (interface{}, error) {
	pmoIDFloat, ok := args["pmo_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("pmo_id is required and must be an integer")
	}
	pmoID := int64(pmoIDFloat)

	tabela, ok := args["tabela"].(string)
	if !ok {
		return nil, fmt.Errorf("tabela is required and must be a string")
	}

	log.Printf("📊 [MCP-TOOL] Consultando dados estruturados (%s) para PMO %d", tabela, pmoID)

	var data interface{}
	var err error

	switch tabela {
	case "talhoes":
		data, err = s.supabase.FetchTalhoes(pmoID)
	case "canteiros":
		talhaoIDFloat, ok := args["talhao_id"].(float64)
		if !ok {
			return nil, fmt.Errorf("talhao_id is required for canteiros table")
		}
		data, err = s.supabase.FetchCanteiros(int64(talhaoIDFloat))
	case "caderno_recente":
		data, err = s.supabase.FetchCadernoRecentes(pmoID, 10)
	default:
		return nil, fmt.Errorf("tabela desconhecida: %s", tabela)
	}

	if err != nil {
		return nil, fmt.Errorf("erro ao buscar dados no Supabase: %w", err)
	}

	// Format as JSON string for the AI
	jsonBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("erro ao formatar resposta: %w", err)
	}

	return string(jsonBytes), nil
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

func (s *Server) handleCriarNovoTalhao(args map[string]interface{}) (interface{}, error) {
	nome, ok := args["nome_talhao"].(string)
	if !ok {
		return nil, fmt.Errorf("nome_talhao é obrigatório")
	}

	areaHectaresVal := args["area_hectares"]
	if areaHectaresVal == nil {
		return nil, fmt.Errorf("area_hectares é obrigatório")
	}
	areaHectares, ok := areaHectaresVal.(float64)
	if !ok {
		return nil, fmt.Errorf("area_hectares deve ser numérico")
	}

	cultura, _ := args["cultura"].(string)

	// Estes valores são injetados pelo FSM por segurança
	pmoIDFloat, _ := args["pmo_id"].(float64)
	userID, _ := args["user_id"].(string)

	log.Printf("🏗️ [MCP-TOOL] Criando novo talhão '%s' para PMO %d", nome, int64(pmoIDFloat))

	id, err := s.supabase.CriarTalhao(nome, areaHectares, cultura, int64(pmoIDFloat), userID)
	if err != nil {
		return nil, fmt.Errorf("erro ao criar talhão: %w", err)
	}

	return fmt.Sprintf("Talhão '%s' criado com sucesso com ID %d. Você já pode visualizar e desenhar o polígono no painel web.", nome, id), nil
}

func (s *Server) handleCriarNovosCanteiros(args map[string]interface{}) (interface{}, error) {
	talhaoID, ok := args["talhao_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("talhao_id é obrigatório e deve ser numérico")
	}

	quantidadeVal, ok := args["quantidade"].(float64)
	if !ok {
		return nil, fmt.Errorf("quantidade é obrigatória e deve ser numérica")
	}

	idInicialVal, ok := args["identificador_inicial"].(float64)
	if !ok {
		return nil, fmt.Errorf("identificador_inicial é obrigatório e deve ser numérico")
	}

	log.Printf("🏗️ [MCP-TOOL] Criando %d canteiros para talhão %d", int(quantidadeVal), int64(talhaoID))

	err := s.supabase.CriarCanteirosEmLote(int64(talhaoID), int(quantidadeVal), int(idInicialVal))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar canteiros em lote: %w", err)
	}

	return fmt.Sprintf("%d canteiros criados com sucesso para o talhão ID %d.", int(quantidadeVal), int64(talhaoID)), nil
}
