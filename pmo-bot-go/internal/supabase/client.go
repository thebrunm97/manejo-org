package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/utils"
	"sync"
)

// Config represents the Supabase credentials
type Config struct {
	URL string
	Key string // Service Role Key
}

// Client wraps HTTP communication with Supabase REST API
type Client struct {
	config         Config
	httpClient     *http.Client
	blacklistCache []string
	cacheMutex     sync.RWMutex
}

// NewClient initializes the Supabase client
func NewClient(cfg Config) (*Client, error) {
	if cfg.URL == "" || cfg.Key == "" {
		return nil, fmt.Errorf("SUPABASE_URL or SUPABASE_KEY is missing")
	}
	c := &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
	
	// Initial load of blacklist
	if err := c.RefreshBlacklist(); err != nil {
		log.Printf("⚠️ [Supabase] Falha inicial ao carregar blacklist: %v", err)
	}

	return c, nil
}

// ---------------------------------------------------------------------------
// Structs mapped directly from the DB Schema
// ---------------------------------------------------------------------------

type Profile struct {
	ID                     string   `json:"id"`
	Nome                   string   `json:"nome,omitempty"`
	Telefone               string   `json:"telefone,omitempty"`
	PmoAtivoID           int64    `json:"pmo_ativo_id,omitempty"`
	PropriedadeAtivaID    int64    `json:"propriedade_ativa_id,omitempty"`
	ModalidadePredominante string   `json:"modalidade_predominante,omitempty"`
	TemProducaoParalela    bool     `json:"tem_producao_paralela,omitempty"`
	Talhoes                []Talhao `json:"talhoes,omitempty"`
}

type Talhao struct {
	ID                int64  `json:"id"`
	Nome              string `json:"nome"`
	ModalidadeProducao string `json:"modalidade_producao"`
}

type LidMapping struct {
	ID          string `json:"id"`
	LidID       string `json:"lid_id"`
	PhoneNumber string `json:"phone_number"`
}

type CadernoCampoInsert struct {
	PmoID              *int64                 `json:"pmo_id,omitempty"`
	UsuarioID          string                 `json:"user_id,omitempty"`
	TipoAtividade      string                 `json:"tipo_atividade"`
	DataRegistro       string                 `json:"data_registro,omitempty"`
	SecaoOrigem        string                 `json:"secao_origem,omitempty"`
	Produto            string                 `json:"produto,omitempty"`
	TalhaoCanteiro     string                 `json:"talhao_canteiro,omitempty"`
	QuantidadeValor    float64                `json:"quantidade_valor,omitempty"`
	QuantidadeUnidade  string                 `json:"quantidade_unidade,omitempty"`
	ObservacaoOriginal string                 `json:"observacao_original,omitempty"`
	DetalhesTecnicos   map[string]interface{} `json:"detalhes_tecnicos,omitempty"`
	HouveDescartes     bool                   `json:"houve_descartes"`
	QtdDescartes       float64                `json:"qtd_descartes,omitempty"`
	Fornecedor         string                 `json:"fornecedor,omitempty"`
	NotaFiscal         string                 `json:"nota_fiscal,omitempty"`
	Canteiros          []string               `json:"-"` // Used internally to map to JSONB (UUIDs)
	InsumoAplicado     string                 `json:"-"` // Used internally to map to detalhes_tecnicos
}

type LogProcessamentoInsert struct {
	PmoID            *int64      `json:"pmo_id"`
	MensagemUsuario  string      `json:"mensagem_usuario"`
	RespostaBot      string      `json:"resposta_bot"`
	ModeloConfigurado string     `json:"modelo_configurado"`
	ModeloEfetivo    string      `json:"modelo_efetivo"`
	TokensPrompt     int         `json:"tokens_prompt"`
	TokensCompletion int         `json:"tokens_completion"`
	Intencao         string      `json:"intencao"`
	CustoDolar       float64     `json:"custo_dolar"`
	RaciocinioAgente interface{} `json:"raciocinio_agente"`
}

type LogTreinamentoInsert struct {
	PmoID         *int64                 `json:"pmo_id"`
	UserID        string                 `json:"user_id"`
	TextoUsuario  string                 `json:"texto_usuario"`
	JsonExtraido  map[string]interface{} `json:"json_extraido"`
	TipoAtividade string                 `json:"tipo_atividade"`
	ModeloIA      string                 `json:"modelo_ia"`
}

type LogConsumoInsert struct {
	UserID           string                 `json:"user_id"`
	RequestID        string                 `json:"request_id,omitempty"`
	TokensPrompt     int                    `json:"tokens_prompt"`
	TokensCompletion int                    `json:"tokens_completion"`
	TotalTokens      int                    `json:"total_tokens"`
	ModeloIA         string                 `json:"modelo_ia"`
	Acao             string                 `json:"acao"`
	CustoEstimado    float64                `json:"custo_estimado"`
	DuracaoMs        int64                  `json:"duracao_ms"`
	Status           string                 `json:"status"`
	Meta             map[string]interface{} `json:"meta,omitempty"`
}

type IngestionJob struct {
	ID              string `json:"id,omitempty"`
	PmoID           int64  `json:"pmo_id,omitempty"`
	FileName        string `json:"file_name"`
	Status          string `json:"status"`
	TotalChunks     int    `json:"total_chunks"`
	ProcessedChunks int    `json:"processed_chunks"`
	ErrorLog        string `json:"error_log,omitempty"`
}

type TalhaoInsert struct {
	PmoID          *int64                 `json:"pmo_id"`
	PropriedadeID  int64                  `json:"propriedade_id"` // Link obrigatório com a fazenda
	UserID         string                 `json:"user_id"`
	Nome           string                 `json:"nome"`
	AreaTotalM2    float64                `json:"area_total_m2"`
	AreaHectares   float64                `json:"area_ha"`
	Cultura        string                 `json:"cultura"`
	Geometry       map[string]interface{} `json:"geometry"`
}

type CanteiroInsert struct {
	TalhaoID int64  `json:"talhao_id"`
	Nome     string `json:"nome"`
}

type FarmDocument struct {
	PmoID        *int64    `json:"pmo_id"` // Pointer to allow NULL (Global)
	DocumentName string    `json:"document_name"`
	Content      string    `json:"content"`
	Embedding    []float32 `json:"embedding"`
}

type DocumentMatch struct {
	ID           int64   `json:"id"`
	DocumentName string  `json:"document_name"`
	Content      string  `json:"content"`
	Similarity   float32 `json:"similarity"`
	IsGlobal     bool    `json:"is_global"`
}

type PmoInsumoInsert struct {
	PmoID           *int64 `json:"pmo_id"`
	ProdutoManejo   string `json:"produto_manejo"`
	CulturaDestino  string `json:"cultura_destino,omitempty"`
	EpocaFrequencia string `json:"epoca_frequencia,omitempty"`
	Procedencia     string `json:"procedencia,omitempty"`
	Composicao      string `json:"composicao,omitempty"`
	Marca           string `json:"marca,omitempty"`
	Dosagem         string `json:"dosagem,omitempty"`
}

type PmoPropagacaoInsert struct {
	PmoID           *int64 `json:"pmo_id"`
	Tipo            string `json:"tipo"` // semente, muda, etc
	Especies        string `json:"especies"`
	Origem          string `json:"origem,omitempty"`
	Quantidade      string `json:"quantidade,omitempty"`
	SistemaOrganico bool   `json:"sistema_organico"`
	DataCompra      string `json:"data_compra,omitempty"` // "YYYY-MM-DD"
}

type PmoLimpezaInsert struct {
	PmoID            *int64 `json:"pmo_id"`
	DataLimpeza      string `json:"data_limpeza"`
	ItemArea         string `json:"item_area"`
	TipoLimpeza      string `json:"tipo_limpeza"`
	ProdutoUtilizado string `json:"produto_utilizado,omitempty"`
	Dosagem          string `json:"dosagem,omitempty"`
	Responsavel      string `json:"responsavel"`
	Observacao       string `json:"observacao,omitempty"`
}

type PmoCompostagemInsert struct {
	PmoID        *int64 `json:"pmo_id"`
	UserID       string `json:"user_id"`
	NPilha       string `json:"n_pilha"`
	Ingredientes string `json:"ingredientes,omitempty"`
	DataMontagem string `json:"data_montagem"`
	Status       string `json:"status"`
}

type PmoCompostagemEventoInsert struct {
	PilhaID          string  `json:"pilha_id"`
	TipoEvento       string  `json:"tipo_evento"`
	ValorTemperatura float64 `json:"valor_temperatura,omitempty"`
	DataEvento       string  `json:"data_evento"`
	Observacao       string  `json:"observacao,omitempty"`
}

type PmoClimaInsert struct {
	PmoID         *int64      `json:"pmo_id"`
	TemperaturaC  float64     `json:"temperatura_c"`
	Umidade       int         `json:"umidade"`
	VentoKph      float64     `json:"vento_kph"`
	CondicaoTexto string      `json:"condicao_texto"`
	CondicaoIcone string      `json:"condicao_icone"`
	PrevisaoDias  interface{} `json:"previsao_dias"`
}

type PmoLocation struct {
	ID    int64
	Query string
}

type InsumoProibido struct {
	Nome string `json:"nome"`
}

type DemandaColetiva struct {
	ID            string    `json:"id"`
	Titulo        string    `json:"titulo"`
	Cultura       string    `json:"cultura"`
	Quantidade    float64   `json:"quantidade"`
	Unidade       string    `json:"unidade"`
	DataEntrega   string    `json:"data_entrega"`
	PrecoBase     float64   `json:"preco_base"`
	Status        string    `json:"status"` // aberta, em_captacao, preenchida, encerrada, cancelada
	Modalidade    string    `json:"modalidade"` // TODAS, ORGANICO, etc
}

type CotaProdutorInsert struct {
	DemandaID     string  `json:"demanda_id"`
	PropriedadeID int64   `json:"propriedade_id"`
	UsuarioID     string  `json:"usuario_id"`
	Quantidade    float64 `json:"quantidade"`
}

type CronogramaPlantioInsert struct {
	CotaID      string `json:"cota_id"`
	DataPlantio string `json:"data_plantio"`
	Observacao  string `json:"observacao_ia,omitempty"`
}

// RefreshBlacklist fetches the current prohibited inputs from the database
func (c *Client) RefreshBlacklist() error {
	reqURL := fmt.Sprintf("%s/rest/v1/insumos_proibidos?select=nome", c.config.URL)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return err
	}

	var items []InsumoProibido
	if err := json.Unmarshal(body, &items); err != nil {
		return err
	}

	newCache := make([]string, len(items))
	for i, item := range items {
		newCache[i] = utils.Normalize(item.Nome)
	}

	c.cacheMutex.Lock()
	c.blacklistCache = newCache
	c.cacheMutex.Unlock()

	log.Printf("✅ [Supabase] Blacklist carregada: %d itens", len(newCache))
	return nil
}

// IsProhibitedCheck goes through the cached blacklist to check for chemical inputs
func (c *Client) IsProhibitedCheck(input string) bool {
	c.cacheMutex.RLock()
	defer c.cacheMutex.RUnlock()

	inputLower := utils.Normalize(input)
	for _, item := range c.blacklistCache {
		// Busca parcial simples (contém)
		if strings.Contains(inputLower, item) {
			return true
		}
	}
	return false
}

// StartBlacklistAutoRefresh creates a background routine to refresh the blacklist cache
func (c *Client) StartBlacklistAutoRefresh(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	// We don't defer ticker.Stop() here because this is intended to run for the life of the app
	// unless the context is canceled.
	
	log.Printf("🔄 [Supabase] Blacklist Auto-Refresh iniciado (intervalo: %v)", interval)
	
	for {
		select {
		case <-ticker.C:
			if err := c.RefreshBlacklist(); err != nil {
				log.Printf("❌ [Supabase] Erro no auto-refresh da blacklist: %v", err)
			}
		case <-ctx.Done():
			ticker.Stop()
			return
		}
	}
}

// ---------------------------------------------------------------------------
// Main Methods
// ---------------------------------------------------------------------------

// ResolvePhone checks lid_mappings for a WhatsApp LID, otherwise assumes it's already a phone.
func (c *Client) ResolvePhone(from string) (string, error) {
	// 1. Sanitize the string right away
	sanitized := utils.SanitizePhone(from)

	// If it's a LID, check the database mapping
	if strings.Contains(from, "@lid") {
		lidStr := strings.Split(from, "@")[0]

		reqURL := fmt.Sprintf("%s/rest/v1/lid_mappings?lid_id=eq.%s&select=phone_number", c.config.URL, lidStr)
		body, err := c.doRequest(http.MethodGet, reqURL, nil)
		if err != nil {
			return sanitized, err
		}

		var mappings []LidMapping
		if err := json.Unmarshal(body, &mappings); err != nil {
			return sanitized, err
		}

		if len(mappings) > 0 {
			return utils.SanitizePhone(mappings[0].PhoneNumber), nil
		}

		// Fallback
		return sanitized, nil
	}

	// Fallback general
	return sanitized, nil
}

// GetProfileByPhone fetches the user's active profile using their phone number
func (c *Client) GetProfileByPhone(phone string) (*Profile, error) {
	phone = utils.SanitizePhone(phone)

	// Fetch profile with active property and its talhões (Corrected nesting: properties -> talhoes)
	selectQuery := "*,propriedades:propriedade_ativa_id(modalidade_predominante,tem_producao_paralela,talhoes:talhoes(id,nome,modalidade_producao))"
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?telefone=eq.%s&select=%s", c.config.URL, phone, selectQuery)
	var results []struct {
		Profile
		Propriedades struct {
			ModalidadePredominante string   `json:"modalidade_predominante"`
			TemProducaoParalela    bool     `json:"tem_producao_paralela"`
			Talhoes                []Talhao `json:"talhoes"`
		} `json:"propriedades"`
	}

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err == nil {
		if err := json.Unmarshal(body, &results); err == nil && len(results) > 0 {
			p := results[0].Profile
			p.ModalidadePredominante = results[0].Propriedades.ModalidadePredominante
			p.TemProducaoParalela = results[0].Propriedades.TemProducaoParalela
			p.Talhoes = results[0].Propriedades.Talhoes
			return &p, nil
		}
	} else {
		log.Printf("⚠️ [Supabase] Falha na consulta de perfil complexa (detalhes: %v). Tentando fallbacks...", err)
	}

	// Segunda tentativa: Formato BR sem o 9º dígito
	if len(phone) == 13 && strings.HasPrefix(phone, "55") {
		fallbackPhone := phone[:4] + phone[5:]
		reqURL = fmt.Sprintf("%s/rest/v1/profiles?telefone=eq.%s&select=%s", c.config.URL, fallbackPhone, selectQuery)

		body, err = c.doRequest(http.MethodGet, reqURL, nil)
		if err == nil {
			if err := json.Unmarshal(body, &results); err == nil && len(results) > 0 {
				p := results[0].Profile
				p.ModalidadePredominante = results[0].Propriedades.ModalidadePredominante
				p.TemProducaoParalela = results[0].Propriedades.TemProducaoParalela
				p.Talhoes = results[0].Propriedades.Talhoes
				return &p, nil
			}
		}
	}

	// Terceira tentativa: Tentar LIKE pegando os ultimos 8 digitos
	if len(phone) >= 8 {
		last8 := phone[len(phone)-8:]
		reqURL = fmt.Sprintf("%s/rest/v1/profiles?telefone=ilike.*%s*&select=%s", c.config.URL, last8, selectQuery)
		body, err = c.doRequest(http.MethodGet, reqURL, nil)
		if err == nil {
			if err := json.Unmarshal(body, &results); err == nil && len(results) > 0 {
				p := results[0].Profile
				p.ModalidadePredominante = results[0].Propriedades.ModalidadePredominante
				p.TemProducaoParalela = results[0].Propriedades.TemProducaoParalela
				p.Talhoes = results[0].Propriedades.Talhoes
				return &p, nil
			}
		}
	}

	return nil, fmt.Errorf("profile not found for phone %s", phone)
}

// RegistrarAtividadeRPC calls the 'registrar_atividade_pmo' Postgres function in Supabase.
// This is the new declarative way to register activities, replacing several imperative steps.
func (c *Client) RegistrarAtividadeRPC(ctx context.Context, args map[string]interface{}) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/rpc/registrar_atividade_pmo", c.config.URL)

	payload, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal RPC payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create RPC request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RPC execution HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read RPC response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase RPC error (%d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse RPC response: %w", err)
	}

	return result, nil
}

// RegistrarTransacaoComRateioRPC calls the 'rpc_registrar_transacao_com_rateio' function.
// This handles complex transactions with split-billing (allocations) in a single atomic call.
func (c *Client) RegistrarTransacaoComRateioRPC(ctx context.Context, args map[string]interface{}) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/rpc/rpc_registrar_transacao_com_rateio", c.config.URL)

	payload, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal RPC payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create RPC request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RPC execution HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read RPC response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase RPC error (%d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse RPC response: %w", err)
	}

	return result, nil
}

// GetCategoriaFinanceiraByName looks up a category UUID by its name and type.
func (c *Client) GetCategoriaFinanceiraByName(nome string, tipo string) (string, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/categorias_financeiras?nome=ilike.%s&tipo=eq.%s&select=id", 
		c.config.URL, nome, tipo)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "", err
	}

	var results []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &results); err != nil {
		return "", err
	}

	if len(results) == 0 {
		return "", fmt.Errorf("categoria '%s' não encontrada", nome)
	}

	return results[0].ID, nil
}

// RegistrarCompraInsumoRPC calls the 'rpc_registrar_compra_insumo' function.
// This ensures the input exists in the catalog and registers the purchase in one atomic transaction.
func (c *Client) RegistrarCompraInsumoRPC(ctx context.Context, args map[string]interface{}) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/rpc/rpc_registrar_compra_insumo", c.config.URL)

	payload, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal RPC payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create RPC request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RPC execution HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read RPC response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase RPC error (%d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse RPC response: %w", err)
	}

	return result, nil
}

// RegistrarOperacaoCampoRPC uses the 'registrar_operacao_campo' RPC to save a activity.
func (c *Client) RegistrarOperacaoCampoRPC(ctx context.Context, args map[string]interface{}, dataArg string) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/rpc/rpc_registrar_operacao_campo", c.config.URL)
	if args == nil {
		args = make(map[string]interface{})
	}
	args["data_arg"] = dataArg
	payload, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal RPC payload: %w", err)
	}

	res, err := c.doRequest(http.MethodPost, reqURL, payload, true)
	if err != nil {
		return nil, err
	}

	// Log the raw response for debugging traceability
	log.Printf("📡 [Supabase] Raw RPC Response: %s", string(res))

	if len(res) == 0 {
		return nil, fmt.Errorf("empty response from RPC (check if Prefer: return=minimal is set)")
	}

	var result map[string]interface{}
	// PostgREST often returns an array of results even for single objects
	if res[0] == '[' {
		var results []map[string]interface{}
		if err := json.Unmarshal(res, &results); err != nil {
			return nil, fmt.Errorf("failed to parse RPC array response: %w", err)
		}
		if len(results) > 0 {
			result = results[0]
		}
	} else {
		if err := json.Unmarshal(res, &result); err != nil {
			return nil, fmt.Errorf("failed to parse RPC object response: %w", err)
		}
	}
	return result, nil
}

// CalcularBalancoNutricional chama a RPC 'calcular_balanco_nutricional' para obter a dose recomendada de adubo.
func (c *Client) CalcularBalancoNutricional(ctx context.Context, cultura string, meta float64, aduboNome string) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/rpc/calcular_balanco_nutricional", c.config.URL)

	args := map[string]interface{}{
		"p_cultura":     cultura,
		"p_meta_t_ha":   meta,
		"p_adubo_nome": aduboNome,
	}

	payload, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal RPC payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create RPC request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RPC execution HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read RPC response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase RPC error (%d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse RPC response: %w", err)
	}

	return result, nil
}


// InsertLogProcessamento saves AI processing audit data for the admin dashboard.
func (c *Client) InsertLogProcessamento(logData LogProcessamentoInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/logs_processamento", c.config.URL)
	payload, err := json.Marshal(logData)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// InsertLogTreinamento saves the extraction to the training log table for the LLM Training loop in dashboard.
func (c *Client) InsertLogTreinamento(logData LogTreinamentoInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/logs_treinamento", c.config.URL)
	payload, err := json.Marshal(logData)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// InsertFarmDocument inserts a text chunk and its embedding into farm_documents table
// If pmoID is 0, it is treated as NULL (Global document)
func (c *Client) InsertFarmDocument(pmoID int64, docName, content string, embedding []float32) error {
	reqURL := fmt.Sprintf("%s/rest/v1/farm_documents", c.config.URL)

	var pmoPtr *int64
	if pmoID > 0 {
		pmoPtr = &pmoID
	}

	doc := FarmDocument{
		PmoID:        pmoPtr,
		DocumentName: docName,
		Content:      content,
		Embedding:    embedding,
	}

	payload, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// MatchFarmDocuments calls the match_farm_documents RPC to find similar chunks for a specific farm
func (c *Client) MatchFarmDocuments(pmoID int64, embedding []float32, threshold float32, count int) ([]DocumentMatch, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/rpc/match_farm_documents", c.config.URL)

	params := map[string]interface{}{
		"query_embedding": embedding,
		"match_pmo_id":    pmoID,
		"match_threshold": threshold,
		"match_count":     count,
	}

	payload, err := json.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal match params: %w", err)
	}

	body, err := c.doRequest(http.MethodPost, reqURL, payload)
	if err != nil {
		// doRequest already returns a formatted error with status code and body if >= 400
		return nil, err
	}

	// DEBUG: Log the raw response to identify the unmarshal issue
	log.Printf("📡 [Supabase RPC] Raw Result (match_farm_documents): %s", string(body))

	var results []DocumentMatch
	if err := json.Unmarshal(body, &results); err != nil {
		// If it's not a list, maybe it's a single object (PostgREST error or wrapper?)
		var apiError struct {
			Code    string `json:"code"`
			Message string `json:"message"`
			Hint    string `json:"hint"`
			Details string `json:"details"`
		}
		if errJSON := json.Unmarshal(body, &apiError); errJSON == nil && apiError.Message != "" {
			return nil, fmt.Errorf("supabase RPC error: %s (code: %s, hint: %s, details: %s)", apiError.Message, apiError.Code, apiError.Hint, apiError.Details)
		}
		
		return nil, fmt.Errorf("failed to parse match results as []DocumentMatch: %w. Body: %s", err, string(body))
	}

	return results, nil
}

// InsertLogConsumo saves API usage metrics.
func (c *Client) InsertLogConsumo(logData LogConsumoInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/logs_consumo", c.config.URL)
	payload, err := json.Marshal(logData)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// CreateIngestionJob initializes a new job in the database.
func (c *Client) CreateIngestionJob(job IngestionJob) (string, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/ingestion_jobs", c.config.URL)
	payload, err := json.Marshal(job)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation") // Important to get the ID back

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("failed to create job (%d): %s", resp.StatusCode, string(body))
	}

	var created []IngestionJob
	if err := json.Unmarshal(body, &created); err != nil || len(created) == 0 {
		return "", fmt.Errorf("failed to parse created job: %w", err)
	}

	return created[0].ID, nil
}

// UpdateJobProgress updates the progress of an existing job.
func (c *Client) UpdateJobProgress(jobID string, processed int, total int) error {
	reqURL := fmt.Sprintf("%s/rest/v1/ingestion_jobs?id=eq.%s", c.config.URL, jobID)
	payload, err := json.Marshal(map[string]interface{}{
		"processed_chunks": processed,
		"total_chunks":     total,
		"status":           "processing",
	})
	if err != nil {
		return err
	}

	_, err = c.doRequest(http.MethodPatch, reqURL, payload)
	return err
}

// FinishJob marks the job as completed or failed.
func (c *Client) FinishJob(jobID string, status string, errorLog string) error {
	reqURL := fmt.Sprintf("%s/rest/v1/ingestion_jobs?id=eq.%s", c.config.URL, jobID)
	update := map[string]interface{}{
		"status": status,
	}
	if errorLog != "" {
		update["error_log"] = errorLog
	}
	if status == "completed" {
		// Ensure processed == total on completion
		// We could fetch the total first, but usually we know it or just rely on the last update
	}

	payload, err := json.Marshal(update)
	if err != nil {
		return err
	}

	_, err = c.doRequest(http.MethodPatch, reqURL, payload)
	return err
}

// UpsertBotStatus upserts the bot_status table with connection info (heartbeat).
// Matches the Python bot's _update_bot_status_supabase exactly.
func (c *Client) UpsertBotStatus(sessionName, status string, details map[string]interface{}) error {
	reqURL := fmt.Sprintf("%s/rest/v1/bot_status?on_conflict=session_name", c.config.URL)

	if details == nil {
		details = map[string]interface{}{}
	}

	payload, err := json.Marshal(map[string]interface{}{
		"session_name":   sessionName,
		"status":         status,
		"last_heartbeat": time.Now().UTC().Format(time.RFC3339),
		"details":        details,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal bot_status payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create bot_status request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("bot_status upsert HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bot_status upsert error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetIngestionStats returns the plan tier and document count for a pmo_id.
func (c *Client) GetIngestionStats(pmoID int64) (string, int, error) {
	// 1. Get Plan Tier via PMO owner
	// We need to fetch the user_id from pmos and then the plan_tier from profiles
	reqURL := fmt.Sprintf("%s/rest/v1/pmos?id=eq.%d&select=user_id", c.config.URL, pmoID)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "free", 0, err
	}

	var pmos []struct {
		UserID string `json:"user_id"`
	}
	if err := json.Unmarshal(body, &pmos); err != nil || len(pmos) == 0 {
		return "free", 0, nil
	}

	profileURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s&select=plan_tier", c.config.URL, pmos[0].UserID)
	profBody, err := c.doRequest(http.MethodGet, profileURL, nil)
	if err != nil {
		return "free", 0, err
	}

	var profiles []struct {
		PlanTier string `json:"plan_tier"`
	}
	json.Unmarshal(profBody, &profiles)
	tier := "free"
	if len(profiles) > 0 {
		tier = profiles[0].PlanTier
	}

	// 2. Count distinct documents in farm_documents
	countURL := fmt.Sprintf("%s/rest/v1/farm_documents?pmo_id=eq.%d&select=document_name", c.config.URL, pmoID)
	countBody, err := c.doRequest(http.MethodGet, countURL, nil)
	if err != nil {
		return tier, 0, err
	}

	var docs []struct {
		Name string `json:"document_name"`
	}
	json.Unmarshal(countBody, &docs)

	// Count unique names
	uniqueNames := make(map[string]bool)
	for _, d := range docs {
		uniqueNames[d.Name] = true
	}

	return tier, len(uniqueNames), nil
}

// extractCityFromAddress tenta extrair apenas a cidade de um endereço completo
func extractCityFromAddress(address string) string {
    if address == "" {
        return ""
    }
    
    parts := strings.Split(address, ",")
    
    // Endereço tem apenas 1-2 partes: provavelmente já é cidade
    if len(parts) <= 2 {
        return strings.TrimSpace(address)
    }
    
    // Remover "Brasil" ou "BR" do final se existir
    lastPart := strings.TrimSpace(parts[len(parts)-1])
    if strings.EqualFold(lastPart, "brasil") || 
       strings.EqualFold(lastPart, "brazil") || 
       strings.EqualFold(lastPart, "br") {
        parts = parts[:len(parts)-1]
    }
    
    if len(parts) < 2 {
        return strings.TrimSpace(address)
    }
    
    // Pegar cidade (penúltimo) e estado (último)
    city  := strings.TrimSpace(parts[len(parts)-2])
    state := strings.TrimSpace(parts[len(parts)-1])
    
    // Extrair sigla do estado se vier como "São Paulo" → "SP"
    stateClean := extractStateCode(state)
    
    return fmt.Sprintf("%s, %s", city, stateClean)
}

// extractStateCode limpa o campo de estado
func extractStateCode(state string) string {
    stateMap := map[string]string{
        "são paulo": "SP", "minas gerais": "MG", "rio de janeiro": "RJ",
        "bahia": "BA", "paraná": "PR", "rio grande do sul": "RS",
        "pernambuco": "PE", "ceará": "CE", "goiás": "GO",
        "mato grosso": "MT", "mato grosso do sul": "MS",
        "santa catarina": "SC", "pará": "PA", "maranhão": "MA",
        "amazonas": "AM", "espírito santo": "ES", "piauí": "PI",
        "alagoas": "AL", "rio grande do norte": "RN", "tocantins": "TO",
        "sergipe": "SE", "paraíba": "PB", "rondônia": "RO",
        "acre": "AC", "amapá": "AP", "roraima": "RR",
        "distrito federal": "DF",
    }
    
    lower := strings.ToLower(strings.TrimSpace(state))
    if code, ok := stateMap[lower]; ok {
        return code
    }
    
    // Já é sigla (2 letras maiúsculas)
    if len(strings.TrimSpace(state)) == 2 {
        return strings.ToUpper(strings.TrimSpace(state))
    }
    
    return state
}

// buildWeatherQuery define a melhor query para a WeatherAPI
// Prioridade: lat/lng > cidade > cidade extraída do endereço
func buildWeatherQuery(pmoID int64, lat, lon, city, address string) string {
    // Prioridade 1: coordenadas (mais preciso)
    if lat != "" && lon != "" {
        q := fmt.Sprintf("%s,%s", lat, lon)
        log.Printf("📍 [WeatherClient] PMO=%d usando coordenadas: %s", pmoID, q)
        return q
    }
    
    // Prioridade 2: campo cidade diretamente (neste caso não temos um campo estrito "cidade", mas se tivéssemos)
    // Se "city" vier de um campo específico de cidade do DB:
    if city != "" {
		// Just to be safe, maybe city is already cleaned.
		// Usually city variable is extracted from address. So we can skip to Prioridade 3.
    }
    
    // Prioridade 3: extrair cidade do endereço completo
    if address != "" {
        extractedCity := extractCityFromAddress(address)
        if extractedCity != "" {
            log.Printf("🏙️ [WeatherClient] PMO=%d cidade extraída do endereço: %s → %s", 
                pmoID, address, extractedCity)
            return extractedCity
        }
    }
    
    // Log suppressed as requested to avoid spam for test PMOs without location.
    // log.Printf("❌ [WeatherClient] PMO=%d sem localização válida...", pmoID)
    return ""
}

// FetchActivePMOsLocations retrieves all PMOs that have valid locations for weather fetching.
func (c *Client) FetchActivePMOsLocations() ([]PmoLocation, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/pmos?select=id,form_data", c.config.URL)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var pmos []struct {
		ID       int64                  `json:"id"`
		FormData map[string]interface{} `json:"form_data"`
	}
	if err := json.Unmarshal(body, &pmos); err != nil {
		return nil, err
	}

	var results []PmoLocation
	for _, p := range pmos {
		var lat, lon, address string

		// Extrair dados base do form_data
		if sec1, ok := p.FormData["secao_1_descricao_propriedade"].(map[string]interface{}); ok {
			if coords, ok := sec1["coordenadas_geograficas"].(map[string]interface{}); ok {
				if latStr, ok := coords["latitude"].(string); ok && latStr != "" {
					lat = latStr
				}
				if lonStr, ok := coords["longitude"].(string); ok && lonStr != "" {
					lon = lonStr
				}
			}
			if end, ok := sec1["dados_cadastrais"].(map[string]interface{}); ok {
				if endProp, ok := end["endereco_propriedade_base_fisica_produtiva"].(string); ok && endProp != "" {
					address = endProp
				}
			}
		}

		// Fallback: Se não tem lat/lng, tentar buscar de um talhão vinculado
		if lat == "" || lon == "" {
			talhoes, err := c.FetchTalhoes(p.ID)
			if err == nil && len(talhoes) > 0 {
				for _, t := range talhoes {
					if geom, ok := t["geometry"].(map[string]interface{}); ok {
						// Tentar extrair do GeoJSON (Polygon ou Point)
						// Simplificação: pegar o primeiro ponto se for Polygon
						if coords, ok := geom["coordinates"].([]interface{}); ok && len(coords) > 0 {
							if gType, ok := geom["type"].(string); ok {
								if gType == "Polygon" {
									// coordinates[0][0] -> [lng, lat]
									if rings, ok := coords[0].([]interface{}); ok && len(rings) > 0 {
										if pt, ok := rings[0].([]interface{}); ok && len(pt) >= 2 {
											lon = fmt.Sprintf("%v", pt[0])
											lat = fmt.Sprintf("%v", pt[1])
											log.Printf("📍 [WeatherSync] PMO=%d lat/lng obtida do talhão '%v'", p.ID, t["nome"])
											break
										}
									}
								} else if gType == "Point" {
									if len(coords) >= 2 {
										lon = fmt.Sprintf("%v", coords[0])
										lat = fmt.Sprintf("%v", coords[1])
										break
									}
								}
							}
						}
					}
				}
			}
		}

		query := buildWeatherQuery(p.ID, lat, lon, "", address)
		
		if query != "" {
			results = append(results, PmoLocation{
				ID:    p.ID,
				Query: query,
			})
		}
	}
	return results, nil
}

// SaveWeatherDataBatch inserts multiple weather records at once
func (c *Client) SaveWeatherDataBatch(data []PmoClimaInsert) error {
	if len(data) == 0 {
		return nil
	}

	reqURL := fmt.Sprintf("%s/rest/v1/pmo_clima", c.config.URL)
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	
	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create bulk pmo_clima request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	// PostgREST naturally supports bulk inserts when sending array JSON

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("pmo_clima bulk insert HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pmo_clima bulk insert error (%d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// DeleteOlderThan removes records from a table older than the specified cutoffDate (YYYY-MM-DD).
// This prevents tables like pmo_clima from growing indefinitely.
func (c *Client) DeleteOlderThan(table string, timeColumn string, cutoffDate string) error {
	reqURL := fmt.Sprintf("%s/rest/v1/%s?%s=lt.%s", c.config.URL, table, timeColumn, cutoffDate)
	req, err := http.NewRequest(http.MethodDelete, reqURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase delete error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// ---------------------------------------------------------------------------
// Structured Data Fetching Methods (Sprint 1)
// ---------------------------------------------------------------------------

// FetchTalhoes returns all talhoes for a given PMO
func (c *Client) FetchTalhoes(pmoID int64) ([]map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/talhoes?pmo_id=eq.%d&select=id,nome,area_total,descricao", c.config.URL, pmoID)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// FetchCanteiros returns all canteiros for a given Talhao
func (c *Client) FetchCanteiros(talhaoID int64) ([]map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/canteiros?talhao_id=eq.%d&select=id,nome,largura,comprimento,area", c.config.URL, talhaoID)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// FetchCadernoRecentes returns the last N records from Caderno de Campo for a PMO
func (c *Client) FetchCadernoRecentes(pmoID int64, limit int) ([]map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/caderno_campo?pmo_id=eq.%d&order=created_at.desc&limit=%d&select=id,created_at,tipo_atividade,produto,talhao_canteiro,quantidade_valor,quantidade_unidade", c.config.URL, pmoID, limit)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// FetchPropriedade returns a property by ID, including its modality.
func (c *Client) FetchPropriedade(propriedadeID int64) (map[string]interface{}, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/propriedades?id=eq.%d&select=*,modalidade_predominante", c.config.URL, propriedadeID)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(body, &results); err != nil || len(results) == 0 {
		return nil, fmt.Errorf("propriedade não encontrada")
	}
	return results[0], nil
}

// CriarTalhao inserts a new talhao into the database.
func (c *Client) CriarTalhao(nome string, areaHectares float64, cultura string, pmoID *int64, propriedadeID int64, userID string) (int64, error) {
	areaM2 := areaHectares * 10000
	geometry := map[string]interface{}{
		"type":        "Polygon",
		"coordinates": []interface{}{},
	}

	record := TalhaoInsert{
		PmoID:         pmoID,
		PropriedadeID: propriedadeID,
		UserID:        userID,
		Nome:          nome,
		AreaTotalM2:   areaM2,
		AreaHectares:  areaHectares,
		Cultura:       cultura,
		Geometry:      geometry,
	}

	payload, err := json.Marshal(record)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal talhao payload: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/talhoes", c.config.URL)
	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return 0, fmt.Errorf("failed to create talhao request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("talhao insert HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read talhao response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return 0, fmt.Errorf("supabase talhao insert error (%d): %s", resp.StatusCode, string(body))
	}

	var created []struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(body, &created); err != nil || len(created) == 0 {
		return 0, fmt.Errorf("failed to parse created talhao: %w", err)
	}

	return created[0].ID, nil
}

// CriarInfraestruturaCompleta cria um talhão e, opcionalmente, uma sequência de canteiros vinculados.
func (c *Client) CriarInfraestruturaCompleta(nome string, area float64, cultura string, pmoID *int64, propriedadeID int64, userID string, qtdCanteiros int) (string, error) {
	log.Printf("🏗️ [Supabase] Iniciando criação unificada: %s (%g ha) com %d canteiros", nome, area, qtdCanteiros)

	// 1. Criar o Talhão
	talhaoID, err := c.CriarTalhao(nome, area, cultura, pmoID, propriedadeID, userID)
	if err != nil {
		return "", fmt.Errorf("falha ao criar talhão: %w", err)
	}

	resumo := fmt.Sprintf("Talhão '%s' (ID: %d) criado com sucesso.", nome, talhaoID)

	// 2. Criar Canteiros se solicitado
	if qtdCanteiros > 0 {
		err = c.CriarCanteirosEmLote(talhaoID, qtdCanteiros, 1)
		if err != nil {
			return resumo + " ⚠️ No entanto, houve um erro ao criar os canteiros: " + err.Error(), nil
		}
		resumo += fmt.Sprintf(" Além disso, %d canteiros foram gerados e vinculados automaticamente.", qtdCanteiros)
	}

	return resumo + " A infraestrutura já está disponível no painel web para detalhamento geográfico.", nil
}

// CriarCanteirosEmLote performs a batch insert of canteiros.
func (c *Client) CriarCanteirosEmLote(talhaoID int64, quantidade int, idInicial int) error {
	var batch []CanteiroInsert
	for i := 0; i < quantidade; i++ {
		idAtual := idInicial + i
		batch = append(batch, CanteiroInsert{
			TalhaoID: talhaoID,
			Nome:     fmt.Sprintf("Canteiro %02d", idAtual),
		})
	}

	payload, err := json.Marshal(batch)
	if err != nil {
		return fmt.Errorf("failed to marshal canteiros batch: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/canteiros", c.config.URL)
	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create canteiros request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("canteiros batch insert HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase canteiros batch insert error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// InsertPMOInsumo inserts Section 8 (Insumos) data for PMO.
func (c *Client) InsertPMOInsumo(record PmoInsumoInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_insumos", c.config.URL)
	payload, err := json.Marshal(record)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	// Use merge-duplicates to ensure idempotency with the unique constraint
	req.Header.Set("Prefer", "resolution=merge-duplicates")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase API error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// ---------------------------------------------------------------------------
// HTTP Helper
// ---------------------------------------------------------------------------

func (c *Client) doRequest(method, url string, payload []byte, ignoreMinimal ...bool) ([]byte, error) {
	var bodyReader io.Reader
	if payload != nil {
		bodyReader = bytes.NewReader(payload)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
		// Prefer returning the minimal representation to save bandwidth UNLESS it's an RPC that needs data back
		if len(ignoreMinimal) == 0 || !ignoreMinimal[0] {
			req.Header.Set("Prefer", "return=minimal")
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase API error (%d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// ---------------------------------------------------------------------------
// Collective Planning (Phase 04)
// ---------------------------------------------------------------------------

// GetDemandaAtivaPorCultura finds an open demand for a specific crop.
func (c *Client) GetDemandaAtivaPorCultura(ctx context.Context, cultura string) (*DemandaColetiva, error) {
	// Filter by culture (case insensitive) and active status.
	reqURL := fmt.Sprintf("%s/rest/v1/demandas_coletivas?cultura=ilike.%s&status=in.(\"aberta\",\"em_captacao\")&limit=1", 
		c.config.URL, strings.ToUpper(cultura))

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var demands []DemandaColetiva
	if err := json.Unmarshal(body, &demands); err != nil {
		return nil, err
	}

	if len(demands) == 0 {
		return nil, fmt.Errorf("no active demand found for culture %s", cultura)
	}

	return &demands[0], nil
}

// RegistrarCotaComCronograma performs a coordinated insertion into quotas and schedules.
func (c *Client) RegistrarCotaComCronograma(ctx context.Context, payload map[string]interface{}) error {
	// Extraction from generic payload
	demandaID, _ := payload["demanda_id"].(string)
	propriedadeID, _ := payload["propriedade_id"].(int64)
	usuarioID, _ := payload["usuario_id"].(string)
	quantidade, _ := payload["quantidade"].(float64)
	dataPlantio, _ := payload["data_plantio"].(string)
	observacao, _ := payload["observacao_ia"].(string)

	// 1. Insert into cotas_produtores
	cotaRecord := CotaProdutorInsert{
		DemandaID:     demandaID,
		PropriedadeID: propriedadeID,
		UsuarioID:     usuarioID,
		Quantidade:    quantidade,
	}

	cotaJSON, _ := json.Marshal(cotaRecord)
	reqURL := fmt.Sprintf("%s/rest/v1/cotas_produtores", c.config.URL)
	
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(cotaJSON))
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to insert quota: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("quota insert error (%d): %s", resp.StatusCode, string(body))
	}

	var createdCota []struct {
		ID string `json:"id"`
	}
	json.Unmarshal(body, &createdCota)
	if len(createdCota) == 0 {
		return fmt.Errorf("failed to retrieve created quota ID")
	}

	// 2. Insert into cronograma_plantio
	cronRecord := CronogramaPlantioInsert{
		CotaID:      createdCota[0].ID,
		DataPlantio: dataPlantio,
		Observacao:  observacao,
	}

	cronJSON, _ := json.Marshal(cronRecord)
	reqURLCron := fmt.Sprintf("%s/rest/v1/cronograma_plantio", c.config.URL)
	
	reqCron, _ := http.NewRequestWithContext(ctx, http.MethodPost, reqURLCron, bytes.NewReader(cronJSON))
	reqCron.Header.Set("apikey", c.config.Key)
	reqCron.Header.Set("Authorization", "Bearer "+c.config.Key)
	reqCron.Header.Set("Content-Type", "application/json")

	respCron, err := c.httpClient.Do(reqCron)
	if err != nil {
		return fmt.Errorf("failed to insert schedule: %w", err)
	}
	defer respCron.Body.Close()

	if respCron.StatusCode >= 400 {
		bodyCron, _ := io.ReadAll(respCron.Body)
		return fmt.Errorf("schedule insert error (%d): %s", respCron.StatusCode, string(bodyCron))
	}

	return nil
}

// ObterAlertasPlantioPendentes retrieves all scheduled alerts for today or earlier.
func (c *Client) ObterAlertasPlantioPendentes(ctx context.Context) ([]map[string]interface{}, error) {
	// Simple query with embedding: 
	// - Get cronograma_plantio where alerta_enviado is false and data_alerta_whatsapp <= today
	// - Embed cotas_produtores -> profiles (for phone)
	// - Embed cotas_produtores -> demandas_coletivas (for culture)
	today := time.Now().Format("2006-01-02")
	reqURL := fmt.Sprintf("%s/rest/v1/cronograma_plantio?select=id,cota_id,data_alerta_whatsapp,cotas_produtores(quantidade_assumida,profiles(telefone),demandas_coletivas(cultura))&alerta_enviado=eq.false&data_alerta_whatsapp=lte.%s", 
		c.config.URL, today)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// MarcarAlertaComoEnviado sets the alert status to true.
func (c *Client) MarcarAlertaComoEnviado(ctx context.Context, cronogramaID string) error {
	reqURL := fmt.Sprintf("%s/rest/v1/cronograma_plantio?id=eq.%s", c.config.URL, cronogramaID)
	payload := map[string]interface{}{
		"alerta_enviado": true,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, reqURL, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to mark alert as sent (%d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// UpdateActivePMO updates the active PMO ID in the user's profile.
func (c *Client) UpdateActivePMO(userID string, pmoID int64) error {
	payload := map[string]interface{}{
		"pmo_ativo_id": pmoID,
	}
	body, _ := json.Marshal(payload)
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s", c.config.URL, userID)
	_, err := c.doRequest(http.MethodPatch, reqURL, body)
	return err
}

// UpdateActivePropriedade updates the active Property ID and optionally nulls the PMO ID.
func (c *Client) UpdateActivePropriedade(userID string, propriedadeID int64, pmoID *int64) error {
	payload := map[string]interface{}{
		"propriedade_ativa_id": propriedadeID,
		"pmo_ativo_id":         pmoID,
	}
	body, _ := json.Marshal(payload)
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s", c.config.URL, userID)
	_, err := c.doRequest(http.MethodPatch, reqURL, body)
	return err
}
