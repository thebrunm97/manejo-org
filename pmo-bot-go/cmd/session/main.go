package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	SessionName  string
	SecretKey    string
	WebhookToken string
	WppURL       string
	WebhookURL   string
}

func loadConfig() Config {
	err := godotenv.Load(".env")
	if err != nil {
		log.Println("⚠️ Aviso: não foi possível carregar o arquivo .env, usando variáveis de ambiente do sistema.")
	}

	sessionName := os.Getenv("WPP_SESSION")
	if sessionName == "" {
		sessionName = "agro_vivo"
	}
	secretKey := os.Getenv("WPPCONNECT_TOKEN") // in .env WPPCONNECT_TOKEN stores the secret key string
	wppURL := os.Getenv("WPPCONNECT_URL")
	if wppURL == "" {
		wppURL = "http://localhost:21465"
	}

	// Assuming webhook runs on host port 8080. If inside docker to docker, might be different, but for WPPConnect it's usually defined.
	// We'll set a default webhook URL for locahost, you can adjust it if WPPConnect needs a different routable address.
	webhookURL := fmt.Sprintf("http://host.docker.internal:8080/webhook?token=%s", secretKey)

	return Config{
		SessionName:  sessionName,
		SecretKey:    secretKey,
		WebhookToken: secretKey,
		WppURL:       wppURL,
		WebhookURL:   webhookURL,
	}
}

func generateToken(cfg Config) (string, error) {
	url := fmt.Sprintf("%s/api/%s/%s/generate-token", cfg.WppURL, cfg.SessionName, cfg.SecretKey)
	log.Printf("Gerando token JWT da secret_key no WPPConnect: %s...", url)

	resp, err := http.Post(url, "application/json", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.Token, nil
}

func startSession(cfg Config, token string) error {
	url := fmt.Sprintf("%s/api/%s/start-session", cfg.WppURL, cfg.SessionName)
	log.Printf("Iniciando sessão no servidor do WPPConnect: %s...", url)

	payload := map[string]string{
		"webhook": cfg.WebhookURL,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	log.Printf("Start Session Answer [%d]: %s", resp.StatusCode, string(respBody))
	return nil
}

func pollQRCode(cfg Config, token string) {
	url := fmt.Sprintf("%s/api/%s/status-session", cfg.WppURL, cfg.SessionName)
	log.Println("Aguardando QRCode. Por favor, seja paciente...")

	client := &http.Client{Timeout: 5 * time.Second}

	for i := 0; i < 45; i++ {
		req, _ := http.NewRequest(http.MethodGet, url, nil)
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Erro no polling: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var result struct {
			Status string `json:"status"`
			QrCode string `json:"qrcode"`
		}
		json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		log.Printf("[%ds] Status: %s | QrCode gerado: %v", i*2, result.Status, result.QrCode != "")

		if result.QrCode != "" && strings.HasPrefix(result.QrCode, "data:image") {
			log.Println("✅ QR CODE GERADO! Salvando no arquivo 'qrcode.html'...")

			html := fmt.Sprintf(`
			<html>
			<head><title>Conectar WhatsApp</title></head>
			<body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#222;color:white;flex-direction:column;font-family:sans-serif;">
				<h1>Leia este Código no WhatsApp</h1>
				<p>Configurações > Aparelhos Conectados > Conectar um aparelho</p>
				<img src="%s" style="background:white;padding:20px;border-radius:10px;width:300px;height:300px;"/>
				<p>Status da Sessão: %s</p>
			</body>
			</html>
			`, result.QrCode, result.Status)

			pwd, _ := os.Getwd()
			filePath := filepath.Join(pwd, "qrcode.html")
			os.WriteFile(filePath, []byte(html), 0644)
			log.Printf("✅ Abra o arquivo %s no seu navegador e escaneie o código!", filePath)
			return
		}

		if result.Status == "CONNECTED" {
			log.Println("✅ A SUA SESSÃO JÁ ESTÁ CONECTADA COM O WHATSAPP! Não é necessário QRCode.")
			return
		}

		time.Sleep(2 * time.Second)
	}

	log.Println("❌ Fim do tempo limite de espera do QRCode.")
}

func main() {
	cfg := loadConfig()

	// 1. Generate token
	token, err := generateToken(cfg)
	if err != nil || token == "" {
		log.Fatalf("❌ Falha ao gerar o token de sessão JWT: %v", err)
	}
	log.Println("✅ Token gerado com sucesso!")

	// 2. Start session
	err = startSession(cfg, token)
	if err != nil {
		log.Printf("❌ Falha de rede ao iniciar sessão: %v", err)
	}

	// Wait randomly just in case WPPConnect takes some time building internal headless session
	time.Sleep(2 * time.Second)

	// 3. Status Poll + QRCode Extraction
	pollQRCode(cfg, token)
}
