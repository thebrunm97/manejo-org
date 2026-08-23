// load_test.go — DT-38: CPU Starvation Load Test (Piper TTS)
//
// Objetivo: provar que 5 produtores enviando áudio simultaneamente engargalam
// o serviço Piper numa VPS com 2 vCPUs.
//
// RISCO REAL, JÁ MATERIALIZADO (incidente de 2026-08-23, ver DT-52)
//
// Este script não gera só "carga" — ele fabrica envelopes de mensagem do
// WhatsApp com ID inexistente e os injeta no webhook real. Do outro lado, o
// evolution-go tenta baixar mídia para uma mensagem que a sessão REAL do
// WhatsApp nunca recebeu de verdade. Isso não é carga sintética inofensiva:
// dessincronizou o protocolo Signal da sessão (erro "old counter") e a Meta
// derrubou a conexão com StreamReplaced. A instância ficou 24 minutos fora do
// ar, sem nenhum aviso, até um restart manual do container.
//
// Como antes da VPS (DT-38) a stack de produção roda NESTA MESMA MÁQUINA,
// "localhost:8080" na prática significa "o WhatsApp real de produção" — não
// existe hoje um alvo seguro por padrão. Por isso -url não tem valor default
// (abaixo), e por isso o script pede uma CONFIRMAÇÃO DIGITADA antes de
// disparar, não apenas uma flag. Uma flag pode ser colada do histórico do
// terminal sem que ninguém releia o que está prestes a acontecer; digitar
// "CONFIRMO" exige reler a mensagem.
//
// Se o objetivo é só medir a capacidade de CPU do Piper (que foi o objetivo
// original do DT-38), prefira cmd/loadtest_piper: ele fala direto com o
// Piper, nunca passa pelo WhatsApp, e não tem este risco.
//
// Arquitetura:
//   1. Sobe um mini HTTP file server (porta 8081) servindo ./test_assets/
//      para que o evolution-go (dentro do Docker) baixe o áudio via
//      http://host.docker.internal:8081/audio_teste.ogg
//   2. Lê o template payload_audio_stress.json
//   3. Dispara N goroutines simultâneas via sync.WaitGroup
//   4. Cada goroutine envia um POST para /webhook/evolution com ID único
//      (para passar pelo dedup) e timestamp fresco (para passar pelo TTL)
//   5. Imprime latência individual e sumário agregado
//
// Pré-requisitos:
//   - ./test_assets/audio_teste.ogg  (arquivo OGG real)
//   - -url apontando para um webhook cujo evolution-go NÃO seja a sessão de
//     WhatsApp de produção. Se essa garantia não existir (caso comum antes da
//     VPS), responda a confirmação com consciência do que está em jogo.
//   - Porta 8080 (ou a porta do alvo) acessível
//   - Porta 8081 livre (mini file server)
//
// Uso:
//   go run . -url http://localhost:8080/webhook/evolution
//   go run . -url http://localhost:8080/webhook/evolution -workers=10 -token=OutroToken
//   go run . -url ... -yes   # pula a confirmação (uso em CI/script, com cautela)

package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

var (
	webhookURL     string
	token          string
	workers        int
	timeoutSec     int
	fileServerPort int
	payloadFile    string
	assetsDir      string
	skipConfirm    bool
)

func init() {
	// SEM DEFAULT DE PROPÓSITO. Um default apontando para localhost:8080 foi
	// exatamente o que permitiu disparar isto contra produção sem perceber —
	// ver o aviso no topo do arquivo. Quem roda precisa escrever o alvo.
	flag.StringVar(&webhookURL, "url", "", "URL do webhook (OBRIGATÓRIO — sem valor padrão, de propósito)")
	flag.StringVar(&token, "token", "ManejoOrgToken", "WEBHOOK_TOKEN para autenticação")
	flag.IntVar(&workers, "workers", 5, "Número de goroutines simultâneas")
	flag.IntVar(&timeoutSec, "timeout", 150, "Timeout HTTP em segundos")
	flag.IntVar(&fileServerPort, "port", 8081, "Porta do file server local para servir o áudio")
	flag.StringVar(&payloadFile, "payload", "payload_audio_stress.json", "Caminho para o template JSON")
	flag.StringVar(&assetsDir, "assets", "./test_assets", "Diretório com os arquivos de áudio de teste")
	flag.BoolVar(&skipConfirm, "yes", false, "Pula a confirmação interativa (uso em CI/script — CUIDADO)")
}

// alvoPareceSeguro reconhece padrões de host que claramente NÃO são a
// instância de WhatsApp de produção — staging, CI, portas fora do padrão.
// É uma lista de permissão pequena de propósito: o padrão é pedir
// confirmação, e só pula quando o alvo é inconfundivelmente seguro.
func alvoPareceSeguro(url string) bool {
	sinaisSeguros := []string{"staging", "test", "ci-", "-ci", "example.com"}
	lower := strings.ToLower(url)
	for _, s := range sinaisSeguros {
		if strings.Contains(lower, s) {
			return true
		}
	}
	return false
}

// confirmarAlvo exige que o operador digite "CONFIRMO" antes de disparar
// contra um alvo que não foi reconhecido como seguro. Diferente de uma flag
// obrigatória — que pode ser copiada do README ou do histórico do shell sem
// ninguém reler — digitar a palavra exige reler o aviso acima dela.
//
// Foi exatamente a ausência disto que permitiu o incidente de 2026-08-23
// (DT-52): a URL de produção era o único alvo funcional na máquina, então
// "-url http://localhost:8080/..." era o comando óbvio e correto de digitar
// — só que ninguém tinha motivo para parar e pensar no que aconteceria do
// outro lado daquele POST.
func confirmarAlvo(url string) {
	if skipConfirm || alvoPareceSeguro(url) {
		return
	}

	fmt.Printf("\n🚨 ATENÇÃO: %s NÃO foi reconhecido como alvo seguro (staging/CI).\n", url)
	fmt.Println("   Se este for o webhook de produção, os workers vão fabricar mensagens de")
	fmt.Println("   áudio inexistentes. Em 2026-08-23 isso dessincronizou o protocolo Signal")
	fmt.Println("   da sessão real do WhatsApp e derrubou a conexão por 24 minutos.")
	fmt.Println("   Prefere só medir CPU do Piper, sem esse risco? Use cmd/loadtest_piper.")
	fmt.Print("\n   Digite CONFIRMO para prosseguir mesmo assim: ")

	var resposta string
	fmt.Scanln(&resposta)
	if strings.TrimSpace(resposta) != "CONFIRMO" {
		fmt.Println("❌ Abortado — resposta diferente de CONFIRMO.")
		os.Exit(1)
	}
	fmt.Println()
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

type result struct {
	WorkerID   int
	StatusCode int
	Latency    time.Duration
	BodySnip   string
	Err        error
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

func main() {
	flag.Parse()

	// ── Validações ──────────────────────────────────────────────────────
	if webhookURL == "" {
		fmt.Fprintln(os.Stderr, "❌ -url é obrigatório. Não há valor padrão de propósito (ver cabeçalho do arquivo).")
		fmt.Fprintln(os.Stderr, "   Exemplo: go run . -url http://localhost:8080/webhook/evolution")
		os.Exit(1)
	}
	confirmarAlvo(webhookURL)

	if _, err := os.Stat(assetsDir); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "❌ Diretório %q não encontrado. Crie-o e coloque audio_teste.ogg dentro.\n", assetsDir)
		os.Exit(1)
	}

	audioPath := assetsDir + "/audio_teste.ogg"
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "❌ Arquivo %q não encontrado.\n", audioPath)
		fmt.Fprintln(os.Stderr, "   Coloque um arquivo .ogg real nesse caminho e tente novamente.")
		os.Exit(1)
	}

	templateBytes, err := os.ReadFile(payloadFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Falha ao ler payload template %q: %v\n", payloadFile, err)
		os.Exit(1)
	}

	// ── Mini HTTP File Server ───────────────────────────────────────────
	// O evolution-go (dentro do Docker) precisa baixar o áudio do host.
	// Servimos ./test_assets/ numa porta local; o container acessa via
	// http://host.docker.internal:<port>/audio_teste.ogg
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", fileServerPort))
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Porta %d ocupada: %v\n", fileServerPort, err)
		os.Exit(1)
	}

	fileServer := &http.Server{
		Handler: http.FileServer(http.Dir(assetsDir)),
	}
	go func() {
		fmt.Printf("📂 File server rodando em http://0.0.0.0:%d (servindo %s)\n", fileServerPort, assetsDir)
		if err := fileServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "⚠️  File server erro: %v\n", err)
		}
	}()

	// Pequena espera para garantir que o server está up
	time.Sleep(200 * time.Millisecond)

	// Verificação: testar se o file server responde
	probeURL := fmt.Sprintf("http://localhost:%d/audio_teste.ogg", fileServerPort)
	probeResp, probeErr := http.Head(probeURL)
	if probeErr != nil {
		fmt.Fprintf(os.Stderr, "❌ File server não respondeu em %s: %v\n", probeURL, probeErr)
		os.Exit(1)
	}
	probeResp.Body.Close()
	if probeResp.StatusCode != 200 {
		fmt.Fprintf(os.Stderr, "❌ File server respondeu %d para %s\n", probeResp.StatusCode, probeURL)
		os.Exit(1)
	}
	fmt.Printf("✅ File server confirmado: %s → %d\n\n", probeURL, probeResp.StatusCode)

	// ── Preparação dos Payloads ─────────────────────────────────────────
	fullURL := fmt.Sprintf("%s?token=%s", webhookURL, token)

	client := &http.Client{
		Timeout: time.Duration(timeoutSec) * time.Second,
	}

	// ── Banner ──────────────────────────────────────────────────────────
	fmt.Println("════════════════════════════════════════════════════════════════")
	fmt.Println("  DT-38 — Teste de Carga: CPU Starvation (Piper TTS)")
	fmt.Println("════════════════════════════════════════════════════════════════")
	fmt.Printf("  webhook     : %s\n", fullURL)
	fmt.Printf("  workers     : %d (simultâneos)\n", workers)
	fmt.Printf("  timeout     : %ds\n", timeoutSec)
	fmt.Printf("  file server : http://host.docker.internal:%d/audio_teste.ogg\n", fileServerPort)
	fmt.Printf("  payload     : %s\n", payloadFile)
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

			// Gera ID único para cada goroutine (bypass dedup)
			uniqueID := fmt.Sprintf("STRESS_%d_%d", time.Now().UnixNano(), id)
			timestamp := time.Now().UTC().Format(time.RFC3339)

			// Substitui os placeholders no template
			payload := string(templateBytes)
			payload = strings.ReplaceAll(payload, "__UNIQUE_ID__", uniqueID)
			payload = strings.ReplaceAll(payload, "__TIMESTAMP__", timestamp)

			fmt.Printf("🚀 [Worker %d] Disparando... (ID: %s)\n", id, uniqueID)

			start := time.Now()
			resp, err := client.Post(fullURL, "application/json", bytes.NewBufferString(payload))
			elapsed := time.Since(start)

			r := result{
				WorkerID: id,
				Latency:  elapsed,
			}

			if err != nil {
				r.Err = err
				r.BodySnip = fmt.Sprintf("ERRO: %v", err)
			} else {
				r.StatusCode = resp.StatusCode
				body, _ := io.ReadAll(resp.Body)
				resp.Body.Close()

				snip := string(body)
				if len(snip) > 120 {
					snip = snip[:120] + "..."
				}
				r.BodySnip = snip
			}

			results[id] = r

			if r.Err != nil {
				fmt.Printf("❌ [Worker %d] %s (%.2fs)\n", id, r.BodySnip, elapsed.Seconds())
			} else {
				fmt.Printf("✅ [Worker %d] HTTP %d — %.2fs — %s\n", id, r.StatusCode, elapsed.Seconds(), r.BodySnip)
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

	// Calcular estatísticas
	var latencies []float64
	successCount := 0
	errorCount := 0

	fmt.Printf("  %-10s %-10s %-12s %s\n", "Worker", "Status", "Latência", "Resposta")
	fmt.Println("  " + strings.Repeat("─", 70))

	// Ordenar por latência para visualizar o escalonamento
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

		// Barra visual proporcional à latência
		barLen := int(r.Latency.Seconds() / totalElapsed.Seconds() * 30)
		if barLen < 1 {
			barLen = 1
		}
		bar := strings.Repeat("█", barLen)

		bodySnip := r.BodySnip
		if len(bodySnip) > 50 {
			bodySnip = bodySnip[:50] + "..."
		}

		fmt.Printf("  %-10d %-10s %-12s %s %s\n",
			r.WorkerID, status, fmt.Sprintf("%.2fs", r.Latency.Seconds()), bar, bodySnip)
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

	// ── Diagnóstico ─────────────────────────────────────────────────────
	if len(latencies) > 1 {
		spread := latencies[len(latencies)-1] - latencies[0]
		if spread > 5.0 {
			fmt.Println("  ⚠️  DIAGNÓSTICO: Spread > 5s detectado!")
			fmt.Println("     Isso confirma serialização no Piper: as requisições estão")
			fmt.Println("     sendo processadas sequencialmente, cada uma esperando a anterior.")
			fmt.Println("     Na VPS com 2 vCPUs, o impacto será ainda maior.")
		} else if latencies[len(latencies)-1] > 10.0 {
			fmt.Println("  ⚠️  DIAGNÓSTICO: Latência máxima > 10s!")
			fmt.Println("     Mesmo sem spread significativo, a latência absoluta indica")
			fmt.Println("     pressão de CPU no pipeline.")
		} else {
			fmt.Println("  ✅ DIAGNÓSTICO: Sem evidência de CPU starvation nesta amostra.")
			fmt.Println("     O Piper pode não ter sido acionado (download falhou antes).")
			fmt.Println("     Verifique os logs: docker compose -f docker-compose.prod.yml logs piper --tail=50")
		}
	}

	fmt.Println()
	fmt.Println("  💡 DICA: Rode em outro terminal para monitorar em tempo real:")
	fmt.Println("     docker stats --format \"table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\"")
	fmt.Println()
	fmt.Println("  💡 DICA: Para ver os logs do Piper durante o teste:")
	fmt.Println("     docker compose -f docker-compose.prod.yml logs -f piper")
	fmt.Println()
	fmt.Println("════════════════════════════════════════════════════════════════")

	// Limpa o file server
	fileServer.Close()
}
