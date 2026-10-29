package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// CalcularAdubacaoDef is the agnostic definition for the agronomic calculation tool.
var CalcularAdubacaoDef = llm.FerramentaAgnostica{
	Name: "calcular_recomendacao_adubacao",
	// Regras gerais de comportamento do agente (IDs técnicos, extração de
	// propriedade_id, lógica de "área total") vivem no system prompt — ver
	// prompts/system_prompt.md e prompts/agronomist.md. Estavam duplicadas aqui
	// por engano, o que inflava o payload de TODA chamada e misturava instrução
	// global com a descrição de uma ferramenta específica.
	Description: "Calcula a dose recomendada de adubo orgânico (NPK) baseada na cultura, meta de produtividade e adubo disponível. Use esta ferramenta sempre que o usuário pedir recomendações de adubação ou quiser saber quanto de adubo usar.",
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

// RegistrarPlantioDef defines the schema for the RegistrarPlantio mutation tool.
var RegistrarPlantioDef = llm.FerramentaAgnostica{
	Name:        "RegistrarPlantio",
	Description: "Registra a operação de plantio ou propagação no caderno de campo.",
	Parameters: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"especies": map[string]interface{}{
				"type":        "string",
				"description": "A cultura ou espécie plantada (ex: Alface, Tomate).",
			},
			"quantidade_valor": map[string]interface{}{
				"type":        "number",
				"description": "Valor numérico da quantidade plantada.",
			},
			"quantidade_unidade": map[string]interface{}{
				"type":        "string",
				"description": "Unidade de medida da quantidade (ex: mudas, kg, sementes).",
			},
			"talhao_nome": map[string]interface{}{
				"type":        "string",
				"description": "Nome do talhão onde foi feito o plantio.",
			},
			"data": map[string]interface{}{
				"type":        "string",
				"description": "Data do plantio no formato YYYY-MM-DD (Opcional, preenche com hoje se vazio).",
			},
			"origem": map[string]interface{}{
				"type":        "string",
				"description": "Origem das mudas ou sementes (Opcional).",
			},
		},
		"required": []string{"especies", "quantidade_valor", "quantidade_unidade", "talhao_nome"},
	},
}

// InitializeTools registers the initial set of tools to the MCP server.
func (s *Server) InitializeTools() {
	s.RegisterTool(Tool{
		Definition: ProposeBatchMutationsDef,
		Category:   CategoryDBWrite,
		Handler:    s.handleProposeBatchMutations,
	})

	s.RegisterTool(Tool{
		Definition: RegistrarLoteOperacoesDef,
		Category:   CategoryDBWrite,
		Handler:    s.handleRegistrarLote,
	})
	regLoteSnake := RegistrarLoteOperacoesDef
	regLoteSnake.Name = "registrar_lote_operacoes"
	s.RegisterTool(Tool{
		Definition: regLoteSnake,
		Category:   CategoryDBWrite,
		Handler:    s.handleRegistrarLote,
	})

	s.RegisterTool(Tool{
		Definition: CalcularAdubacaoDef,
		Category:   CategoryDBWrite,
		Handler:    s.handleCalcularAdubacao,
	})

	s.RegisterTool(Tool{
		Definition: RegistrarPlantioDef,
		Category:   CategoryDBWrite,
		Handler:    s.handleRegistrarPlantio,
	})
	regPlantioSnake := RegistrarPlantioDef
	regPlantioSnake.Name = "registrar_plantio"
	s.RegisterTool(Tool{
		Definition: regPlantioSnake,
		Category:   CategoryDBWrite,
		Handler:    s.handleRegistrarPlantio,
	})

	s.RegisterTool(Tool{
		Definition: SalvarMemoriaProdutorDef,
		Category:   CategoryDBWrite,
		Handler:    s.handleSalvarMemoria,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_base_conhecimento",
			Description: "Usa esta ferramenta para pesquisar manuais, regras de plantio, historico da fazenda e normas globais organicas. Os documentos sao categorizados por fonte: 'institucional' (EMBRAPA, MAPA), 'academico' (artigos, dissertacoes) e 'movimentos_sociais' (MST, agroecologia). Foreca categoria_fonte se o usuario indicar a origem do conhecimento desejado.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
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
				"required": []string{"pergunta"},
			},
		},
		Category: CategoryRAG,
		Handler:  s.handleConsultarBaseConhecimento,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "ConsultarLeiOrganica_RAG",
			Description: "Consulta os manuais técnicos e a Lei Orgânica 10.831 na base de conhecimento (RAG) do sistema. OBRIGATÓRIO para responder sobre legislações e regras gerais orgânicas.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "A pergunta ou termo de busca para pesquisar sobre a lei orgânica.",
					},
				},
				"required": []string{"query"},
			},
		},
		Category: CategoryRAG,
		Handler:  s.handleConsultarLeiOrganica,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_dados_fazenda",
			Description: "Usa esta ferramenta para consultar a estrutura da fazenda (talhões e canteiros). Para o produtor ver os registros dele (compras, colheitas, plantios, manejos, vendas), use consultar_registros.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
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
				"required": []string{"tabela"},
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
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &CriarInfraestruturaSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleCriarInfraestruturaFazenda,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "adicionar_insumo_pmo",
			Description: "Usa esta ferramenta para cadastrar insumos e equipamentos (Seção 8 do PMO) como fertilizantes, sementes compradas, substratos ou ferramentas novas.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
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
				"required": []string{"produto_manejo", "dosagem"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &AdicionarInsumoSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleAdicionarInsumoPMO,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_propagacao_vegetal",
			Description: "Usa esta ferramenta para registrar a origem de sementes, mudas ou material propagativo (Seção 9 do PMO).",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
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
				"required": []string{"tipo", "especies", "quantidade"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &RegistrarPropagacaoSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleRegistrarPropagacaoVegetal,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_limpeza",
			Description: "Usa esta ferramenta para registrar a higienização de instalações, equipamentos ou ferramentas (Seção 4 / Formulário 04 do PMO).",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"item_area":         map[string]interface{}{"type": "string", "description": "O que foi limpo (Ex: Trator, Galpão, Enxadas)."},
					"tipo_limpeza":      map[string]interface{}{"type": "string", "description": "Como foi feito (Ex: Lavagem, Varrição, Desinfecção)."},
					"produto_utilizado": map[string]interface{}{"type": "string", "description": "Produto usado, se houver (Ex: Sabão neutro, Álcool 70%)."},
					"dosagem":           map[string]interface{}{"type": "string", "description": "Quantidade do produto usado."},
					"responsavel":       map[string]interface{}{"type": "string", "description": "Quem realizou a limpeza (Default: Produtor)."},
				},
				"required": []string{"item_area", "tipo_limpeza"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &RegistrarLimpezaToolSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleRegistrarLimpeza,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "criar_talhao",
			Description: "Ferramenta OBRIGATÓRIA para criação de nova área produtiva (talhão). SEMPRE use esta tool para cadastrar o nome e área do talhão antes de registrar atividades nele. NÃO use ferramentas de colheita/venda para criar áreas.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"nome_talhao":   map[string]interface{}{"type": "string", "description": "Nome descritivo (Ex: Gleba 01, Horta dos Pomares)."},
					"area_hectares": map[string]interface{}{"type": "number", "description": "Tamanho da área em hectares (Ex: 0.5, 1.2)."},
					"cultura":       map[string]interface{}{"type": "string", "description": "Cultura principal plantada (Opcional)."},
				},
				"required": []string{"nome_talhao", "area_hectares"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &CriarTalhaoSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleCriarNovoTalhao,
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
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &CriarCanteirosSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleCriarNovosCanteiros,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_compostagem",
			Description: "Usa esta ferramenta para registrar a montagem, revirada, controle de temperatura, adição de água ou uso de lotes de compostagem (Formulário 05).",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"acao":                map[string]interface{}{"type": "string", "description": "Ação realizada: 'Nova Pilha', 'Revirada', 'Temperatura', 'Agua' ou 'Uso'.", "enum": []string{"Nova Pilha", "Revirada", "Temperatura", "Agua", "Uso"}},
					"identificador_pilha": map[string]interface{}{"type": "string", "description": "Identificador ou número da pilha (ex: 'Pilha 01')."},
					"materiais":           map[string]interface{}{"type": "string", "description": "Apenas se acao = 'Nova Pilha'. Ingredientes adicionados."},
					"temperatura":         map[string]interface{}{"type": "number", "description": "Apenas se fornecida temperatura (em ºC)."},
					"observacao":          map[string]interface{}{"type": "string", "description": "Observações adicionais ou notas."},
				},
				"required": []string{"acao", "identificador_pilha"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &RegistrarCompostagemToolSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleRegistrarCompostagem,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_compra_insumo",
			Description: "Usa esta ferramenta para registrar a compra ou aquisição de um insumo, produto, semente, ferramenta ou serviço (Formulário 06 da certificação orgânica). Obrigatório quando o agricultor relatar que 'comprou' algo ou recebeu 'nota fiscal'.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
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
					"alocacoes_talhoes": map[string]interface{}{
						"type":        "array",
						"description": "Lista de alocações (rateio) do valor da compra entre diferentes talhões da propriedade.",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"talhao_id": map[string]interface{}{
									"type":        "integer",
									"description": "ID do talhão (se conhecido).",
								},
								"talhao_nome": map[string]interface{}{
									"type":        "string",
									"description": "Nome do talhão (ex: 'Talhão 1', 'Canteiro A') para resolução no banco.",
								},
								"valor_alocado": map[string]interface{}{
									"type":        "number",
									"description": fmt.Sprintf("Valor financeiro (%s) alocado para este talhão.", utils.MoedaSimbolo()),
								},
							},
							"required": []string{"talhao_nome", "valor_alocado"},
						},
					},
					"categoria_nome": map[string]interface{}{
						"type":        "string",
						"description": "Nome da categoria da despesa (ex: 'Insumos', 'Manutenção', 'Logística/Frete'). Opcional.",
					},
				},
				"required": []string{"produto", "quantidade_valor", "quantidade_unidade"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &RegistrarCompraInsumoToolSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleRegistrarCompraInsumo,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_colheita",
			Description: "Registra a colheita em um talhão já existente. JAMAIS use esta ferramenta para criar um talhão novo; use 'criar_talhao' primeiro.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
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
				"required": []string{"cultura", "talhao", "quantidade", "unidade"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &RegistrarColheitaSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleRegistrarColheita,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_avicultura",
			Description: "Regista um evento das galinhas/frangos/pintos do produtor, um por chamada: entrada de aves num lote (compra ou nascimento de pintos), ovos recolhidos, aves mortas, vacinação, pesagem, abate, ou saída (venda, consumo, doação de aves vivas). Use esta ferramenta para aves em vez de propose_batch_mutations ou registrar_colheita. Venda de ovos é registrar_venda. O lote é escolhido sozinho quando o produtor só tem um; se a ferramenta perguntar, repasse a pergunta.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"evento": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"entrada", "postura", "mortalidade", "vacinacao", "pesagem", "abate", "saida"},
						"description": "entrada = aves que chegaram ao lote; postura = ovos recolhidos; mortalidade = aves mortas; vacinacao; pesagem = peso médio; abate; saida = aves vivas vendidas, consumidas ou doadas.",
					},
					"quantidade":    map[string]interface{}{"type": "number", "description": "Número de aves; em postura, número de ovos; em pesagem, peso médio por ave em kg. Uma dúzia = 12 ovos; uma bandeja/cartela = 30 ovos."},
					"lote":          map[string]interface{}{"type": "string", "description": "Nome do lote (ex.: Lote 1), só se o produtor disser. Na entrada sem nome, o lote novo recebe nome automático."},
					"finalidade":    map[string]interface{}{"type": "string", "enum": []string{"corte", "postura", "dupla"}, "description": "Só na entrada: corte (carne), postura (ovos) ou dupla (galinha cafreal/landim, para os dois)."},
					"raca":          map[string]interface{}{"type": "string", "description": "Raça ou linhagem, se dita (ex.: Cobb, Ross, landim, cafreal, Kuroiler)."},
					"vacina":        map[string]interface{}{"type": "string", "description": "Na vacinação: nome da vacina (ex.: Newcastle, Gumboro, Bouba)."},
					"causa":         map[string]interface{}{"type": "string", "description": "Na mortalidade: causa, se o produtor disser (doença, calor, predador...)."},
					"peso_medio_kg": map[string]interface{}{"type": "number", "description": "No abate ou na saída: peso médio por ave em kg, se dito."},
					"valor_total":   map[string]interface{}{"type": "number", "description": "Dinheiro envolvido, se dito: o que pagou pelos pintos/vacina, ou o que recebeu pelas aves abatidas/vendidas."},
					"cliente":       map[string]interface{}{"type": "string", "description": "Comprador das aves, se dito."},
					"data":          map[string]interface{}{"type": "string", "description": "Data do evento (YYYY-MM-DD). Omitir se foi hoje."},
					"observacao":    map[string]interface{}{"type": "string", "description": "Outra informação útil dita pelo produtor."},
				},
				"required": []string{"evento", "quantidade"},
			},
		},
		Category: CategoryDBWrite,
		Handler:  s.handleRegistrarAvicultura,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_avicultura",
			Description: "Mostra como estão as aves do produtor, por lote: quantas aves vivas, mortalidade, ovos dos últimos 7 dias e taxa de postura, última vacina e peso médio. Use quando perguntar quantas galinhas/frangos tem, quantos ovos deu, como está o lote. A resposta vai pronta ao produtor.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"lote": map[string]interface{}{"type": "string", "description": "Nome do lote, só se o produtor pedir um específico."},
				},
			},
		},
		Category: CategoryDBRead,
		Handler:  s.handleConsultarAvicultura,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_despesa",
			Description: "Ferramenta para registrar despesas financeiras (compras, pagamentos). IMPORTANTE: Você PRECISA do valor_total e da descricao. Se o usuário não informar o valor, NÃO chame a ferramenta, pergunte a ele primeiro.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"descricao": map[string]interface{}{
						"type":        "string",
						"description": "Descrição do que foi comprado ou pago (ex: 10 sacos de adubo).",
					},
					"valor_total": map[string]interface{}{
						"type":        "number",
						"description": "Valor total pago pela despesa.",
					},
					"categoria_nome": map[string]interface{}{
						"type":        "string",
						"description": "Nome da categoria (ex: Insumos, Mão de Obra, Manutenção, Logística/Frete, Energia/Água, Outros).",
					},
					"data": map[string]interface{}{
						"type":        "string",
						"description": "Data da despesa no formato YYYY-MM-DD. Opcional.",
					},
					"talhao_nome": map[string]interface{}{
						"type":        "string",
						"description": "Se a despesa for destinada a um talhão específico, informe o nome aqui. Opcional.",
					},
				},
				"required": []string{"descricao", "valor_total", "categoria_nome"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &RegistrarDespesaSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleRegistrarDespesa,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_venda",
			Description: "Registra a venda ou saída de produtos colhidos. Ferramenta de atividade de campo, não administrativa de infraestrutura.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
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
				"required": []string{"produto", "quantidade", "unidade", "destinacao"},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &RegistrarVendaToolSchema{},
			RequiresConfirmation: true,
		},
		Handler: s.handleRegistrarVenda,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "selecionar_fazenda",
			Description: "Usa esta ferramenta quando o agricultor quer trocar de fazenda ou pede para 'voltar' para outra propriedade. Atualiza a fazenda ativa no perfil do usuário.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"nome_propriedade": map[string]interface{}{"type": "string", "description": "O nome da fazenda (para feedback amigável)."},
				},
				"required": []string{},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &SelecionarFazendaSchema{},
			RequiresConfirmation: false,
		},
		Handler: s.handleSelecionarFazenda,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "selecionar_pmo",
			Description: "Usa esta ferramenta quando o agricultor quer trocar o Plano de Manejo Orgânico (PMO) atual ou pede para trabalhar em outro ano/plano. Atualiza o PMO ativo no perfil do usuário.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"ano_safra": map[string]interface{}{"type": "string", "description": "O ano ou identificador do PMO (para feedback amigável)."},
				},
				"required": []string{},
			},
		},
		Category: CategoryDBWrite,
		Options: &ToolOptions{
			Schema:               &SelecionarPMOSchema{},
			RequiresConfirmation: false,
		},
		Handler: s.handleSelecionarPMO,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_demandas_cooperativa",
			Description: "Consulta o 'Mural de Demandas' das cooperativas e associações às quais o agricultor está vinculado. Use esta ferramenta sempre que o usuário perguntar sobre 'demandas atuais', 'o que a cooperativa está pedindo', 'quais produtos são necessários', 'contratos abertos' ou 'oportunidades de venda'. Esta ferramenta retorna dados estruturados e atualizados diretamente do banco de dados, sendo a fonte primária para informações de mercado.",
			Parameters: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
		Category: CategoryDBRead,
		Handler:  s.handleConsultarDemandasCooperativa,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name: "consultar_registros",
			Description: "Lista os registros do caderno de campo do produtor (compras, colheitas, plantios/sementeiras, manejos/aplicações, vendas), " +
				"mais recentes primeiro, já formatados para o WhatsApp. Use sempre que o produtor quiser VER o que registrou: " +
				"'o que comprei este mês', 'minhas últimas colheitas', 'o que apliquei no talhão 2', 'quanto gastei em adubo'. " +
				"Com modo='total' soma por produto ('quanto colhi de tomate este ano'); com modo='resumo' resume o período inteiro " +
				"('como foi o mês', 'resumo da semana'). Para saldo/receitas/despesas totais use consultar_balanco_financeiro.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tipo": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"todos", "compra", "colheita", "plantio", "manejo", "venda", "avicultura"},
						"description": "Tipo de registro. 'todos' se o produtor não especificar.",
					},
					"modo": map[string]interface{}{
						"type": "string",
						"enum": []string{"lista", "total", "resumo"},
						"description": "'lista' (padrão): registro a registro. 'total': perguntas de 'quanto' (quanto colhi, quanto comprei de X) — soma por produto. " +
							"'resumo': visão geral do período com todos os tipos (ignora 'tipo'; sem datas = mês atual).",
					},
					"data_inicio": map[string]interface{}{
						"type":        "string",
						"description": "Primeiro dia do período (AAAA-MM-DD), calculado a partir da data de hoje. Ex.: 'este mês' = dia 1 do mês atual. Omita se o produtor não falar de período.",
					},
					"data_fim": map[string]interface{}{
						"type":        "string",
						"description": "Último dia do período (AAAA-MM-DD). Omita para 'até hoje'.",
					},
					"produto": map[string]interface{}{
						"type":        "string",
						"description": "Filtra por produto ou insumo (ex.: 'adubo', 'milho', 'NPK'). Opcional.",
					},
					"talhao": map[string]interface{}{
						"type":        "string",
						"description": "Filtra por talhão/canteiro/machamba (ex.: 'talhão 2'). Opcional.",
					},
				},
				"required": []string{"tipo"},
			},
		},
		Category: CategoryDBRead,
		Handler:  s.handleConsultarRegistros,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name: "enviar_link_app",
			Description: "Envia ao produtor um link que abre o app já logado (válido 10 min, uso único). Use quando ele pedir para ver tudo, " +
				"ver no app/no computador, ou pedir o link do caderno ou do financeiro.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"destino": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"caderno", "financeiro"},
						"description": "Tela que o link abre. 'caderno' se não for sobre dinheiro.",
					},
				},
				"required": []string{"destino"},
			},
		},
		Category: CategoryDBRead,
		Handler:  s.handleEnviarLinkApp,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name: "enviar_caderno_pdf",
			Description: "Envia ao produtor, pelo WhatsApp, o caderno de campo do período em PDF (todos os registos, com totais). Use quando ele pedir " +
				"o caderno em PDF/arquivo/documento, o extrato, ou algo para imprimir ou mostrar a comprador, banco ou técnico. Sem período, vale o mês corrente.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"data_inicio": map[string]interface{}{"type": "string", "description": "AAAA-MM-DD, opcional."},
					"data_fim":    map[string]interface{}{"type": "string", "description": "AAAA-MM-DD, opcional."},
				},
			},
		},
		Category: CategoryDBRead,
		Handler:  s.handleEnviarCadernoPDF,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_balanco_financeiro",
			Description: "Retorna o balanço financeiro (DRE) da fazenda (receitas, despesas, saldo, e top despesas), já formatado para o WhatsApp. Use quando o produtor pedir saldo, lucro, receitas, despesas ou balanço. Para 'como foi o mês' ou 'resumo do mês' use consultar_registros com modo='resumo'. OBRIGATÓRIO: Use sempre o ano atual (2026) por padrão se o usuário não especificar o ano no contexto da pergunta.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"ano": map[string]interface{}{
						"type":        "integer",
						"description": "O ano do balanço (ex: 2026). OBRIGATÓRIO: Se o usuário não especificar o ano, você DEVE fornecer o ano atual (2026) como padrão.",
					},
					"mes": map[string]interface{}{
						"type":        "integer",
						"description": "O mês do balanço (1 a 12). Se o utilizador pedir o ano todo, deixa vazio.",
					},
				},
				"required": []string{"ano"},
			},
		},
		Category: CategoryDBRead,
		Handler:  s.handleConsultarBalancoFinanceiro,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_previsao_tempo",
			Description: "Consulta a previsão do tempo para uma localidade específica (cidade ou latitude/longitude). Retorna as condições atuais e a previsão para os próximos dias, incluindo temperatura, chance de chuva e bônus agrícolas (como evapotranspiração).",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"cidade_informada": map[string]interface{}{
						"type":        "string",
						"description": "Nome da cidade ou coordenadas informada na mesma frase. Apenas se o usuário pedir explicitamente para uma cidade, senão omita.",
					},
					"data_alvo": map[string]interface{}{
						"type":        "string",
						"description": "A data ou período desejado (ex: 'hoje', 'amanhã', 'próximos 3 dias'). Opcional.",
					},
				},
				"required": []string{},
			},
		},
		Category: CategoryRAG, // RAG is used for knowledge/read-only info
		Handler:  s.handleConsultarPrevisaoTempo,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "consultar_janela_plantio",
			Description: "Consulta a janela oficial de plantio (ZARC/MAPA) de uma cultura no municipio da propriedade: em quais periodos do ano o plantio tem risco climatico de 20%, 30% ou 40%. Use sempre que o produtor perguntar se pode plantar algo agora, qual a melhor epoca de plantio, se esta atrasado, ou ate quando da para plantar. Se a cultura nao for zoneada pelo ZARC (tomate, alface, cenoura e outras olericolas), devolve uma janela de referencia da literatura agronomica, claramente marcada como nao-oficial. Para machambas em Mocambique (sem ZARC), devolve janelas de sementeira de referencia por zona agroecologica (calendario da FAO/IIAM), tambem nao-oficiais.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"cultura": map[string]interface{}{
						"type":        "string",
						"description": "Nome da cultura (ex: Cebola, Batata, Mandioca, Banana).",
					},
					"cidade_informada": map[string]interface{}{
						"type":        "string",
						"description": "Cidade e estado informados na mesma frase, com a UF (ex: 'Uberlandia, MG'); em Mocambique, distrito e provincia (ex: 'Boane, Maputo', 'Chokwe, Gaza'). Apenas se o produtor perguntar explicitamente sobre outro lugar; senao omita.",
					},
				},
				"required": []string{"cultura"},
			},
		},
		Category: CategoryRAG, // dado oficial de referencia, somente leitura
		Handler:  s.handleConsultarJanelaPlantio,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "cadastrar_propriedade",
			Description: "Cadastra uma nova propriedade rural (fazenda/sítio) e cria automaticamente o PMO inicial para ela. Seleciona a nova propriedade como ativa para o produtor.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"nome": map[string]interface{}{
						"type":        "string",
						"description": "Nome da fazenda ou propriedade rural (Ex: Sítio Vista Alegre).",
					},
					"area_total_ha": map[string]interface{}{
						"type":        "number",
						"description": "Área total da propriedade em hectares.",
					},
					"municipio": map[string]interface{}{
						"type":        "string",
						"description": "Cidade / Município da propriedade. Em Moçambique, o DISTRITO (ex: Boane, Chókwè).",
					},
					"uf": map[string]interface{}{
						"type":        "string",
						"description": "Estado (UF) com 2 letras (Ex: SP, MG, PR). Em Moçambique, a PROVÍNCIA (ex: Maputo, Gaza, Manica).",
					},
					"modalidade_predominante": map[string]interface{}{
						"type":        "string",
						"description": "Modalidade de produção (Ex: Organico, Agroecologico, Permacultura).",
					},
				},
				"required": []string{"nome"},
			},
		},
		Category: CategoryDBWrite,
		Handler:  s.handleCadastrarPropriedade,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_manejo_campo",
			Description: "Registra operações gerais de manejo no campo (adubação orgânica, biofertilizantes, caldas, poda, capina, controle biológico, irrigação) no caderno de campo.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tipo_manejo": map[string]interface{}{
						"type":        "string",
						"description": "Tipo de manejo realizado (Ex: Adubação Orgânica, Calda Bordalesa, Poda, Irrigação, Capina Manual).",
					},
					"talhao_nome": map[string]interface{}{
						"type":        "string",
						"description": "Nome do talhão onde a atividade foi realizada (Ex: Talhão 01, Horta).",
					},
					"canteiro_numero": map[string]interface{}{
						"type":        "integer",
						"description": "Número do canteiro específico (opcional).",
					},
					"produto_utilizado": map[string]interface{}{
						"type":        "string",
						"description": "Produto, insumo ou calda aplicada (Ex: Esterco bovino curtido, Calda bordalesa 1%, Biofertilizante Supermagro).",
					},
					"dosagem_valor": map[string]interface{}{
						"type":        "number",
						"description": "Quantidade ou dosagem aplicada.",
					},
					"dosagem_unidade": map[string]interface{}{
						"type":        "string",
						"description": "Unidade de dosagem (Ex: kg/ha, L/bomba, kg/canteiro).",
					},
					"data": map[string]interface{}{
						"type":        "string",
						"description": "Data da operação no formato YYYY-MM-DD. Opcional.",
					},
					"observacoes": map[string]interface{}{
						"type":        "string",
						"description": "Observações agronômicas ou notas adicionais.",
					},
				},
				"required": []string{"tipo_manejo", "talhao_nome"},
			},
		},
		Category: CategoryDBWrite,
		Handler:  s.handleRegistrarManejoCampo,
	})

	s.RegisterTool(Tool{
		Definition: llm.FerramentaAgnostica{
			Name:        "registrar_cota_cooperativa",
			Description: "Registra o compromisso formal de entrega de uma cota de produção para atender a uma demanda coletiva aberta da cooperativa/associação.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"demanda_id": map[string]interface{}{
						"type":        "string",
						"description": "ID ou código da demanda coletiva à qual a cota está vinculada.",
					},
					"quantidade_comprometida": map[string]interface{}{
						"type":        "number",
						"description": "Quantidade física que o produtor se compromete a entregar.",
					},
					"unidade": map[string]interface{}{
						"type":        "string",
						"description": "Unidade de medida (Ex: kg, caixas, maços).",
					},
					"data_prevista_entrega": map[string]interface{}{
						"type":        "string",
						"description": "Data estimada para entrega no formato YYYY-MM-DD.",
					},
					"observacoes": map[string]interface{}{
						"type":        "string",
						"description": "Observações adicionais sobre o compromisso.",
					},
				},
				"required": []string{"demanda_id", "quantidade_comprometida"},
			},
		},
		Category: CategoryDBWrite,
		Handler:  s.handleRegistrarCotaCooperativa,
	})
}

var RegistrarLoteOperacoesDef = llm.FerramentaAgnostica{
	Name:        "RegistrarLoteOperacoes",
	Description: "Registra múltiplas operações agrícolas em lote (colheita, plantio, venda, manejo, limpeza, compostagem, compra). Use esta ferramenta quando o usuário relatar mais de uma operação simultaneamente para otimizar o tempo e reduzir chamadas.",
	Parameters: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"operacoes": map[string]interface{}{
				"type":        "array",
				"description": "Lista de operações a serem registradas.",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"tipo": map[string]interface{}{
							"type": "string",
							"enum": []string{"Limpeza", "Propagacao", "Compostagem", "Compra", "Colheita", "Venda"},
						},
						"limpeza":     map[string]interface{}{"type": "object", "description": "Dados da limpeza, se tipo=Limpeza"},
						"propagacao":  map[string]interface{}{"type": "object"},
						"compostagem": map[string]interface{}{"type": "object"},
						"compra":      map[string]interface{}{"type": "object"},
						"colheita":    map[string]interface{}{"type": "object"},
						"venda":       map[string]interface{}{"type": "object"},
					},
					"required": []string{"tipo"},
				},
			},
		},
		"required": []string{"operacoes"},
	},
}

func (s *Server) handleRegistrarLote(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	// SECURE SESSION INJECTION — pmo_id/user_id do TenantCtx, nunca dos args (DT-67)
	pmoID := int(tenant.PmoID)
	userID := tenant.UserID

	var payload RegistrarLoteOperacoesSchema
	payloadBytes, _ := json.Marshal(args)
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("formato inválido para lote: %w", err)
	}

	result, err := s.agriRepo.RegistrarLoteOperacoes(context.Background(), pmoID, tenant.PropriedadeID, userID, payload.Operacoes)
	if err != nil {
		return nil, fmt.Errorf("erro no processamento do lote: %w", err)
	}

	return result, nil
}

// ProposeBatchMutationsDef defines the tool for proposing batch mutations in Two-Phase Commit HITL.
var ProposeBatchMutationsDef = llm.FerramentaAgnostica{
	Name:        "propose_batch_mutations",
	Description: "Propõe uma ou mais operações de mutação (caderno_campo, compra_insumo, transacoes_com_rateio, cotas_produtores) em lote para aprovação humana do produtor (Two-Phase Commit HITL). Utilize esta ferramenta sempre que o produtor relatar ações concluídas como compras, plantios, colheitas, manejos ou despesas para criar um rascunho seguro para confirmação.",
	Parameters: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"operacoes": map[string]interface{}{
				"type":        "array",
				"description": "Lista de operações a serem validadas e propostas.",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"type": map[string]interface{}{
							"type":        "string",
							"enum":        []string{"caderno_campo", "compra_insumo", "transacoes_com_rateio", "cotas_produtores"},
							"description": "Tipo de mutação no banco de dados.",
						},
						"tipo_operacao": map[string]interface{}{
							"type":        "string",
							"description": "Subtipo para caderno_campo (ex: plantio, colheita, manejo, limpeza, compostagem).",
						},
						"payload": map[string]interface{}{
							"type":        "object",
							"description": "Dados da operação (ex: produto, quantidade_valor, quantidade_unidade, talhao_nome, valor_total, etc.).",
						},
					},
					"required": []string{"type", "payload"},
				},
			},
			"resumo_amigavel": map[string]interface{}{
				"type":        "string",
				"description": "Resumo curto em português das operações propostas (opcional).",
			},
		},
		"required": []string{"operacoes"},
	},
}

func (s *Server) handleProposeBatchMutations(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	phone := tenant.Telefone

	var payload domain.ProposeBatchMutationsPayload
	payloadBytes, _ := json.Marshal(args)
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("formato inválido para propose_batch_mutations: %w", err)
	}

	if len(payload.Operacoes) == 0 {
		return nil, fmt.Errorf("lista de operações não pode ser vazia")
	}

	res, err := s.supabase.CreateOrSupersedeMutationDraftRPC(ctx, pmoID, userID, phone, payload.Operacoes, payload.ResumoAmigavel, 45)
	if err != nil {
		return nil, fmt.Errorf("erro ao criar rascunho de mutação: %w", err)
	}

	draftID, _ := res["draft_id"].(string)
	confirmationMsg := guardrails.BuildBatchConfirmationMessage(phone, payload.ResumoAmigavel, payload.Operacoes)
	if avisos := s.avisosDuplicata(ctx, pmoID, phone, payload.Operacoes); len(avisos) > 0 {
		confirmationMsg = strings.Join(avisos, "\n") + "\n\n" + confirmationMsg
	}

	return map[string]interface{}{
		"status":          "pending_approval",
		"draft_id":        draftID,
		"mensagem":        confirmationMsg,
		"operacoes_count": len(payload.Operacoes),
		"message":         confirmationMsg,
	}, nil
}
