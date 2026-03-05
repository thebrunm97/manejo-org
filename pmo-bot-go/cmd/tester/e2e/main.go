// cmd/tester/e2e/main.go
// E2E stress tester for the PMO-Bot-Go webhook.
// Sends 20+ farmer messages and prints pass/fail based on the
// intencao and alerta_organico returned by the LLM.
//
// Usage:
//
//	go run cmd/tester/e2e/main.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// ---------------------------------------------------------------------------
// Webhook types (mirror the handler structs just enough to send/receive)
// ---------------------------------------------------------------------------

type webhookPayload struct {
	Event  string `json:"event"`
	From   string `json:"from"`
	FromMe bool   `json:"fromMe"`
	ID     string `json:"id"`
	Type   string `json:"type"`
	Body   string `json:"body"`
	ChatID string `json:"chatId"`
}

type webhookResponse struct {
	Status    string          `json:"status"`
	From      string          `json:"from"`
	Extracted json.RawMessage `json:"extracted"`
	Error     string          `json:"error"`
}

type extractionResult struct {
	Intencao       string  `json:"intencao"`
	Atividade      string  `json:"atividade"`
	InsumoCultura  string  `json:"insumo_cultura"`
	Quantidade     float64 `json:"quantidade"`
	Unidade        string  `json:"unidade"`
	DataRelativa   string  `json:"data_relativa"`
	AlertaOrganico bool    `json:"alerta_organico"`
}

// ---------------------------------------------------------------------------
// Test Table (Table-Driven)
// ---------------------------------------------------------------------------

type testCase struct {
	Descricao              string
	Frase                  string
	IntencaoEsperada       string
	AlertaOrganicoEsperado bool
}

var testCases = []testCase{
	// --- 🚨 PROIBIDOS (alerta_organico: true) ---
	{
		Descricao:              "Herbicida sintético — glifosato",
		Frase:                  "Passei glifosato no mato entre os canteiros hoje",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: true,
	},
	{
		Descricao:              "Fertilizante sintético NPK",
		Frase:                  "Joguei NPK 10-10-10 no talhão 2",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: true,
	},
	{
		Descricao:              "Herbicida 2,4-D",
		Frase:                  "Apliquei 2,4-D nas pragas do canteiro 5",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: true,
	},
	{
		Descricao:              "Semente transgênica OGM",
		Frase:                  "Comprei semente transgênica de milho para plantar semana que vem",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: true,
	},
	{
		Descricao:              "Ureia — fertilizante sintético",
		Frase:                  "Apliquei ureia no talhao 3 hoje",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: true,
	},
	{
		Descricao:              "Sulfato de amônio",
		Frase:                  "Coloquei sulfato de amônio para adubação de cobertura",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: true,
	},
	{
		Descricao:              "Inseticida organofosforado",
		Frase:                  "Passei metamidofós nas plantas que estavam com pulgão",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: true,
	},

	// --- ✅ PERMITIDOS (alerta_organico: false) ---
	{
		Descricao:              "Bokashi — adubo orgânico fermentado",
		Frase:                  "Coloquei bokashi no canteiro de alface hoje cedo",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Calda sulfocálcica — fungicida orgânico",
		Frase:                  "Pulverizei calda sulfocálcica no talhão 1 para oídio",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Óleo de neem — inseticida orgânico",
		Frase:                  "Usei óleo de neem para tratar mosca branca no tomate",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Esterco de galinha — adubo orgânico",
		Frase:                  "Adubei com esterco de galinha curtido no canteiro 3",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Calda bordalesa — fungicida cúprico",
		Frase:                  "Apliquei calda bordalesa nas espigas de milho",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Bt — controle biológico",
		Frase:                  "Joguei Bacillus thuringiensis para controlar a lagarta",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},

	// --- 🌱 AÇÕES ESPECÍFICAS ---
	{
		Descricao:              "Plantio com localização precisa",
		Frase:                  "Plantei 500 mudas de alface no talhão 1 canteiro 3",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Colheita com quantidade",
		Frase:                  "Colhi 20 caixas de tomate do talhão 5 hoje",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Capina — manejo cultural",
		Frase:                  "Capinei o canteiro 2 e o canteiro 4 de manhã",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Irrigação",
		Frase:                  "Irrigou o talhão 3 com 200 litros de água hoje à tarde",
		IntencaoEsperada:       "registro",
		AlertaOrganicoEsperado: false,
	},

	// --- 🗣️ INTENÇÕES ALTERNATIVAS ---
	{
		Descricao:              "Saudação simples",
		Frase:                  "Bom dia!",
		IntencaoEsperada:       "saudacao",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Dúvida técnica — controle de formiga",
		Frase:                  "Como mato formiga sem usar veneno?",
		IntencaoEsperada:       "duvida",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Mensagem irrelevante — ignorar",
		Frase:                  "Vou almoçar agora, até logo",
		IntencaoEsperada:       "ignorar",
		AlertaOrganicoEsperado: false,
	},
	{
		Descricao:              "Dúvida sobre certificação",
		Frase:                  "Posso usar farinha de osso na produção orgânica?",
		IntencaoEsperada:       "duvida",
		AlertaOrganicoEsperado: false,
	},
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const (
	webhookURL   = "http://localhost:8080/webhook?token=TY6oMv4d20a3"
	delayBetween = 2 * time.Second // respect Groq rate limits
)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

func main() {
	total := len(testCases)
	passed := 0
	failed := 0
	errs := 0

	fmt.Printf("🌿 PMO-Bot-Go — Stress Test Suite (%d casos)\n", total)
	fmt.Println("══════════════════════════════════════════════════════════")

	for i, tc := range testCases {
		fmt.Printf("\n[%02d/%02d] %s\n", i+1, total, tc.Descricao)
		fmt.Printf("        📨 \"%s\"\n", tc.Frase)

		result, err := sendAndParse(tc.Frase)
		if err != nil {
			fmt.Printf("        ❌ ERRO HTTP: %v\n", err)
			errs++
			time.Sleep(delayBetween)
			continue
		}

		// Evaluate intencao
		intencaoOK := result.Intencao == tc.IntencaoEsperada
		alertaOK := result.AlertaOrganico == tc.AlertaOrganicoEsperado

		intencaoIcon := "✅"
		if !intencaoOK {
			intencaoIcon = "❌"
		}
		alertaIcon := "✅"
		if !alertaOK {
			alertaIcon = "❌"
		}

		fmt.Printf("        %s intencao: got=%q want=%q\n", intencaoIcon, result.Intencao, tc.IntencaoEsperada)
		fmt.Printf("        %s alerta_organico: got=%v want=%v | insumo=%q\n",
			alertaIcon, result.AlertaOrganico, tc.AlertaOrganicoEsperado, result.InsumoCultura)

		if result.AlertaOrganico {
			fmt.Printf("        🚨 ALERTA ORGÂNICO ATIVADO → %s\n", result.InsumoCultura)
		}

		if intencaoOK && alertaOK {
			passed++
		} else {
			failed++
		}

		// Respect Groq rate limits
		if i < total-1 {
			time.Sleep(delayBetween)
		}
	}

	// Summary
	fmt.Println("\n══════════════════════════════════════════════════════════")
	fmt.Printf("📊 RESULTADO FINAL: %d/%d passaram | %d falharam | %d erros HTTP\n",
		passed, total, failed, errs)
	if failed == 0 && errs == 0 {
		fmt.Println("🏆 System Prompt à prova de balas!")
	} else {
		fmt.Println("⚠️  Há casos a melhorar no System Prompt.")
	}
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

func sendAndParse(body string) (*extractionResult, error) {
	payload := webhookPayload{
		Event:  "onmessage",
		From:   "5531999999999@c.us",
		FromMe: false,
		ID:     fmt.Sprintf("tester-%d", time.Now().UnixNano()),
		Type:   "chat",
		Body:   body,
		ChatID: "5531999999999@c.us",
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("http post: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	var wResp webhookResponse
	if err := json.Unmarshal(respBytes, &wResp); err != nil {
		return nil, fmt.Errorf("unmarshal webhook response: %w\nraw: %s", err, string(respBytes))
	}

	if wResp.Status != "processed" {
		return nil, fmt.Errorf("webhook status=%q (error=%q)", wResp.Status, wResp.Error)
	}

	var result extractionResult
	if err := json.Unmarshal(wResp.Extracted, &result); err != nil {
		return nil, fmt.Errorf("unmarshal extracted: %w\nraw: %s", err, string(wResp.Extracted))
	}

	log.Printf("      ↪ atividade=%q quantidade=%.1f unidade=%q local=%v",
		result.Atividade, result.Quantidade, result.Unidade, result.DataRelativa)

	return &result, nil
}
