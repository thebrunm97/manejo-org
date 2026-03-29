package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// InitializeTools registers the initial set of tools to the MCP server
func (s *Server) InitializeTools() {
	s.RegisterTool(Tool{
		Name:        "consultar_base_conhecimento",
		Description: "Usa esta ferramenta para pesquisar manuais, regras de plantio, histórico da fazenda e normas globais orgânicas.",
		Category:    CategoryRAG,
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
		Category:    CategoryRAG,
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
		Category:    CategoryDatabase,
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

	s.RegisterTool(Tool{
		Name:        "adicionar_insumo_pmo",
		Description: "Usa esta ferramenta para cadastrar insumos e equipamentos (Seção 8 do PMO) como fertilizantes, sementes compradas, substratos ou ferramentas novas.",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id": map[string]interface{}{"type": "integer"},
				"produto_manejo": map[string]interface{}{
					"type":        "string",
					"description": "Nome do insumo ou equipamento (Ex: Esterco de curral, Enxada, Substrato).",
				},
				"cultura_destino": map[string]interface{}{
					"type":        "string",
					"description": "Para qual cultura este insumo será usado (Ex: Alface, Milho).",
				},
				"epoca_frequencia": map[string]interface{}{
					"type":        "string",
					"description": "Quando é aplicado (Ex: No plantio, Mensalmente).",
				},
				"procedencia": map[string]interface{}{
					"type":        "string",
					"description": "Origem do insumo (Ex: Compra comercial, Produção própria).",
				},
				"composicao": map[string]interface{}{
					"type":        "string",
					"description": "Do que é feito (Ex: NPK, Orgânico 100%).",
				},
				"marca": map[string]interface{}{
					"type":        "string",
					"description": "Marca comercial, se houver.",
				},
				"dosagem": map[string]interface{}{
					"type":        "string",
					"description": "OBRIGATÓRIO. Quantidade ou dose recomendada (Ex: 10kg/ha). Se o usuário não informou, NÃO invente e NÃO chame a função. Pergunte primeiro.",
				},
			},
			"required": []string{"pmo_id", "produto_manejo", "dosagem"},
		},
		Handler: s.handleAdicionarInsumoPMO,
	})

	s.RegisterTool(Tool{
		Name:        "registrar_propagacao_vegetal",
		Description: "Usa esta ferramenta para registrar a origem de sementes, mudas ou material propagativo (Seção 9 do PMO).",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id": map[string]interface{}{"type": "integer"},
				"tipo": map[string]interface{}{
					"type":        "string",
					"description": "Atividade realizada: Compra/Aquisição (se apenas comprou), Plantio (se colocou na terra), Semeadura ou Transplante.",
					"enum":        []string{"Compra/Aquisição", "Plantio", "Semeadura", "Transplante"},
				},
				"especies": map[string]interface{}{
					"type":        "string",
					"description": "Espécie ou cultivar (Ex: Alface Crespa, Tomate Cereja).",
				},
				"origem": map[string]interface{}{
					"type":        "string",
					"description": "Fornecedor ou origem (Ex: Sementes Isla, Produção Própria).",
				},
				"quantidade": map[string]interface{}{
					"type":        "string",
					"description": "OBRIGATÓRIO. A quantidade exata (ex: 50 mudas, 2 kg). Se o utilizador não mencionou, NÃO adivinhe e NÃO chame a função. Pergunte primeiro.",
				},
				"sistema_organico": map[string]interface{}{
					"type":        "boolean",
					"description": "Indica se o material é certificado orgânico.",
				},
				"data_compra": map[string]interface{}{
					"type":        "string",
					"description": "Data no formato YYYY-MM-DD.",
				},
			},
			"required": []string{"pmo_id", "tipo", "especies", "quantidade"},
		},
		Handler: s.handleRegistrarPropagacaoVegetal,
	})

	s.RegisterTool(Tool{
		Name:        "registrar_limpeza",
		Description: "Usa esta ferramenta para registrar a higienização de instalações, equipamentos ou ferramentas (Seção 4 / Formulário 04 do PMO).",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id":            map[string]interface{}{"type": "integer"},
				"item_area":         map[string]interface{}{"type": "string", "description": "O que foi limpo (Ex: Trator, Galpão, Enxadas)."},
				"tipo_limpeza":      map[string]interface{}{"type": "string", "description": "Como foi feito (Ex: Lavagem, Varrição, Desinfecção)."},
				"produto_utilizado": map[string]interface{}{"type": "string", "description": "Produto usado, se houver (Ex: Sabão neutro, Álcool 70%)."},
				"dosagem":           map[string]interface{}{"type": "string", "description": "Quantidade do produto usado."},
				"responsavel":       map[string]interface{}{"type": "string", "description": "Quem realizou a limpeza (Default: Produtor)."},
			},
			"required": []string{"pmo_id", "item_area", "tipo_limpeza"},
		},
		Handler: s.handleRegistrarLimpeza,
	})

	s.RegisterTool(Tool{
		Name:        "criar_talhao",
		Description: "Usa esta ferramenta para criar um novo talhão (área produtiva) na fazenda.",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id":        map[string]interface{}{"type": "integer"},
				"nome_talhao":   map[string]interface{}{"type": "string", "description": "Nome descritivo (Ex: Gleba 01, Horta dos Pomares)."},
				"area_hectares": map[string]interface{}{"type": "number", "description": "Tamanho da área em hectares (Ex: 0.5, 1.2)."},
				"cultura":       map[string]interface{}{"type": "string", "description": "Cultura principal plantada (Opcional)."},
			},
			"required": []string{"pmo_id", "nome_talhao", "area_hectares"},
		},
		Handler: s.handleCriarNovoTalhao,
	})

	s.RegisterTool(Tool{
		Name:        "criar_canteiros",
		Description: "Cria canteiros em lote dentro de um talhão existente.",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"talhao_id":             map[string]interface{}{"type": "integer"},
				"quantidade":            map[string]interface{}{"type": "integer", "description": "Número de canteiros a criar."},
				"identificador_inicial": map[string]interface{}{"type": "integer", "description": "Número do primeiro canteiro (Ex: 1)."},
			},
			"required": []string{"talhao_id", "quantidade", "identificador_inicial"},
		},
		Handler: s.handleCriarNovosCanteiros,
	})

	s.RegisterTool(Tool{
		Name:        "registrar_compostagem",
		Description: "Usa esta ferramenta para registrar a montagem, revirada, controle de temperatura, adição de água ou uso de lotes de compostagem (Formulário 05).",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id":              map[string]interface{}{"type": "integer"},
				"acao":                map[string]interface{}{"type": "string", "description": "Ação realizada: 'Nova Pilha', 'Revirada', 'Temperatura', 'Agua' ou 'Uso'.", "enum": []string{"Nova Pilha", "Revirada", "Temperatura", "Agua", "Uso"}},
				"identificador_pilha": map[string]interface{}{"type": "string", "description": "Identificador ou número da pilha (ex: 'Pilha 01')."},
				"materiais":           map[string]interface{}{"type": "string", "description": "Apenas se acao = 'Nova Pilha'. Ingredientes adicionados."},
				"temperatura":         map[string]interface{}{"type": "number", "description": "Apenas se fornecida temperatura (em ºC)."},
				"observacao":          map[string]interface{}{"type": "string", "description": "Observações adicionais ou notas."},
			},
			"required": []string{"pmo_id", "acao", "identificador_pilha"},
		},
		Handler: s.handleRegistrarCompostagem,
	})

	s.RegisterTool(Tool{
		Name:        "registrar_compra_insumo",
		Description: "Usa esta ferramenta para registrar a compra ou aquisição de um insumo, produto, semente, ferramenta ou serviço (Formulário 06 da certificação orgânica). Obrigatório quando o agricultor relatar que 'comprou' algo ou recebeu 'nota fiscal'.",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id": map[string]interface{}{"type": "integer"},
				"produto": map[string]interface{}{
					"type":        "string",
					"description": "Nome do produto/insumo adquirido (Ex: Esterco, Enxada, Semente de Alface, Adubo orgânico).",
				},
				"fornecedor": map[string]interface{}{
					"type":        "string",
					"description": "Nome do fornecedor, loja ou agropecuária onde foi comprado.",
				},
				"nota_fiscal": map[string]interface{}{
					"type":        "string",
					"description": "Número da Nota Fiscal (NF) ou recibo, se mencionado.",
				},
				"quantidade_valor": map[string]interface{}{
					"type":        "number",
					"description": "Valor numérico da quantidade comprada (Ex: 10, 50.5).",
				},
				"quantidade_unidade": map[string]interface{}{
					"type":        "string",
					"description": "Unidade de medida (Ex: kg, L, sacos, unidades, mudas).",
				},
				"data_compra": map[string]interface{}{
					"type":        "string",
					"description": "Data da compra no formato YYYY-MM-DD. Se o usuário não disser a data específica, deixe vazio para usar hoje.",
				},
			},
			"required": []string{"pmo_id", "produto", "quantidade_valor", "quantidade_unidade"},
		},
		Handler: s.handleRegistrarCompraInsumo,
	})

	s.RegisterTool(Tool{
		Name:        "registrar_colheita",
		Description: "Usa esta ferramenta para registrar a colheita de produtos na fazenda (Formulário 07).",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id":          map[string]interface{}{"type": "integer"},
				"data":            map[string]interface{}{"type": "string", "description": "Data da colheita (YYYY-MM-DD)."},
				"cultura":         map[string]interface{}{"type": "string", "description": "Nome da cultura colhida (Ex: Alface Crespa, Tomate)."},
				"talhao":          map[string]interface{}{"type": "string", "description": "Nome do talhão onde foi colhido (Ex: Talhão 01)."},
				"quantidade":      map[string]interface{}{"type": "number", "description": "Quantidade colhida."},
				"unidade":         map[string]interface{}{"type": "string", "description": "Unidade de medida (Ex: kg, maços, caixas)."},
				"destino_inicial": map[string]interface{}{"type": "string", "description": "Para onde foi o produto logo após a colheita (Ex: Depósito, Câmara Fria, Lavagem).", "default": "Depósito"},
			},
			"required": []string{"pmo_id", "cultura", "talhao", "quantidade", "unidade"},
		},
		Handler: s.handleRegistrarColheita,
	})

	s.RegisterTool(Tool{
		Name:        "registrar_venda",
		Description: "Usa esta ferramenta para registrar a venda, comercialização ou destinação final de produtos (Formulário 08). Saída de estoque.",
		Category:    CategoryDatabase,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id":         map[string]interface{}{"type": "integer"},
				"data":           map[string]interface{}{"type": "string", "description": "Data da venda/saída (YYYY-MM-DD)."},
				"produto":        map[string]interface{}{"type": "string", "description": "Nome do produto vendido (Ex: Alface, Tomate)."},
				"quantidade":     map[string]interface{}{"type": "number"},
				"unidade":        map[string]interface{}{"type": "string", "description": "Unidade de medida (Ex: kg, maços, caixas)."},
				"valor_unitario": map[string]interface{}{"type": "number", "description": "Valor por unidade vendida (opcional)."},
				"cliente":        map[string]interface{}{"type": "string", "description": "Nome do comprador ou cliente."},
				"destinacao": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"venda", "doacao", "perda", "processamento", "consumo proprio"},
					"description": "Tipo de saída/destinação.",
					"default":     "venda",
				},
				"nota_fiscal": map[string]interface{}{"type": "string", "description": "Número da NF ou recibo."},
			},
			"required": []string{"pmo_id", "produto", "quantidade", "unidade", "destinacao"},
		},
		Handler: s.handleRegistrarVenda,
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

func (s *Server) handleAdicionarInsumoPMO(args map[string]interface{}) (interface{}, error) {
	log.Printf("🚨 [DEBUG TOOL] handleAdicionarInsumoPMO Args recebidos do LLM: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)

	record := supabase.PmoInsumoInsert{
		PmoID:           pmoID,
		ProdutoManejo:   sanitize(args["produto_manejo"]),
		CulturaDestino:  sanitize(args["cultura_destino"]),
		EpocaFrequencia: sanitize(args["epoca_frequencia"]),
		Procedencia:     sanitize(args["procedencia"]),
		Composicao:      sanitize(args["composicao"]),
		Marca:           sanitize(args["marca"]),
		Dosagem:         sanitize(args["dosagem"]),
	}

	log.Printf("🧪 [MCP-TOOL] Registrando insumo '%s' para PMO %d", record.ProdutoManejo, pmoID)

	qtd := strings.TrimSpace(strings.ToUpper(record.Dosagem))
	if record.ProdutoManejo == "" || qtd == "" || qtd == "0" || qtd == "NÃO INFORMADO" || qtd == "NULL" || qtd == "NENHUM" || strings.Contains(qtd, "0 ") {
		return "ERRO FATAL: O usuário não informou a quantidade/dosagem exata. Não adivinhe, não use zeros. Pergunte a ele: 'Qual a quantidade que você usou ou comprou?'", nil
	}

	err := s.supabase.InsertPMOInsumo(record)
	if err != nil {
		return fmt.Sprintf("Erro ao inserir insumo: %v", err), nil
	}

	return fmt.Sprintf("Insumo '%s' registrado com sucesso na Seção 8 do seu plano.", record.ProdutoManejo), nil
}

func (s *Server) handleRegistrarLimpeza(args map[string]interface{}) (interface{}, error) {
	log.Printf("🧽 [MCP-TOOL] handleRegistrarLimpeza Args: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)
	userID, _ := args["user_id"].(string)

	payload := map[string]interface{}{
		"item_area":         sanitize(args["item_area"]),
		"tipo_limpeza":      sanitize(args["tipo_limpeza"]),
		"produto_utilizado": sanitize(args["produto_utilizado"]),
		"dosagem":           sanitize(args["dosagem"]),
		"responsavel":       sanitize(args["responsavel"]),
		"observacao":        sanitize(args["observacao"]),
		"data":              time.Now().Format("2006-01-02"),
	}

	res, err := s.supabase.RegistrarOperacaoCampoRPC(context.Background(), map[string]interface{}{
		"pmo_id_arg":   pmoID,
		"user_id_arg":  userID,
		"tipo_arg":     "Limpeza",
		"payload_arg":  payload,
	})

	if err != nil {
		return fmt.Errorf("erro ao registrar limpeza: %w", err), nil
	}

	if status, ok := res["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco: %v", res["message"]), nil
	}

	return fmt.Sprintf("Limpeza de '%s' registrada com sucesso.", payload["item_area"]), nil
}

func (s *Server) handleRegistrarPropagacaoVegetal(args map[string]interface{}) (interface{}, error) {
	log.Printf("🌱 [MCP-TOOL] handleRegistrarPropagacaoVegetal Args: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)
	userID, _ := args["user_id"].(string)

	payload := map[string]interface{}{
		"tipo":             sanitize(args["tipo"]),
		"especies":         sanitize(args["especies"]),
		"origem":           sanitize(args["origem"]),
		"quantidade":       sanitize(args["quantidade"]),
		"sistema_organico": args["sistema_organico"],
		"data":             sanitize(args["data_compra"]),
	}

	if payload["especies"] == "" || payload["tipo"] == "" || payload["quantidade"] == "" {
		return "ERRO FATAL: Espécie, tipo e quantidade são obrigatórios.", nil
	}

	res, err := s.supabase.RegistrarOperacaoCampoRPC(context.Background(), map[string]interface{}{
		"pmo_id_arg":   pmoID,
		"user_id_arg":  userID,
		"tipo_arg":     "Propagacao",
		"payload_arg":  payload,
	})

	if err != nil {
		return fmt.Errorf("erro ao registrar propagação: %w", err), nil
	}

	if status, ok := res["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco: %v", res["message"]), nil
	}

	return fmt.Sprintf("Material de propagação '%s' (%s) registrado com sucesso.", payload["especies"], payload["tipo"]), nil
}

func (s *Server) handleRegistrarCompostagem(args map[string]interface{}) (interface{}, error) {
	log.Printf("🍂 [MCP-TOOL] handleRegistrarCompostagem Args: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)
	userID, _ := args["user_id"].(string)

	payload := map[string]interface{}{
		"acao":                sanitize(args["acao"]),
		"identificador_pilha": sanitize(args["identificador_pilha"]),
		"materiais":           sanitize(args["materiais"]),
		"temperatura":         args["temperatura"],
		"observacao":          sanitize(args["observacao"]),
		"data":                time.Now().Format("2006-01-02"),
	}

	if payload["acao"] == "" || payload["identificador_pilha"] == "" {
		return "ERRO FATAL: Ação e identificador da pilha são obrigatórios.", nil
	}

	res, err := s.supabase.RegistrarOperacaoCampoRPC(context.Background(), map[string]interface{}{
		"pmo_id_arg":   pmoID,
		"user_id_arg":  userID,
		"tipo_arg":     "Compostagem",
		"payload_arg":  payload,
	})

	if err != nil {
		return fmt.Errorf("erro ao processar ação de compostagem: %w", err), nil
	}

	if status, ok := res["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Aviso: %v", res["message"]), nil
	}

	return res["message"], nil
}

// sanitize cleans and truncates string inputs from the LLM.
// Prevents stored XSS, oversized payloads, and control character injection.
const maxInputLen = 500

func sanitize(val interface{}) string {
	s, ok := val.(string)
	if !ok {
		return ""
	}
	// 1. Trim whitespace
	s = strings.TrimSpace(s)
	// 2. Truncate to prevent oversized payloads
	if len(s) > maxInputLen {
		s = s[:maxInputLen]
	}
	// 3. Remove control characters (keep newlines for legitimate multi-line input)
	var clean strings.Builder
	for _, r := range s {
		if r == '\n' || r == '\r' || (r >= 32 && r != 127) {
			clean.WriteRune(r)
		}
	}
	return clean.String()
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

func (s *Server) handleRegistrarCompraInsumo(args map[string]interface{}) (interface{}, error) {
	log.Printf("🛒 [MCP-TOOL] handleRegistrarCompraInsumo Args: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)
	userID, _ := args["user_id"].(string)

	qtdValor, _ := parseArgToFloat(args["quantidade_valor"])
	qtdUnidade := sanitize(args["quantidade_unidade"])
	produto := sanitize(args["produto"])
	fornecedor := sanitize(args["fornecedor"])

	dataCompra := sanitize(args["data_compra"])
	if dataCompra == "" {
		dataCompra = time.Now().Format("2006-01-02")
	}

	rpcArgs := map[string]interface{}{
		"pmo_id_arg":             pmoID,
		"user_id_arg":            userID,
		"produto_arg":            produto,
		"quantidade_valor_arg":   qtdValor,
		"quantidade_unidade_arg": qtdUnidade,
		"fornecedor_arg":         fornecedor,
		"data_compra_arg":        dataCompra,
		"nota_fiscal_arg":        sanitize(args["nota_fiscal"]),
		"marca_arg":              sanitize(args["marca"]),
		"composicao_arg":         sanitize(args["composicao"]),
		"procedencia_arg":        sanitize(args["procedencia"]),
	}

	if produto == "" || qtdValor <= 0 || qtdUnidade == "" {
		return "ERRO FATAL: O usuário não informou o produto, a quantidade exata ou a unidade. Pergunte a ele os detalhes da compra.", nil
	}

	log.Printf("🛒 [MCP-TOOL] Chamando RPC para compra de '%s' para PMO %d", produto, pmoID)

	resp, err := s.supabase.RegistrarCompraInsumoRPC(context.Background(), rpcArgs)
	if err != nil {
		return fmt.Errorf("erro ao registrar compra via RPC: %w", err), nil
	}

	if status, ok := resp["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco de dados: %v", resp["message"]), nil
	}

	compraID := resp["compra_id"]

	return fmt.Sprintf("Compra de '%s' registrada com sucesso (ID: %s).", produto, compraID), nil
}

func (s *Server) handleRegistrarColheita(args map[string]interface{}) (interface{}, error) {
	log.Printf("🧺 [MCP-TOOL] handleRegistrarColheita Args: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)
	userID, _ := args["user_id"].(string)

	data := sanitize(args["data"])
	if data == "" {
		data = time.Now().Format("2006-01-02")
	}

	qtd, _ := parseArgToFloat(args["quantidade"])
	unidade := sanitize(args["unidade"])
	talhao := sanitize(args["talhao"])
	cultura := sanitize(args["cultura"])

	resp, err := s.supabase.RegistrarOperacaoCampoRPC(context.Background(), map[string]interface{}{
		"pmo_id_arg":  pmoID,
		"user_id_arg": userID,
		"tipo_arg":    "Colheita",
		"payload_arg": map[string]interface{}{
			"data":                data,
			"produto":             cultura,
			"quantidade_valor":    qtd,
			"quantidade_unidade":  unidade,
			"talhao_nome":         talhao,
			"destino_inicial":     sanitize(args["destino_inicial"]),
			"observacao_original": fmt.Sprintf("Colheita de %s registrada via MCP Tool.", cultura),
		},
	})
	if err != nil {
		return fmt.Sprintf("Erro ao registrar colheita via RPC: %v", err), nil
	}

	if status, ok := resp["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco de dados: %v", resp["message"]), nil
	}

	id := resp["id"]
	lote := resp["lote"]

	return fmt.Sprintf("Colheita de %v %s de %s registrada com sucesso (Lote: %s, ID: %s).", qtd, unidade, cultura, lote, id), nil
}

func (s *Server) handleRegistrarVenda(args map[string]interface{}) (interface{}, error) {
	log.Printf("💰 [MCP-TOOL] handleRegistrarVenda Args: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)
	userID, _ := args["user_id"].(string)

	data := sanitize(args["data"])
	if data == "" {
		data = time.Now().Format("2006-01-02")
	}

	qtd, _ := parseArgToFloat(args["quantidade"])
	unidade := sanitize(args["unidade"])
	valorUnit, _ := parseArgToFloat(args["valor_unitario"])
	produto := sanitize(args["produto"])
	cliente := sanitize(args["cliente"])

	resp, err := s.supabase.RegistrarOperacaoCampoRPC(context.Background(), map[string]interface{}{
		"pmo_id_arg":  pmoID,
		"user_id_arg": userID,
		"tipo_arg":    "Venda",
		"payload_arg": map[string]interface{}{
			"data":                data,
			"produto":             produto,
			"quantidade_valor":    qtd,
			"quantidade_unidade":  unidade,
			"fornecedor":          cliente,
			"destinacao":          sanitize(args["destinacao"]),
			"valor_unitario":      valorUnit,
			"observacao_original": fmt.Sprintf("Venda de %s para %s registrada via MCP Tool.", produto, cliente),
		},
	})
	if err != nil {
		return fmt.Sprintf("Erro ao registrar venda via RPC: %v", err), nil
	}

	if status, ok := resp["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco de dados: %v", resp["message"]), nil
	}

	id := resp["id"]

	return fmt.Sprintf("Registro de %s (%v %s) para '%s' salvo com sucesso (ID: %s).", produto, qtd, unidade, cliente, id), nil
}
