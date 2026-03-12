package mcp

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/google/generative-ai-go/genai"
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
		Name:        "criar_infraestrutura_fazenda",
		Description: "Cria um talhão completo e opcionalmente uma sequência de canteiros em um único passo. Use esta ferramenta sempre que o usuário pedir para 'criar a fazenda', 'adicionar talhão com canteiros' ou 'montar infraestrutura'.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"nome_talhao": map[string]interface{}{
					"type":        "string",
					"description": "Nome do talhão (ex: Gleba A).",
				},
				"area_hectares": map[string]interface{}{
					"type":        "number",
					"description": "Área do talhão em hectares.",
				},
				"quantidade_canteiros": map[string]interface{}{
					"type":        "integer",
					"description": "Número de canteiros a serem gerados dentro do talhão (opcional, default 0).",
				},
			},
			"required": []string{"nome_talhao", "area_hectares"},
		},
		Handler: s.handleCriarInfraestruturaFazenda,
	})
}

func (s *Server) handleConsultarDadosFazenda(args map[string]interface{}) (interface{}, error) {
	pmoIDFloat, err := parseArgToFloat(args["pmo_id"])
	if err != nil {
		return nil, fmt.Errorf("pmo_id is required and must be numeric: %w", err)
	}
	pmoID := int64(pmoIDFloat)

	tabela, ok := args["tabela"].(string)
	if !ok {
		return nil, fmt.Errorf("tabela is required and must be a string")
	}

	log.Printf("📊 [MCP-TOOL] Consultando dados estruturados (%s) para PMO %d", tabela, pmoID)

	var data interface{}

	switch tabela {
	case "talhoes":
		data, err = s.supabase.FetchTalhoes(pmoID)
	case "canteiros":
		talhaoIDFloat, err := parseArgToFloat(args["talhao_id"])
		if err != nil {
			return nil, fmt.Errorf("talhao_id is required for canteiros table: %w", err)
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
	pmoIDFloat, err := parseArgToFloat(args["pmo_id"])
	if err != nil {
		return nil, fmt.Errorf("pmo_id is required and must be numeric: %w", err)
	}
	pmoID := int64(pmoIDFloat)

	pergunta, ok := args["pergunta"].(string)
	if !ok {
		return nil, fmt.Errorf("pergunta is required and must be a string")
	}

	log.Printf("🔍 [MCP-TOOL] Consultando base para PMO %d: %s", pmoID, pergunta)

	// 1. Gerar Embedding usando o Gemini (agora com 3072 dimensões)
	embedding, err := s.gemini.GenerateEmbedding(nil, genai.Text(pergunta))
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

	areaHectares, err := parseArgToFloat(args["area_hectares"])
	if err != nil {
		return nil, fmt.Errorf("area_hectares é obrigatório e deve ser numérico: %w", err)
	}

	cultura, _ := args["cultura"].(string)

	// Estes valores são injetados pelo FSM por segurança
	pmoIDFloat, err := parseArgToFloat(args["pmo_id"])
	if err != nil {
		return nil, fmt.Errorf("pmo_id is required: %w", err)
	}
	userID, _ := args["user_id"].(string)

	log.Printf("🏗️ [MCP-TOOL] Criando novo talhão '%s' para PMO %d", nome, int64(pmoIDFloat))

	id, err := s.supabase.CriarTalhao(nome, areaHectares, cultura, int64(pmoIDFloat), userID)
	if err != nil {
		return nil, fmt.Errorf("erro ao criar talhão: %w", err)
	}

	return fmt.Sprintf("Talhão '%s' criado com sucesso com ID %d. Você já pode visualizar e desenhar o polígono no painel web.", nome, id), nil
}

func (s *Server) handleCriarNovosCanteiros(args map[string]interface{}) (interface{}, error) {
	talhaoIDFloat, err := parseArgToFloat(args["talhao_id"])
	if err != nil {
		return nil, fmt.Errorf("talhao_id é obrigatório e deve ser numérico: %w", err)
	}

	quantidadeFloat, err := parseArgToFloat(args["quantidade"])
	if err != nil {
		return nil, fmt.Errorf("quantidade é obrigatória e deve ser numérica: %w", err)
	}

	idInicialFloat, err := parseArgToFloat(args["identificador_inicial"])
	if err != nil {
		return nil, fmt.Errorf("identificador_inicial é obrigatório e deve ser numérico: %w", err)
	}

	log.Printf("🏗️ [MCP-TOOL] Criando %d canteiros para talhão %d", int(quantidadeFloat), int64(talhaoIDFloat))

	err = s.supabase.CriarCanteirosEmLote(int64(talhaoIDFloat), int(quantidadeFloat), int(idInicialFloat))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar canteiros em lote: %w", err)
	}

	return fmt.Sprintf("%d canteiros criados com sucesso para o talhão ID %d.", int(quantidadeFloat), int64(talhaoIDFloat)), nil
}

func (s *Server) handleCriarInfraestruturaFazenda(args map[string]interface{}) (interface{}, error) {
	nome, ok := args["nome_talhao"].(string)
	if !ok {
		return nil, fmt.Errorf("nome_talhao é obrigatório")
	}

	areaHectares, err := parseArgToFloat(args["area_hectares"])
	if err != nil {
		return nil, fmt.Errorf("area_hectares é obrigatório e deve ser numérico: %w", err)
	}

	qtdCanteirosFloat, _ := parseArgToFloat(args["quantidade_canteiros"])
	cultura, _ := args["cultura"].(string)

	// Injeção de segurança do FSM
	pmoIDFloat, err := parseArgToFloat(args["pmo_id"])
	if err != nil {
		return nil, fmt.Errorf("pmo_id is required: %w", err)
	}
	userID, _ := args["user_id"].(string)

	log.Printf("🏗️ [MCP-TOOL] Criando infraestrutura unificada para PMO %d: %s", int64(pmoIDFloat), nome)

	res, err := s.supabase.CriarInfraestruturaCompleta(nome, areaHectares, cultura, int64(pmoIDFloat), userID, int(qtdCanteirosFloat))
	if err != nil {
		return nil, fmt.Errorf("erro na infraestrutura unificada: %w", err)
	}

	return res, nil
}

func parseArgToFloat(val interface{}) (float64, error) {
	if val == nil {
		return 0, errors.New("value is nil")
	}
	switch v := val.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		return strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64)
	default:
		strVal := fmt.Sprintf("%v", val)
		return strconv.ParseFloat(strings.ReplaceAll(strVal, ",", "."), 64)
	}
}
