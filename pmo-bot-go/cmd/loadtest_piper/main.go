// loadtest_piper.go — DT-38: CPU Starvation Load Test (Direto no Piper)
//
// Objetivo: provar que 5 produtores gerando TTS simultaneamente engargalam
// o serviço Piper numa VPS com 2 vCPUs.
//
// Arquitetura:
//   1. Dispara 5 goroutines simultâneas via sync.WaitGroup
//   2. Cada goroutine envia um POST para http://piper:5000/v1/audio/speech
//   3. O payload pede a síntese de um texto comum de resposta do bot
//   4. Imprime latência individual e sumário agregado
//
// Como executar:
//   Sendo uma URL interna do Docker, precisamos compilar e rodar dentro da rede:
//   $env:GOOS="linux"; $env:GOARCH="amd64"; go build -o loadtest_piper_linux loadtest_piper.go
//   docker run --rm -v ${PWD}:/app --network pmo-prod-stack_pmo_prod_net alpine /app/loadtest_piper_linux

package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	piperURL   string
	workers    int
	timeoutSec int
	textToSay  string
)

func init() {
	flag.StringVar(&piperURL, "url", "http://piper:5000/v1/audio/speech", "URL do Piper TTS (interno ao Docker)")
	flag.IntVar(&workers, "workers", 5, "Número de goroutines simultâneas")
	flag.IntVar(&timeoutSec, "timeout", 150, "Timeout HTTP em segundos")
	flag.StringVar(&textToSay, "text", "Olá! Entendi a sua mensagem de áudio, vou processar os seus dados agora. Isso pode levar alguns segundos.", "Texto para sintetizar")
}

type result struct {
	WorkerID   int
	StatusCode int
	Latency    time.Duration
	Err        error
}

func main() {
	flag.Parse()

	// ── Preparação do Payload ───────────────────────────────────────────
	// Formato compatível com OpenAI (e suportado pelo piper-openai-tts)
	payloadStr := fmt.Sprintf(`{"model":"pt_BR-faber-medium","input":"%s","voice":"pt_BR-faber-medium","response_format":"mp3"}`, textToSay)
	payloadBytes := []byte(payloadStr)

	client := &http.Client{
		Timeout: time.Duration(timeoutSec) * time.Second,
	}

	// ── Banner ──────────────────────────────────────────────────────────
	fmt.Println("════════════════════════════════════════════════════════════════")
	fmt.Println("  DT-38 — Teste de Carga Direto: Piper TTS (CPU Starvation)")
	fmt.Println("════════════════════════════════════════════════════════════════")
	fmt.Printf("  url         : %s\n", piperURL)
	fmt.Printf("  workers     : %d (simultâneos)\n", workers)
	fmt.Printf("  timeout     : %ds\n", timeoutSec)
	fmt.Printf("  texto       : %s\n", textToSay)
	fmt.Println("────────────────────────────────────────────────────────────────")
	fmt.Println()

	// ── Disparo Concorrente ─────────────────────────────────────────────
	results := make([]result, workers)
	var wg sync.WaitGroup

	startAll := time.Now()

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			fmt.Printf("🚀 [Worker %d] Solicitando síntese de áudio...\n", id)

			start := time.Now()
			req, _ := http.NewRequest("POST", piperURL, bytes.NewBuffer(payloadBytes))
			req.Header.Set("Content-Type", "application/json")
			
			resp, err := client.Do(req)
			if err == nil {
				_, _ = io.ReadAll(resp.Body)
				resp.Body.Close()
			}
			elapsed := time.Since(start)

			r := result{
				WorkerID: id,
				Latency:  elapsed,
			}

			if err != nil {
				r.Err = err
			} else {
				r.StatusCode = resp.StatusCode
			}

			results[id] = r

			if r.Err != nil {
				fmt.Printf("❌ [Worker %d] ERRO: %v (%.2fs)\n", id, r.Err, elapsed.Seconds())
			} else {
				fmt.Printf("✅ [Worker %d] HTTP %d — %.2fs (Áudio Gerado!)\n", id, r.StatusCode, elapsed.Seconds())
			}
		}(i)
	}

	wg.Wait()
	totalElapsed := time.Since(startAll)

	// ── Sumário ─────────────────────────────────────────────────────────
	fmt.Println()
	fmt.Println("════════════════════════════════════════════════════════════════")
	fmt.Println("  SUMÁRIO")
	fmt.Println("════════════════════════════════════════════════════════════════")
	fmt.Printf("  Tempo total (wall clock): %.2fs\n", totalElapsed.Seconds())
	fmt.Println()

	var latencies []float64
	successCount := 0
	errorCount := 0

	fmt.Printf("  %-10s %-10s %-12s %s\n", "Worker", "Status", "Latência", "Escalonamento")
	fmt.Println("  " + strings.Repeat("─", 60))

	sorted := make([]result, len(results))
	copy(sorted, results)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Latency < sorted[j].Latency
	})

	for _, r := range sorted {
		latencies = append(latencies, r.Latency.Seconds())
		status := fmt.Sprintf("%d", r.StatusCode)
		if r.Err != nil {
			status = "ERR"
			errorCount++
		} else {
			successCount++
		}

		barLen := int(r.Latency.Seconds() / totalElapsed.Seconds() * 30)
		if barLen < 1 {
			barLen = 1
		}
		bar := strings.Repeat("█", barLen)

		fmt.Printf("  %-10d %-10s %-12s %s\n",
			r.WorkerID, status, fmt.Sprintf("%.2fs", r.Latency.Seconds()), bar)
	}

	fmt.Println()

	if len(latencies) > 0 {
		min := latencies[0]
		max := latencies[len(latencies)-1]
		sum := 0.0
		for _, l := range latencies {
			sum += l
		}
		avg := sum / float64(len(latencies))

		fmt.Printf("  Min:  %.2fs\n", min)
		fmt.Printf("  Max:  %.2fs\n", max)
		fmt.Printf("  Avg:  %.2fs\n", avg)
		fmt.Printf("  Spread (max-min): %.2fs\n", max-min)
		fmt.Println()
		fmt.Printf("  Sucesso: %d/%d\n", successCount, workers)
		fmt.Printf("  Erros:   %d/%d\n", errorCount, workers)
	}
	
	fmt.Println()
	if len(latencies) > 1 {
		spread := latencies[len(latencies)-1] - latencies[0]
		if spread > 5.0 {
			fmt.Println("  ⚠️  DIAGNÓSTICO: CPU Starvation Confirmado!")
			fmt.Println("     Spread alto detectado. O ONNX Runtime não consegue paralelizar")
			fmt.Println("     as 5 requisições de forma eficiente no limite de 1 CPU. Ele processa")
			fmt.Println("     as mensagens serialmente ou há tanta troca de contexto que o wall")
			fmt.Println("     clock sobe drasticamente.")
		} else {
			fmt.Println("  ✅ DIAGNÓSTICO: Baixa contenção observada. (Você reduziu os CPUs no Docker?)")
		}
	}
	fmt.Println("════════════════════════════════════════════════════════════════")
}
