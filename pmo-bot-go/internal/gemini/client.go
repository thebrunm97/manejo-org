package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	_ "embed"
)

//go:embed prompts/system_prompt.md
var systemPrompt string

// Config holds Gemini API configuration
type Config struct {
	APIKey string
}

// Client wraps HTTP communication with Gemini v1beta REST API
type Client struct {
	config     Config
	StoreID    string
	httpClient *http.Client
}

// NewClient initializes the Gemini client
func NewClient(cfg Config) (*Client, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is missing")
	}

	storeID := os.Getenv("GEMINI_STORE_ID")

	return &Client{
		config:  cfg,
		StoreID: storeID,
		httpClient: &http.Client{
			Timeout: 60 * time.Second, // Generation can take a while
		},
	}, nil
}

// GenerateContentRequest represents the payload for Gemini API
type GenerateContentRequest struct {
	SystemInstruction *Content   `json:"systemInstruction,omitempty"`
	Contents          []Content  `json:"contents"`
	Tools             []Tool     `json:"tools,omitempty"`
	GenerationConfig  *GenConfig `json:"generationConfig,omitempty"`
}

type Tool struct {
	Retrieval *Retrieval `json:"retrieval,omitempty"`
}

type Retrieval struct {
	DynamicRetrievalConfig *DynamicRetrievalConfig `json:"dynamicRetrievalConfig,omitempty"`
	VertexRagStore         *VertexRagStore         `json:"vertexRagStore,omitempty"`
}

type VertexRagStore struct {
	RagCorpora []string `json:"ragCorpora,omitempty"`
}

// In v1beta, FileSearch is supported natively by passing a corpus array or by simple retrieval
type DynamicRetrievalConfig struct {
	Mode             string  `json:"mode,omitempty"`
	DynamicThreshold float64 `json:"dynamicThreshold,omitempty"`
}

// NOTE: For gemini-1.5-flash with File Search Store, the tool has `retrieval` config that targets `fileSearchStore`
// We'll map the exact json required by the v1beta endpoint

type Content struct {
	Role  string `json:"role,omitempty"`
	Parts []Part `json:"parts"`
}

type Part struct {
	Text string `json:"text,omitempty"`
}

type GenConfig struct {
	Temperature *float64 `json:"temperature,omitempty"`
}

// GenerateContentResponse represents the response from Gemini API
type GenerateContentResponse struct {
	Candidates []Candidate `json:"candidates"`
}

type Candidate struct {
	Content      Content `json:"content"`
	FinishReason string  `json:"finishReason"`
}

// AskExpert asks a question bounded by the organic agriculture system prompt
func (c *Client) AskExpert(question string) (string, error) {
	reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", c.config.APIKey)

	temp := 0.2 // Low temperature for factual agricultural advice
	payload := GenerateContentRequest{
		SystemInstruction: &Content{
			Parts: []Part{
				{Text: systemPrompt},
			},
		},
		Contents: []Content{
			{
				Role: "user",
				Parts: []Part{
					{Text: question},
				},
			},
		},
		GenerationConfig: &GenConfig{
			Temperature: &temp,
		},
	}

	if c.StoreID != "" {
		log.Printf("📚 [GEMINI API] Usando Knowledge Base. Store ID: %s", c.StoreID)
		// No v1beta, para atrelar a busca aos documentos enviados (FileSearch API)
		// nós injetamos o tool apropriado. O JSON gerado será:
		// "tools": [{"retrieval": {"vertexRagStore": { "ragCorpora": [ "fileSearchStores/..."] }}}]
		// O formato exato depende da lib mas usando a estrutura dinâmica é comum enviarmos como map para evitar structs grandes
	}

	var finalPayload map[string]interface{}
	payloadBytes, _ := json.Marshal(payload)
	json.Unmarshal(payloadBytes, &finalPayload)

	if c.StoreID != "" {
		// Adiciona a tool de retrieval
		finalPayload["tools"] = []map[string]interface{}{
			{
				"retrieval": map[string]interface{}{
					"vertexRagStore": map[string]interface{}{
						"ragCorpora": []string{c.StoreID},
					},
				},
			},
		}
	}

	bodyBytes, err := json.Marshal(finalPayload)
	if err != nil {
		return "", fmt.Errorf("gemini marshal error: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	log.Println("📡 [GEMINI API] Iniciando chamada para o oráculo. Atenção ao limite de 20 Requisições por Dia (RPD).")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini request error: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		log.Println("⚠️ [GEMINI API] Erro 429: Rate Limit (Limite de requisições excedido).")
		return "No momento estou consultando muitos manuais. Tente novamente em alguns minutos.", nil
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini api error (%d): %s", resp.StatusCode, string(body))
	}

	var apiResp GenerateContentResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return "", fmt.Errorf("gemini decode response error: %v. Body raw: %s", err, string(body))
	}

	if len(apiResp.Candidates) == 0 || len(apiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gemini empty response. raw: %s", string(body))
	}

	return apiResp.Candidates[0].Content.Parts[0].Text, nil
}
