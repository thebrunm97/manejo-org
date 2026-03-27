package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// Config represents the Supabase credentials
type Config struct {
	URL string
	Key string // Service Role Key
}

// Client wraps HTTP communication with Supabase REST API
type Client struct {
	config     Config
	httpClient *http.Client
}

// NewClient initializes the Supabase client
func NewClient(cfg Config) (*Client, error) {
	if cfg.URL == "" || cfg.Key == "" {
		return nil, fmt.Errorf("SUPABASE_URL or SUPABASE_KEY is missing")
	}
	return &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}, nil
}

// ---------------------------------------------------------------------------
// Structs mapped directly from the DB Schema
// ---------------------------------------------------------------------------

type Profile struct {
	ID         string `json:"id"`
	Nome       string `json:"nome,omitempty"`
	Telefone   string `json:"telefone,omitempty"`
	PmoAtivoID int64  `json:"pmo_ativo_id,omitempty"`
}

type LidMapping struct {
	ID          string `json:"id"`
	LidID       string `json:"lid_id"`
	PhoneNumber string `json:"phone_number"`
}

type CadernoCampoInsert struct {
	PmoID              int64                  `json:"pmo_id,omitempty"`
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
	PmoID            int64  `json:"pmo_id"`
	MensagemUsuario  string `json:"mensagem_usuario"`
	RespostaBot      string `json:"resposta_bot"`
	ModeloIA         string `json:"modelo_ia"`
	TokensPrompt     int    `json:"tokens_prompt"`
	TokensCompletion int    `json:"tokens_completion"`
	Intencao         string `json:"intencao"`
}

type LogTreinamentoInsert struct {
	PmoID         int64                  `json:"pmo_id"`
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
	PmoID       int64                  `json:"pmo_id"`
	UserID      string                 `json:"user_id"`
	Nome        string                 `json:"nome"`
	AreaTotalM2 float64                `json:"area_total_m2"`
	Cultura     string                 `json:"cultura,omitempty"`
	Geometry    map[string]interface{} `json:"geometry"`
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
	PmoID           int64  `json:"pmo_id"`
	ProdutoManejo   string `json:"produto_manejo"`
	CulturaDestino  string `json:"cultura_destino,omitempty"`
	EpocaFrequencia string `json:"epoca_frequencia,omitempty"`
	Procedencia     string `json:"procedencia,omitempty"`
	Composicao      string `json:"composicao,omitempty"`
	Marca           string `json:"marca,omitempty"`
	Dosagem         string `json:"dosagem,omitempty"`
}

type PmoPropagacaoInsert struct {
	PmoID           int64  `json:"pmo_id"`
	Tipo            string `json:"tipo"` // semente, muda, etc
	Especies        string `json:"especies"`
	Origem          string `json:"origem,omitempty"`
	Quantidade      string `json:"quantidade,omitempty"`
	SistemaOrganico bool   `json:"sistema_organico"`
	DataCompra      string `json:"data_compra,omitempty"` // "YYYY-MM-DD"
}

type PmoLimpezaInsert struct {
	PmoID            int64  `json:"pmo_id"`
	DataLimpeza      string `json:"data_limpeza"`
	ItemArea         string `json:"item_area"`
	TipoLimpeza      string `json:"tipo_limpeza"`
	ProdutoUtilizado string `json:"produto_utilizado,omitempty"`
	Dosagem          string `json:"dosagem,omitempty"`
	Responsavel      string `json:"responsavel"`
	Observacao       string `json:"observacao,omitempty"`
}

type PmoCompostagemInsert struct {
	PmoID        int64  `json:"pmo_id"`
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

// ---------------------------------------------------------------------------
// Main Methods
// ---------------------------------------------------------------------------

// ResolvePhone checks lid_mappings for a WPPConnect LID, otherwise assumes it's already a phone.
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

	// Primeira tentativa: Buscar pelo número exato fornecido
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?telefone=eq.%s&select=*", c.config.URL, phone)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	var profiles []Profile
	if err := json.Unmarshal(body, &profiles); err != nil {
		return nil, err
	}

	if len(profiles) > 0 {
		return &profiles[0], nil
	}

	// Segunda tentativa: Formato BR sem o 9º dígito
	if len(phone) == 13 && strings.HasPrefix(phone, "55") {
		fallbackPhone := phone[:4] + phone[5:]
		reqURL = fmt.Sprintf("%s/rest/v1/profiles?telefone=eq.%s&select=*", c.config.URL, fallbackPhone)

		body, err = c.doRequest(http.MethodGet, reqURL, nil)
		if err == nil {
			var fallbackProfiles []Profile
			if err := json.Unmarshal(body, &fallbackProfiles); err == nil && len(fallbackProfiles) > 0 {
				return &fallbackProfiles[0], nil
			}
		}
	}

	// Terceira tentativa: Tentar LIKE pegando os ultimos 8 digitos
	if len(phone) >= 8 {
		last8 := phone[len(phone)-8:]
		reqURL = fmt.Sprintf("%s/rest/v1/profiles?telefone=ilike.*%s*&select=*", c.config.URL, last8)
		body, err = c.doRequest(http.MethodGet, reqURL, nil)
		if err == nil {
			var fallbackProfiles []Profile
			if err := json.Unmarshal(body, &fallbackProfiles); err == nil && len(fallbackProfiles) > 0 {
				return &fallbackProfiles[0], nil
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
		return nil, err
	}

	body, err := c.doRequest(http.MethodPost, reqURL, payload)
	if err != nil {
		return nil, err
	}

	var results []DocumentMatch
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, fmt.Errorf("failed to parse match results: %w", err)
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

// CriarTalhao inserts a new talhão and returns its generated ID.
func (c *Client) CriarTalhao(nome string, areaHectares float64, cultura string, pmoID int64, userID string) (int64, error) {
	areaM2 := areaHectares * 10000
	geometry := map[string]interface{}{
		"type":        "Polygon",
		"coordinates": []interface{}{},
	}

	record := TalhaoInsert{
		PmoID:       pmoID,
		UserID:      userID,
		Nome:        nome,
		AreaTotalM2: areaM2,
		Cultura:     cultura,
		Geometry:    geometry,
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
func (c *Client) CriarInfraestruturaCompleta(nomeTalhao string, areaHectares float64, cultura string, pmoID int64, userID string, qtdCanteiros int) (string, error) {
	log.Printf("🏗️ [Supabase] Iniciando criação unificada: %s (%g ha) com %d canteiros", nomeTalhao, areaHectares, qtdCanteiros)

	// 1. Criar o Talhão
	talhaoID, err := c.CriarTalhao(nomeTalhao, areaHectares, cultura, pmoID, userID)
	if err != nil {
		return "", fmt.Errorf("falha ao criar talhão na infraestrutura unificada: %w", err)
	}

	resumo := fmt.Sprintf("Talhão '%s' (ID: %d) criado com sucesso.", nomeTalhao, talhaoID)

	// 2. Criar Canteiros se solicitado
	if qtdCanteiros > 0 {
		err = c.CriarCanteirosEmLote(talhaoID, qtdCanteiros, 1) // Sempre iniciando do 1 para nova infraestrutura
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

// InsertPMOPropagacao inserts Section 9 (Propagação Vegetal) data for PMO.
func (c *Client) InsertPMOPropagacao(record PmoPropagacaoInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_propagacao", c.config.URL)
	payload, err := json.Marshal(record)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// InsertPMOLimpeza inserts Form 04 (Controle de Limpeza) data for PMO.
func (c *Client) InsertPMOLimpeza(record PmoLimpezaInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_limpeza", c.config.URL)
	payload, err := json.Marshal(record)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// InsertPMOCompostagem inserts Form 05 (Compostagem) Lote data for PMO.
func (c *Client) InsertPMOCompostagem(record PmoCompostagemInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_compostagem", c.config.URL)
	payload, err := json.Marshal(record)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// InsertPMOCompostagemEvento inserts an event into the Form 05 (Compostagem) Lote.
func (c *Client) InsertPMOCompostagemEvento(record PmoCompostagemEventoInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/pmo_compostagem_eventos", c.config.URL)
	payload, err := json.Marshal(record)
	if err != nil {
		return err
	}
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	return err
}

// LookupCompostagemID resolves the n_pilha string to its DB UUID.
func (c *Client) LookupCompostagemID(pmoID int64, userID string, nPilha string) (string, error) {
	escapedNPilha := url.QueryEscape(nPilha)

	userFilter := ""
	if userID != "" {
		userFilter = fmt.Sprintf("&user_id=eq.%s", userID)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/pmo_compostagem?pmo_id=eq.%d%s&n_pilha=ilike.*%s*&select=id", c.config.URL, pmoID, userFilter, escapedNPilha)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "", fmt.Errorf("falha ao buscar compostagem: %w", err)
	}

	var pilhas []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &pilhas); err != nil {
		return "", fmt.Errorf("falha ao interpretar resposta da compostagem: %w", err)
	}
	if len(pilhas) == 0 {
		return "", fmt.Errorf("pilha '%s' não encontrada", nPilha)
	}

	return pilhas[0].ID, nil
}

// ---------------------------------------------------------------------------
// HTTP Helper
// ---------------------------------------------------------------------------

func (c *Client) doRequest(method, url string, payload []byte) ([]byte, error) {
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
		// Prefer returning the minimal representation to save bandwidth
		req.Header.Set("Prefer", "return=minimal")
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
