package groq

import (
	_ "embed"

	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// ---------------------------------------------------------------------------
// API Config
// ---------------------------------------------------------------------------

const (
	apiURL     = "https://api.groq.com/openai/v1/chat/completions"
	modelName  = "llama-3.3-70b-versatile"
	maxRetries = 2
	timeout    = 30 * time.Second
)

// ---------------------------------------------------------------------------
// NER Extraction Structs (mapped from records.py + parsing.py)
// ---------------------------------------------------------------------------

// Localizacao maps to LocalEstruturado in Python.
// Canteiros is a slice to support N:N bed references (golang-guerrilha Rule #5).
type Localizacao struct {
	Talhao    string   `json:"talhao"`
	Canteiros []string `json:"canteiros"`
}

// ExtractionResult is the structured JSON returned by the LLM.
// Derived from records.py (AtividadeItem, BaseRecord, PlanejamentoRecord).
type ExtractionResult struct {
	Intencao         string      `json:"intencao"`
	Atividade        string      `json:"atividade"`
	InsumoCultura    string      `json:"insumo_cultura"`
	Quantidade       float64     `json:"quantidade"`
	Unidade          string      `json:"unidade"`
	Localizacao      Localizacao `json:"localizacao"`
	DataRelativa     string      `json:"data_relativa"`
	AlertaOrganico   bool        `json:"alerta_organico"`
	TokensPrompt     int         `json:"tokens_prompt"`
	TokensCompletion int         `json:"tokens_completion"`
	HouveDescartes   bool        `json:"houve_descartes"`
	QtdDescartes     float64     `json:"qtd_descartes"`
}

// ---------------------------------------------------------------------------
// Groq API Request/Response (OpenAI-compatible)
// ---------------------------------------------------------------------------

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// responseFormat for llama-3.3-70b-versatile.
// json_schema is NOT supported by this model — only json_object is.
// Schema enforcement is done via the System Prompt instead.
type responseFormat struct {
	Type string `json:"type"`
}

type chatRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	Temperature    float64        `json:"temperature"`
	ResponseFormat responseFormat `json:"response_format"`
}

type chatChoice struct {
	Message chatMessage `json:"message"`
}

type chatResponse struct {
	Choices []chatChoice `json:"choices"`
	Usage   struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type apiError struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

// systemPrompt is loaded at compile time from the Markdown file.
// Edit internal/prompts/system_prompt.md to change LLM instructions
// without touching Go code.
//
//go:embed prompts/system_prompt.md
var systemPrompt string

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

// Client is the Groq API client for NER extraction.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Groq client.
// Returns an error if the API key is empty.
func NewClient(apiKey string) (*Client, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("GROQ_API_KEY is empty")
	}
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Extract sends the farmer's message to the Groq API and returns
// a structured ExtractionResult with intent, activity, and organic alert.
func (c *Client) Extract(farmerMessage string) (*ExtractionResult, error) {
	reqBody := chatRequest{
		Model: modelName,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: farmerMessage},
		},
		Temperature:    0,
		ResponseFormat: responseFormat{Type: "json_object"},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Retry loop for transient failures
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt) * 500 * time.Millisecond
			log.Printf("⏳ Groq retry %d/%d (backoff %v)", attempt, maxRetries, backoff)
			time.Sleep(backoff)
		}

		result, err := c.doRequest(payload)
		if err == nil {
			return result, nil
		}
		lastErr = err
		log.Printf("⚠️ Groq attempt %d failed: %v", attempt+1, err)
	}

	return nil, fmt.Errorf("groq extraction failed after %d attempts: %w", maxRetries+1, lastErr)
}

// doRequest executes a single HTTP request to the Groq API.
func (c *Client) doRequest(payload []byte) (*ExtractionResult, error) {
	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Handle API errors
	if resp.StatusCode != http.StatusOK {
		var apiErr apiError
		if jsonErr := json.Unmarshal(body, &apiErr); jsonErr == nil && apiErr.Error.Message != "" {
			return nil, fmt.Errorf("groq API error (%d): [%s] %s",
				resp.StatusCode, apiErr.Error.Code, apiErr.Error.Message)
		}
		return nil, fmt.Errorf("groq API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var chatResp chatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to parse response JSON: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("groq returned 0 choices")
	}

	content := chatResp.Choices[0].Message.Content
	log.Printf("🧠 Groq tokens: prompt=%d, completion=%d, total=%d",
		chatResp.Usage.PromptTokens,
		chatResp.Usage.CompletionTokens,
		chatResp.Usage.TotalTokens,
	)

	// Parse the LLM's JSON output into our struct
	var result ExtractionResult
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse LLM JSON output: %w\nRaw: %s", err, content)
	}

	result.TokensPrompt = chatResp.Usage.PromptTokens
	result.TokensCompletion = chatResp.Usage.CompletionTokens

	return &result, nil
}
