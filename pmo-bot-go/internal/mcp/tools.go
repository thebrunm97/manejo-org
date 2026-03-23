package mcp

import (
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

	s.RegisterTool(Tool{
		Name:        "adicionar_insumo_pmo",
		Description: "Usa esta ferramenta para cadastrar insumos e equipamentos (Seção 8 do PMO) como fertilizantes, sementes compradas, substratos ou ferramentas novas.",
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
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"pmo_id":            map[string]interface{}{"type": "integer"},
				"item_area":          map[string]interface{}{"type": "string", "description": "O que foi limpo (Ex: Trator, Galpão, Enxadas)."},
				"tipo_limpeza":       map[string]interface{}{"type": "string", "description": "Como foi feito (Ex: Lavagem, Varrição, Desinfecção)."},
				"produto_utilizado":  map[string]interface{}{"type": "string", "description": "Produto usado, se houver (Ex: Sabão neutro, Álcool 70%)."},
				"dosagem":            map[string]interface{}{"type": "string", "description": "Quantidade do produto usado."},
				"responsavel":        map[string]interface{}{"type": "string", "description": "Quem realizou a limpeza (Default: Produtor)."},
			},
			"required": []string{"pmo_id", "item_area", "tipo_limpeza"},
		},
		Handler: s.handleRegistrarLimpeza,
	})

	s.RegisterTool(Tool{
		Name:        "criar_talhao",
		Description: "Usa esta ferramenta para criar um novo talhão (área produtiva) na fazenda.",
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
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"talhao_id":            map[string]interface{}{"type": "integer"},
				"quantidade":           map[string]interface{}{"type": "integer", "description": "Número de canteiros a criar."},
				"identificador_inicial": map[string]interface{}{"type": "integer", "description": "Número do primeiro canteiro (Ex: 1)."},
			},
			"required": []string{"talhao_id", "quantidade", "identificador_inicial"},
		},
		Handler: s.handleCriarNovosCanteiros,
	})

	s.RegisterTool(Tool{
		Name:        "registrar_compostagem",
		Description: "Usa esta ferramenta para registrar a montagem, revirada, controle de temperatura, adição de água ou uso de lotes de compostagem (Formulário 05).",
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

	record := supabase.PmoLimpezaInsert{
		PmoID:            pmoID,
		DataLimpeza:      time.Now().Format("2006-01-02"),
		ItemArea:         sanitize(args["item_area"]),
		TipoLimpeza:      sanitize(args["tipo_limpeza"]),
		ProdutoUtilizado: sanitize(args["produto_utilizado"]),
		Dosagem:          sanitize(args["dosagem"]),
		Responsavel:      sanitize(args["responsavel"]),
	}

	if record.Responsavel == "" {
		record.Responsavel = "Produtor"
	}

	log.Printf("🧽 [MCP-TOOL] Registrando limpeza de '%s' para PMO %d", record.ItemArea, pmoID)

	err := s.supabase.InsertPMOLimpeza(record)
	if err != nil {
		return fmt.Sprintf("Erro ao inserir registro de limpeza: %v", err), nil
	}

	return fmt.Sprintf("Registro de limpeza para '%s' (%s) salvo com sucesso.", record.ItemArea, record.TipoLimpeza), nil
}

func (s *Server) handleRegistrarPropagacaoVegetal(args map[string]interface{}) (interface{}, error) {
	log.Printf("🚨 [DEBUG TOOL] handleRegistrarPropagacaoVegetal Args recebidos do LLM: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)

	sistemaOrganico := true
	if val, ok := args["sistema_organico"].(bool); ok {
		sistemaOrganico = val
	}

	record := supabase.PmoPropagacaoInsert{
		PmoID:           pmoID,
		Tipo:            sanitize(args["tipo"]),
		Especies:        sanitize(args["especies"]),
		Origem:          sanitize(args["origem"]),
		Quantidade:      sanitize(args["quantidade"]),
		SistemaOrganico: sistemaOrganico,
		DataCompra:      sanitize(args["data_compra"]),
	}

	log.Printf("🌱 [MCP-TOOL] Registrando propagação '%s' para PMO %d", record.Especies, pmoID)

	qtd := strings.TrimSpace(strings.ToUpper(record.Quantidade))
	if record.Especies == "" || record.Tipo == "" || qtd == "" || qtd == "0" || qtd == "NÃO INFORMADO" || qtd == "NULL" || qtd == "NENHUM" || strings.Contains(qtd, "0 ") {
		return "ERRO FATAL: O usuário não informou a quantidade exata. Não adivinhe nem use zeros. Pergunte a ele: 'Quantas mudas/sementes você comprou ou plantou?'", nil
	}

	err := s.supabase.InsertPMOPropagacao(record)
	if err != nil {
		return fmt.Sprintf("Erro ao inserir propagação: %v", err), nil
	}

	return fmt.Sprintf("Material de propagação '%s' (%s) registrado com sucesso na Seção 9 do seu plano.", record.Especies, record.Tipo), nil
}

func (s *Server) handleRegistrarCompostagem(args map[string]interface{}) (interface{}, error) {
	log.Printf("🍂 [DEBUG TOOL] handleRegistrarCompostagem Args: %+v", args)

	pmoIDFloat, _ := parseArgToFloat(args["pmo_id"])
	pmoID := int64(pmoIDFloat)

	// UserID is injected by the FSM
	userID, _ := args["user_id"].(string)

	acao := sanitize(args["acao"])
	identificador := sanitize(args["identificador_pilha"])

	if acao == "" || identificador == "" {
		return "ERRO FATAL: Ação e identificador da pilha são obrigatórios.", nil
	}

	if acao == "Nova Pilha" {
		record := supabase.PmoCompostagemInsert{
			PmoID:        pmoID,
			UserID:       userID,
			NPilha:       identificador,
			Ingredientes: sanitize(args["materiais"]),
			DataMontagem: time.Now().Format("2006-01-02"),
			Status:       "ativo",
		}
		err := s.supabase.InsertPMOCompostagem(record)
		if err != nil {
			return fmt.Sprintf("Erro ao criar nova pilha de compostagem no Supabase: %v", err), nil
		}
		return fmt.Sprintf("Nova pilha '%s' registrada com sucesso de forma estruturada.", identificador), nil
	}

	// For Revirada, Temperatura, Agua, Uso -> Fetch the pile UUID
	pilhaID, err := s.supabase.LookupCompostagemID(pmoID, userID, identificador)
	if err != nil {
		return fmt.Sprintf("Aviso: %v. Responda ao usuário que a pilha não existe e pergunte se ele deseja iniciar uma 'Nova Pilha' antes de registrar eventos nela.", err), nil
	}

	var temp float64
	if val, ok := args["temperatura"]; ok && val != nil {
		temp, _ = parseArgToFloat(val)
	}

	evtType := ""
	switch acao {
	case "Revirada":
		evtType = "revirada"
	case "Temperatura":
		evtType = "temperatura"
	case "Agua":
		evtType = "agua"
	case "Uso":
		evtType = "uso"
	default:
		evtType = strings.ToLower(acao) // fallback
	}

	evt := supabase.PmoCompostagemEventoInsert{
		PilhaID:          pilhaID,
		TipoEvento:       evtType,
		ValorTemperatura: temp,
		DataEvento:       time.Now().Format("2006-01-02"),
		Observacao:       sanitize(args["observacao"]),
	}

	err = s.supabase.InsertPMOCompostagemEvento(evt)
	if err != nil {
		return fmt.Sprintf("Erro ao inserir evento na compostagem: %v", err), nil
	}

	msg := fmt.Sprintf("Evento '%s' registrado com sucesso na pilha '%s'.", evtType, identificador)
	if temp > 0 {
		msg += fmt.Sprintf(" Temperatura informada: %.1f°C.", temp)
	}
	return msg, nil
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

	dataCompra := sanitize(args["data_compra"])
	if dataCompra == "" {
		dataCompra = time.Now().Format("2006-01-02")
	}

	record := supabase.CadernoCampoInsert{
		PmoID:             pmoID,
		UsuarioID:         userID,
		TipoAtividade:     "Insumo",
		DataRegistro:      dataCompra,
		Produto:           sanitize(args["produto"]),
		QuantidadeValor:   qtdValor,
		QuantidadeUnidade: qtdUnidade,
		Fornecedor:        sanitize(args["fornecedor"]),
		NotaFiscal:        sanitize(args["nota_fiscal"]),
	}

	if record.Produto == "" || qtdValor <= 0 || qtdUnidade == "" {
		return "ERRO FATAL: O usuário não informou o produto, a quantidade exata ou a unidade. Pergunte a ele os detalhes da compra.", nil
	}

	log.Printf("🛒 [MCP-TOOL] Registrando compra de '%s' para PMO %d", record.Produto, pmoID)

	id, err := s.supabase.InsertCadernoCampo(record)
	if err != nil {
		return fmt.Sprintf("Erro ao registrar compra na Tabela de Compras: %v", err), nil
	}

	return fmt.Sprintf("Compra de '%s' registrada com sucesso (Formulário 06).", record.Produto), nil
}
