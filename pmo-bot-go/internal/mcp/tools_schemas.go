package mcp

// Schemas para validação de argumentos das ferramentas de banco de dados
// As tags validate usam github.com/go-playground/validator/v10

type CriarInfraestruturaSchema struct {
	NomeTalhao          string  `json:"nome_talhao" validate:"required"`
	AreaHectares        float64 `json:"area_hectares" validate:"required,gt=0"`
	QuantidadeCanteiros int     `json:"quantidade_canteiros"`
}

type AdicionarInsumoSchema struct {
	PmoID           int    `json:"-"`
	ProdutoManejo   string `json:"produto_manejo" validate:"required"`
	CulturaDestino  string `json:"cultura_destino"`
	EpocaFrequencia string `json:"epoca_frequencia"`
	Procedencia     string `json:"procedencia"`
	Composicao      string `json:"composicao"`
	Marca           string `json:"marca"`
	Dosagem         string `json:"dosagem" validate:"required"`
}

type RegistrarPropagacaoSchema struct {
	PmoID           int    `json:"-"`
	PropriedadeID   string `json:"-"` // Sometimes string in schema
	Tipo            string `json:"tipo" validate:"required,oneof=Compra/Aquisição Plantio Semeadura Transplante"`
	Especies        string `json:"especies"`
	Origem          string `json:"origem"`
	Quantidade      string `json:"quantidade" validate:"required"`
	SistemaOrganico bool   `json:"sistema_organico"`
}

type RegistrarLimpezaSchema struct {
	PmoID     int    `json:"-"`
	AreaLimpa string `json:"area_limpa" validate:"required"`
	Metodo    string `json:"metodo"`
	Insumos   string `json:"insumos"`
	Objetivo  string `json:"objetivo"`
}

type CriarTalhaoSchema struct {
	NomeTalhao   string  `json:"nome_talhao" validate:"required"`
	AreaHectares float64 `json:"area_hectares" validate:"required,gt=0"`
}

type CriarCanteirosSchema struct {
	TalhaoID   int `json:"talhao_id" validate:"required"`
	Quantidade int `json:"quantidade" validate:"required,gt=0"`
}

type RegistrarCompostagemSchema struct {
	PmoID        int    `json:"-"`
	Ingredientes string `json:"ingredientes" validate:"required"`
	Origem       string `json:"origem"`
	Volume       string `json:"volume" validate:"required"`
	UsoPrevisto  string `json:"uso_previsto"`
}

type RegistrarCompraSchema struct {
	PmoID      int    `json:"-"`
	Item       string `json:"item" validate:"required"`
	Fornecedor string `json:"fornecedor"`
	Quantidade string `json:"quantidade" validate:"required"`
	ValorPago  string `json:"valor_pago" validate:"required"`
	DataCompra string `json:"data_compra"`
}

type RegistrarDespesaSchema struct {
	Descricao     string  `json:"descricao" validate:"required"`
	ValorTotal    float64 `json:"valor_total" validate:"required"`
	CategoriaNome string  `json:"categoria_nome" validate:"required"`
	Data          string  `json:"data"`        // YYYY-MM-DD
	TalhaoNome    string  `json:"talhao_nome"` // Opcional
}


type RegistrarColheitaSchema struct {
	PmoID      int    `json:"-"`
	Cultura    string `json:"cultura" validate:"required"`
	Quantidade string `json:"quantidade" validate:"required"`
	Unidade    string `json:"unidade" validate:"required"`
	Talhao     string `json:"talhao" validate:"required"`
	Data       string `json:"data"`
	Destino    string `json:"destino"`
	Lote       string `json:"lote"`
}

type RegistrarVendaSchema struct {
	PmoID      int    `json:"-"`
	Produto    string `json:"produto" validate:"required"`
	Comprador  string `json:"comprador" validate:"required"`
	Quantidade string `json:"quantidade" validate:"required"`
	ValorVenda string `json:"valor_venda"`
	NotaFiscal string `json:"nota_fiscal"`
}

type SelecionarFazendaSchema struct {
	PropriedadeID int `json:"-"`
}

type SelecionarPMOSchema struct {
	PmoID    int    `json:"-"`
	AnoSafra string `json:"ano_safra"`
}

// Schemas de validação das ferramentas individuais registrar_compostagem,
// registrar_compra_insumo, registrar_limpeza e registrar_venda.
//
// Antes elas validavam com os structs de cima (RegistrarCompostagemSchema
// etc.), que usam os nomes de campo da ferramenta de LOTE — não os que a
// própria ferramenta anuncia ao LLM. Resultado: o validador sempre acusava
// "faltam campos obrigatórios" e essas 4 ferramentas nunca gravavam nada.
// Os structs de cima continuam valendo para registrar_lote_operacoes
// (OperacaoLoteItem). TestSchemaDeValidacaoBateComParametrosAnunciados
// impede que os dois lados voltem a divergir.

type RegistrarCompostagemToolSchema struct {
	Acao               string `json:"acao" validate:"required"`
	IdentificadorPilha string `json:"identificador_pilha" validate:"required"`
}

type RegistrarCompraInsumoToolSchema struct {
	Produto           string  `json:"produto" validate:"required"`
	QuantidadeValor   float64 `json:"quantidade_valor" validate:"required,gt=0"`
	QuantidadeUnidade string  `json:"quantidade_unidade" validate:"required"`
}

type RegistrarLimpezaToolSchema struct {
	ItemArea    string `json:"item_area" validate:"required"`
	TipoLimpeza string `json:"tipo_limpeza" validate:"required"`
}

type RegistrarVendaToolSchema struct {
	Produto    string `json:"produto" validate:"required"`
	Quantidade string `json:"quantidade" validate:"required"`
	Unidade    string `json:"unidade" validate:"required"`
	Destinacao string `json:"destinacao" validate:"required"`
}

type OperacaoLoteItem struct {
	Tipo        string                      `json:"tipo" validate:"required"`
	Limpeza     *RegistrarLimpezaSchema     `json:"limpeza,omitempty"`
	Propagacao  *RegistrarPropagacaoSchema  `json:"propagacao,omitempty"`
	Compostagem *RegistrarCompostagemSchema `json:"compostagem,omitempty"`
	Compra      *RegistrarCompraSchema      `json:"compra,omitempty"`
	Colheita    *RegistrarColheitaSchema    `json:"colheita,omitempty"`
	Venda       *RegistrarVendaSchema       `json:"venda,omitempty"`
}

type RegistrarLoteOperacoesSchema struct {
	Operacoes []OperacaoLoteItem `json:"operacoes" validate:"required,min=1"`
}
