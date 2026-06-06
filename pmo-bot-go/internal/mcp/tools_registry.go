package mcp

import (
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

// CalcularAdubacaoDef is the agnostic definition for the agronomic calculation tool.
var CalcularAdubacaoDef = llm.FerramentaAgnostica{
	Name:        "calcular_recomendacao_adubacao",
	Description: "Calcula a dose recomendada de adubo orgânico (NPK) baseada na cultura, meta de produtividade e adubo disponível. Use esta ferramenta sempre que o usuário pedir recomendações de adubação ou quiser saber quanto de adubo usar. # 7. NO TECHNICAL IDs: NUNCA mostre IDs de transação ou UUIDs. No entanto, para registros de *COLHEITA*, você DEVE obrigatoriamente informar o Lote gerado (Rastreabilidade) ao final da confirmação (ex: Lote: COL-20260415-TOM-123).\n# 8. EXTRAÇÃO DE CONTEXTO: Sempre que usar ferramentas de registro (colheita, venda, manejo, limpeza, etc.), você DEVE extrair o `propriedade_id` do cabeçalho de contexto injetado no sistema e enviá-lo como argumento obrigatório.\n# 9. LÓGICA DE ÁREA TOTAL: Se o usuário utilizar termos como \"área total\", \"toda a gleba\", \"gleba inteira\", \"tudo\" ou \"na gleba toda\" ao se referir a um local, você DEVE acrescentar o sufixo \" - Área Total\" ao nome do talhão/gleba no argumento da ferramenta (ex: \"Gleba 1 - Área Total\").",
	Parameters: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"cultura": map[string]interface{}{
				"type":        "string",
				"description": "Nome da cultura (ex: Alface, Tomate).",
			},
			"meta_produtividade": map[string]interface{}{
				"type":        "number",
				"description": "Meta de produtividade desejada em toneladas por hectare (t/ha).",
			},
			"adubo_base_nome": map[string]interface{}{
				"type":        "string",
				"description": "Nome do adubo orgânico disponível (ex: Esterco Bovino Curtido, Torta de Mamona).",
			},
		},
		"required": []string{"cultura", "meta_produtividade", "adubo_base_nome"},
	},
}

// InitializeTools registers the initial set of tools to the MCP server.
func (s *Server) InitializeTools() {
	s.RegisterTool(Tool{
		Definition: CalcularAdubacaoDef,
		Category:   CategoryDatabase,
		Handler:    s.handleCalcularAdubacao,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_base_conhecimento",
			Description: "Usa esta ferramenta para pesquisar manuais, regras de plantio, historico da fazenda e normas globais organicas. Os documentos sao categorizados por fonte: 'institucional' (EMBRAPA, MAPA), 'academico' (artigos, dissertacoes) e 'movimentos_sociais' (MST, agroecologia). Foreca categoria_fonte se o usuario indicar a origem do conhecimento desejado.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id": map[string]interface{}{
						"type":        "integer",
						"description": "ID do PMO (fazenda) do usuario para filtrar os documentos.",
					},
					"pergunta": map[string]interface{}{
						"type":        "string",
						"description": "A pergunta ou termo de busca para pesquisar na base de conhecimento.",
					},
					"categoria_fonte": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"institucional", "academico", "movimentos_sociais", "geral"},
						"description": "Filtro opcional: restringir a busca a uma categoria de fonte. Omita para buscar em todas as categorias.",
					},
				},
				"required": []string{"pmo_id", "pergunta"},
			},
		},
		Category: CategoryRAG,
		Handler:  s.handleConsultarBaseConhecimento,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_dados_fazenda",
			Description: "Usa esta ferramenta para consultar dados estruturados da fazenda como talhões, canteiros ativos e registros recentes do caderno de campo.",
			Parameters: map[string]interface{}{
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
		},
		Category: CategoryRAG,
		Handler:  s.handleConsultarDadosFazenda,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "criar_infraestrutura_fazenda",
			Description: "Ferramenta PRINCIPAL para configuração da estrutura física. Cria um talhão completo e seus canteiros em um único passo. Use esta ferramenta sempre que o usuário pedir para 'montar', 'criar' ou 'configurar' a infraestrutura da fazenda.",
			Parameters: map[string]interface{}{
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
		},
		Category: CategoryDatabase,
		Handler:  s.handleCriarInfraestruturaFazenda,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "adicionar_insumo_pmo",
			Description: "Usa esta ferramenta para cadastrar insumos e equipamentos (Seção 8 do PMO) como fertilizantes, sementes compradas, substratos ou ferramentas novas.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":          map[string]interface{}{"type": "integer"},
					"produto_manejo":  map[string]interface{}{"type": "string", "description": "Nome do insumo ou equipamento (Ex: Esterco de curral, Enxada, Substrato)."},
					"cultura_destino": map[string]interface{}{"type": "string", "description": "Para qual cultura este insumo será usado (Ex: Alface, Milho)."},
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
		},
		Category: CategoryDatabase,
		Handler:  s.handleAdicionarInsumoPMO,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_propagacao_vegetal",
			Description: "Usa esta ferramenta para registrar a origem de sementes, mudas ou material propagativo (Seção 9 do PMO).",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":         map[string]interface{}{"type": "integer"},
					"propriedade_id": map[string]interface{}{"type": "string", "description": "ID da propriedade (fazenda) ativa."},
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
					"valor_total": map[string]interface{}{
						"type":        "number",
						"description": "O valor total em dinheiro gasto na operação/compra (opcional).",
					},
				},
				"required": []string{"pmo_id", "propriedade_id", "tipo", "especies", "quantidade"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleRegistrarPropagacaoVegetal,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_limpeza",
			Description: "Usa esta ferramenta para registrar a higienização de instalações, equipamentos ou ferramentas (Seção 4 / Formulário 04 do PMO).",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":            map[string]interface{}{"type": "integer"},
					"propriedade_id":    map[string]interface{}{"type": "string", "description": "ID da propriedade (fazenda) ativa."},
					"item_area":         map[string]interface{}{"type": "string", "description": "O que foi limpo (Ex: Trator, Galpão, Enxadas)."},
					"tipo_limpeza":      map[string]interface{}{"type": "string", "description": "Como foi feito (Ex: Lavagem, Varrição, Desinfecção)."},
					"produto_utilizado": map[string]interface{}{"type": "string", "description": "Produto usado, se houver (Ex: Sabão neutro, Álcool 70%)."},
					"dosagem":           map[string]interface{}{"type": "string", "description": "Quantidade do produto usado."},
					"responsavel":       map[string]interface{}{"type": "string", "description": "Quem realizou a limpeza (Default: Produtor)."},
				},
				"required": []string{"pmo_id", "propriedade_id", "item_area", "tipo_limpeza"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleRegistrarLimpeza,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "criar_talhao",
			Description: "Ferramenta OBRIGATÓRIA para criação de nova área produtiva (talhão). SEMPRE use esta tool para cadastrar o nome e área do talhão antes de registrar atividades nele. NÃO use ferramentas de colheita/venda para criar áreas.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":         map[string]interface{}{"type": "integer"},
					"propriedade_id": map[string]interface{}{"type": "integer", "description": "ID da propriedade (fazenda) onde o talhão será criado."},
					"nome_talhao":    map[string]interface{}{"type": "string", "description": "Nome descritivo (Ex: Gleba 01, Horta dos Pomares)."},
					"area_hectares":  map[string]interface{}{"type": "number", "description": "Tamanho da área em hectares (Ex: 0.5, 1.2)."},
					"cultura":        map[string]interface{}{"type": "string", "description": "Cultura principal plantada (Opcional)."},
				},
				"required": []string{"pmo_id", "propriedade_id", "nome_talhao", "area_hectares"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleCriarNovoTalhao,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "criar_canteiros",
			Description: "Ferramenta OBRIGATÓRIA para criação de canteiros em lote dentro de um talhão existente. Altera a configuração física da área.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"talhao_id":             map[string]interface{}{"type": "integer"},
					"quantidade":            map[string]interface{}{"type": "integer", "description": "Número de canteiros a criar."},
					"identificador_inicial": map[string]interface{}{"type": "integer", "description": "Número do primeiro canteiro (Ex: 1)."},
				},
				"required": []string{"talhao_id", "quantidade", "identificador_inicial"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleCriarNovosCanteiros,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_compostagem",
			Description: "Usa esta ferramenta para registrar a montagem, revirada, controle de temperatura, adição de água ou uso de lotes de compostagem (Formulário 05).",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":              map[string]interface{}{"type": "integer"},
					"propriedade_id":      map[string]interface{}{"type": "string", "description": "ID da propriedade (fazenda) ativa."},
					"acao":                map[string]interface{}{"type": "string", "description": "Ação realizada: 'Nova Pilha', 'Revirada', 'Temperatura', 'Agua' ou 'Uso'.", "enum": []string{"Nova Pilha", "Revirada", "Temperatura", "Agua", "Uso"}},
					"identificador_pilha": map[string]interface{}{"type": "string", "description": "Identificador ou número da pilha (ex: 'Pilha 01')."},
					"materiais":           map[string]interface{}{"type": "string", "description": "Apenas se acao = 'Nova Pilha'. Ingredientes adicionados."},
					"temperatura":         map[string]interface{}{"type": "number", "description": "Apenas se fornecida temperatura (em ºC)."},
					"observacao":          map[string]interface{}{"type": "string", "description": "Observações adicionais ou notas."},
				},
				"required": []string{"pmo_id", "propriedade_id", "acao", "identificador_pilha"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleRegistrarCompostagem,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_compra_insumo",
			Description: "Usa esta ferramenta para registrar a compra ou aquisição de um insumo, produto, semente, ferramenta ou serviço (Formulário 06 da certificação orgânica). Obrigatório quando o agricultor relatar que 'comprou' algo ou recebeu 'nota fiscal'.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":         map[string]interface{}{"type": "integer"},
					"propriedade_id": map[string]interface{}{"type": "string", "description": "ID da propriedade (fazenda) ativa."},
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
					"valor_total": map[string]interface{}{
						"type":        "number",
						"description": "O valor total em dinheiro gasto na operação/compra (opcional).",
					},
				},
				"required": []string{"pmo_id", "propriedade_id", "produto", "quantidade_valor", "quantidade_unidade"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleRegistrarCompraInsumo,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_colheita",
			Description: "Registra a colheita em um talhão já existente. JAMAIS use esta ferramenta para criar um talhão novo; use 'criar_talhao' primeiro.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":          map[string]interface{}{"type": "integer"},
					"propriedade_id":  map[string]interface{}{"type": "string", "description": "ID da propriedade (fazenda) ativa."},
					"data":            map[string]interface{}{"type": "string", "description": "Data da colheita (YYYY-MM-DD)."},
					"cultura":         map[string]interface{}{"type": "string", "description": "Nome da cultura colhida (Ex: Alface Crespa, Tomate)."},
					"talhao":          map[string]interface{}{"type": "string", "description": "Nome do talhão onde foi colhido (Ex: Talhão 01)."},
					"quantidade":      map[string]interface{}{"type": "number", "description": "Quantidade colhida."},
					"unidade":         map[string]interface{}{"type": "string", "description": "Unidade de medida (Ex: kg, maços, caixas)."},
					"destino_inicial": map[string]interface{}{"type": "string", "description": "Para onde foi o produto logo após a colheita (Ex: Depósito, Câmara Fria, Lavagem).", "default": "Depósito"},
					"valor_total": map[string]interface{}{
						"type":        "number",
						"description": "O valor total em dinheiro gasto na operação (opcional).",
					},
				},
				"required": []string{"pmo_id", "propriedade_id", "cultura", "talhao", "quantidade", "unidade"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleRegistrarColheita,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_venda",
			Description: "Registra a venda ou saída de produtos colhidos. Ferramenta de atividade de campo, não administrativa de infraestrutura.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":         map[string]interface{}{"type": "integer"},
					"propriedade_id": map[string]interface{}{"type": "string", "description": "ID da propriedade (fazenda) ativa."},
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
					"valor_total": map[string]interface{}{
						"type":        "number",
						"description": "O valor total recebido na venda (opcional, se omitido calcula-se como quantidade * valor_unitario).",
					},
				},
				"required": []string{"pmo_id", "propriedade_id", "produto", "quantidade", "unidade", "destinacao"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleRegistrarVenda,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "selecionar_fazenda",
			Description: "Usa esta ferramenta quando o agricultor quer trocar de fazenda ou pede para 'voltar' para outra propriedade. Atualiza a fazenda ativa no perfil do usuário.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"propriedade_id":   map[string]interface{}{"type": "integer", "description": "O ID da propriedade (fazenda) que o usuário quer ativar."},
					"nome_propriedade": map[string]interface{}{"type": "string", "description": "O nome da fazenda (para feedback amigável)."},
				},
				"required": []string{"propriedade_id"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleSelecionarFazenda,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "selecionar_pmo",
			Description: "Usa esta ferramenta quando o agricultor quer trocar o Plano de Manejo Orgânico (PMO) atual ou pede para trabalhar em outro ano/plano. Atualiza o PMO ativo no perfil do usuário.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pmo_id":    map[string]interface{}{"type": "integer", "description": "O ID do PMO que o usuário quer ativar."},
					"ano_safra": map[string]interface{}{"type": "string", "description": "O ano ou identificador do PMO (para feedback amigável)."},
				},
				"required": []string{"pmo_id"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleSelecionarPMO,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_demandas_cooperativa",
			Description: "Consulta o 'Mural de Demandas' das cooperativas e associações às quais o agricultor está vinculado. Use esta ferramenta sempre que o usuário perguntar sobre 'demandas atuais', 'o que a cooperativa está pedindo', 'quais produtos são necessários', 'contratos abertos' ou 'oportunidades de venda'. Esta ferramenta retorna dados estruturados e atualizados diretamente do banco de dados, sendo a fonte primária para informações de mercado.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"propriedade_id": map[string]interface{}{
						"type":        "integer",
						"description": "ID da propriedade ativa do usuário (fazenda). OBRIGATÓRIO: Extraia do cabeçalho de contexto injetado pelo sistema.",
					},
				},
				"required": []string{"propriedade_id"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleConsultarDemandasCooperativa,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_balanco_financeiro",
			Description: "Retorna o balanço financeiro (DRE) da fazenda (receitas, despesas, saldo, e top despesas). OBRIGATÓRIO: Use sempre o ano atual (2026) por padrão se o usuário não especificar o ano no contexto da pergunta.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"propriedade_id": map[string]interface{}{
						"type":        "integer",
						"description": "ID da propriedade ativa do usuário (fazenda). OBRIGATÓRIO: Extraia do cabeçalho de contexto injetado pelo sistema.",
					},
					"ano": map[string]interface{}{
						"type":        "integer",
						"description": "O ano do balanço (ex: 2026). OBRIGATÓRIO: Se o usuário não especificar o ano, você DEVE fornecer o ano atual (2026) como padrão.",
					},
					"mes": map[string]interface{}{
						"type":        "integer",
						"description": "O mês do balanço (1 a 12). Se o utilizador pedir o ano todo, deixa vazio.",
					},
				},
				"required": []string{"propriedade_id", "ano"},
			},
		},
		Category: CategoryDatabase,
		Handler:  s.handleConsultarBalancoFinanceiro,
	})
}
