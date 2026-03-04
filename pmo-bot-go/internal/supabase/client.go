package supabase

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
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
	TipoAtividade      string                 `json:"tipo_atividade"`
	SecaoOrigem        string                 `json:"secao_origem,omitempty"`
	Produto            string                 `json:"produto,omitempty"`
	TalhaoCanteiro     string                 `json:"talhao_canteiro,omitempty"`
	QuantidadeValor    float64                `json:"quantidade_valor,omitempty"`
	QuantidadeUnidade  string                 `json:"quantidade_unidade,omitempty"`
	ObservacaoOriginal string                 `json:"observacao_original,omitempty"`
	DetalhesTecnicos   map[string]interface{} `json:"detalhes_tecnicos,omitempty"`
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

// ---------------------------------------------------------------------------
// Main Methods
// ---------------------------------------------------------------------------

// ResolvePhone checks lid_mappings for a WPPConnect LID, otherwise assumes it's already a phone.
func (c *Client) ResolvePhone(from string) (string, error) {
	// If it's standard WhatsApp format, return just the numbers
	if strings.Contains(from, "@c.us") {
		return strings.Split(from, "@")[0], nil
	}

	// If it's a LID, check the database
	if strings.Contains(from, "@lid") {
		lidStr := strings.Split(from, "@")[0]

		reqURL := fmt.Sprintf("%s/rest/v1/lid_mappings?lid_id=eq.%s&select=phone_number", c.config.URL, lidStr)
		body, err := c.doRequest(http.MethodGet, reqURL, nil)
		if err != nil {
			return "", err
		}

		var mappings []LidMapping
		if err := json.Unmarshal(body, &mappings); err != nil {
			return "", err
		}

		if len(mappings) > 0 {
			return mappings[0].PhoneNumber, nil
		}

		// Fallback
		return lidStr, nil
	}

	// Fallback general
	return strings.Split(from, "@")[0], nil
}

// GetFarmIdByPhone fetches the user's active PMO ID using their phone number
func (c *Client) GetFarmIdByPhone(phone string) (int64, error) {
	// Primeira tentativa: Buscar pelo número exato fornecido
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?telefone=eq.%s&select=pmo_ativo_id,id", c.config.URL, phone)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return 0, err
	}

	var profiles []Profile
	if err := json.Unmarshal(body, &profiles); err != nil {
		return 0, err
	}

	if len(profiles) > 0 {
		return profiles[0].PmoAtivoID, nil
	}

	// Segunda tentativa: Formato BR sem o 9º dígito (WPPConnect às vezes usa o formato de 8 dígitos)
	// Ex: 5534997317545 (13 chars) -> 553497317545 (12 chars)
	if len(phone) == 13 && strings.HasPrefix(phone, "55") {
		fallbackPhone := phone[:4] + phone[5:] // Remove o 5º caractere (que é o '9' do DDD)
		reqURL = fmt.Sprintf("%s/rest/v1/profiles?telefone=eq.%s&select=pmo_ativo_id,id", c.config.URL, fallbackPhone)

		body, err = c.doRequest(http.MethodGet, reqURL, nil)
		if err == nil {
			var fallbackProfiles []Profile
			if err := json.Unmarshal(body, &fallbackProfiles); err == nil && len(fallbackProfiles) > 0 {
				return fallbackProfiles[0].PmoAtivoID, nil
			}
		}
	}

	// Terceira tentativa: Tentar LIKE pegando os ultimos 8 digitos
	if len(phone) >= 8 {
		last8 := phone[len(phone)-8:]
		reqURL = fmt.Sprintf("%s/rest/v1/profiles?telefone=ilike.*%s*&select=pmo_ativo_id,id", c.config.URL, last8)
		body, err = c.doRequest(http.MethodGet, reqURL, nil)
		if err == nil {
			var fallbackProfiles []Profile
			if err := json.Unmarshal(body, &fallbackProfiles); err == nil && len(fallbackProfiles) > 0 {
				return fallbackProfiles[0].PmoAtivoID, nil
			}
		}
	}

	return 0, fmt.Errorf("profile not found for phone %s", phone)
}

// InsertCadernoCampo inserts the LLM parsed record and returns the UUID of the created row.
// Uses Prefer: return=representation to get the full object back from Supabase.
func (c *Client) InsertCadernoCampo(record CadernoCampoInsert) (string, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/caderno_campo", c.config.URL)

	payload, err := json.Marshal(record)
	if err != nil {
		return "", fmt.Errorf("failed to marshal caderno payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create caderno request: %w", err)
	}

	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("caderno insert HTTP failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read caderno response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("supabase caderno insert error (%d): %s", resp.StatusCode, string(body))
	}

	// Supabase returns [{"id": "uuid", ...}] with return=representation
	var rows []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return "", fmt.Errorf("failed to parse caderno response: %w", err)
	}
	if len(rows) == 0 {
		return "", fmt.Errorf("caderno insert returned 0 rows")
	}

	return rows[0].ID, nil
}

// ---------------------------------------------------------------------------
// Canteiro Relational Methods (N:N support — golang-guerrilha Rule #5)
// ---------------------------------------------------------------------------

// LookupCanteiroIDs resolves canteiro names to their DB IDs.
// Strategy: find talhao_id by pmoID+name, then lookup each canteiro by talhao_id+name.
// Best-effort: missing canteiros are logged and skipped.
func (c *Client) LookupCanteiroIDs(pmoID int64, talhaoNome string, canteiros []string) ([]int64, error) {
	if talhaoNome == "" || talhaoNome == "NÃO INFORMADO" || len(canteiros) == 0 {
		return nil, nil
	}

	// Step 1: Resolve talhao_id
	talhaoURL := fmt.Sprintf("%s/rest/v1/talhoes?pmo_id=eq.%d&nome=ilike.*%s*&select=id",
		c.config.URL, pmoID, talhaoNome)

	talhaoBody, err := c.doRequest(http.MethodGet, talhaoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup talhao: %w", err)
	}

	var talhoes []struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(talhaoBody, &talhoes); err != nil {
		return nil, fmt.Errorf("failed to parse talhao response: %w", err)
	}
	if len(talhoes) == 0 {
		log.Printf("⚠️ [Supabase] Talhão '%s' não encontrado para PMO %d", talhaoNome, pmoID)
		return nil, nil
	}

	talhaoID := talhoes[0].ID
	log.Printf("📍 [Supabase] Talhão '%s' resolvido para ID %d", talhaoNome, talhaoID)

	// Step 2: Resolve each canteiro name to its ID
	var canteiroIDs []int64

	for _, nome := range canteiros {
		canteiroURL := fmt.Sprintf("%s/rest/v1/canteiros?talhao_id=eq.%d&nome=ilike.*%s*&select=id,nome",
			c.config.URL, talhaoID, nome)

		canteiroBody, err := c.doRequest(http.MethodGet, canteiroURL, nil)
		if err != nil {
			log.Printf("⚠️ [Supabase] Erro ao buscar canteiro '%s': %v", nome, err)
			continue
		}

		var candidatos []struct {
			ID   int64  `json:"id"`
			Nome string `json:"nome"`
		}
		if err := json.Unmarshal(canteiroBody, &candidatos); err != nil {
			log.Printf("⚠️ [Supabase] Erro ao parsear canteiro '%s': %v", nome, err)
			continue
		}

		if len(candidatos) == 0 {
			log.Printf("⚠️ [Supabase] Canteiro '%s' não encontrado no talhão %d", nome, talhaoID)
			continue
		}

		// Fine filter: extract numbers from DB name and compare as int (like Python does)
		nomeAlvo, err := strconv.Atoi(strings.TrimSpace(nome))
		if err != nil {
			// Nome is not purely numeric — use first match directly
			canteiroIDs = append(canteiroIDs, candidatos[0].ID)
			log.Printf("✅ [Supabase] Canteiro '%s' → ID %d (match direto)", nome, candidatos[0].ID)
			continue
		}

		// Numeric comparison (handles "Canteiro 01" == "1", "Canteiro 10" != "1")
		matched := false
		for _, cand := range candidatos {
			for _, digitStr := range extractNumbers(cand.Nome) {
				if digitStr == nomeAlvo {
					canteiroIDs = append(canteiroIDs, cand.ID)
					log.Printf("✅ [Supabase] Canteiro '%s' → ID %d (match numérico)", nome, cand.ID)
					matched = true
					break
				}
			}
			if matched {
				break
			}
		}

		if !matched {
			log.Printf("⚠️ [Supabase] Canteiro '%s' sem match exato entre candidatos: %v", nome, candidatos)
		}
	}

	return canteiroIDs, nil
}

// InsertCanteiroVinculos batch-inserts rows into the caderno_campo_canteiros junction table.
// Best-effort: logs errors per-row but does not abort.
func (c *Client) InsertCanteiroVinculos(cadernoID string, canteiroIDs []int64) error {
	if cadernoID == "" || len(canteiroIDs) == 0 {
		return nil
	}

	type vinculo struct {
		CadernoCampoID string `json:"caderno_campo_id"`
		CanteiroID     int64  `json:"canteiro_id"`
	}

	var batch []vinculo
	for _, id := range canteiroIDs {
		batch = append(batch, vinculo{
			CadernoCampoID: cadernoID,
			CanteiroID:     id,
		})
	}

	payload, err := json.Marshal(batch)
	if err != nil {
		return fmt.Errorf("failed to marshal canteiro vinculos: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/caderno_campo_canteiros", c.config.URL)
	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	if err != nil {
		log.Printf("⚠️ [Supabase] Falha ao inserir vínculos de canteiros: %v", err)
		return err
	}

	log.Printf("🔗 [Supabase] %d canteiro(s) vinculado(s) ao registro %s", len(canteiroIDs), cadernoID)
	return nil
}

// InsertLogProcessamento saves AI processing audit data for the admin dashboard.
func (c *Client) InsertLogProcessamento(logData LogProcessamentoInsert) error {
	reqURL := fmt.Sprintf("%s/rest/v1/logs_processamento", c.config.URL)

	payload, err := json.Marshal(logData)
	if err != nil {
		return fmt.Errorf("failed to marshal log payload: %w", err)
	}

	_, err = c.doRequest(http.MethodPost, reqURL, payload)
	if err != nil {
		return fmt.Errorf("log insert failed: %w", err)
	}

	return nil
}

// extractNumbers extracts all integer values from a string.
// Ex: "Canteiro 01" → [1], "C-10 a 12" → [10, 12]
func extractNumbers(s string) []int {
	var nums []int
	current := ""
	for _, ch := range s {
		if ch >= '0' && ch <= '9' {
			current += string(ch)
		} else {
			if current != "" {
				if n, err := strconv.Atoi(current); err == nil {
					nums = append(nums, n)
				}
				current = ""
			}
		}
	}
	if current != "" {
		if n, err := strconv.Atoi(current); err == nil {
			nums = append(nums, n)
		}
	}
	return nums
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
