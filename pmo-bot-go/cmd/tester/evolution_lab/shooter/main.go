package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

const (
	instanceName = "teste-instancia"
	apiKey       = "coliseu-api-key-2026"
	webhookURL   = "http://host.docker.internal:3333/webhook"
)

func main() {
	target := flag.String("target", "go", "Target API Type: 'node' (8081) or 'go' (8080)")
	baseURL := flag.String("url", "http://localhost:8082", "Base URL of the API")
	key := flag.String("key", "coliseu-api-key-2026", "Global API Key")
	instance := flag.String("instance", "teste-instancia", "Instance Name")
	phone := flag.String("phone", "", "Destination phone number (with country code)")
	msgType := flag.String("type", "text", "Message type: 'text', 'audio', 'image'")
	flag.Parse()

	if *phone == "" {
		log.Fatal("\n\n❌ SEGURANÇA: O parâmetro --phone é obrigatório.\n" +
			"Uso: go run cmd/tester/evolution_lab/shooter.go -target [go|node] -url [URL] -key [KEY] -instance [INSTANCE] -phone [NUMERO]\n")
	}

	fmt.Printf("--- COLISIEUSA SHOOTER ---\nTarget: %s (%s)\nInstance: %s\nPhone: %s\nType: %s\n------------------------\n", *target, *baseURL, *instance, *phone, *msgType)

	// Injetar valores dinâmicos nas funções de suporte (usando ponteiros ou variáveis globais, mas passaremos como argumentos aqui)
	checkInstance(*target, *baseURL, *key, *instance)

	// Send Message
	switch *msgType {
	case "text":
		sendText(*baseURL, *key, *instance, *phone)
	case "audio":
		sendAudio(*baseURL, *key, *instance, *phone)
	case "image":
		sendImage(*baseURL, *key, *instance, *phone)
	default:
		log.Fatalf("Unknown message type: %s", *msgType)
	}
}

func checkInstance(target, baseURL, apiKey, instanceName string) {
	// For Node, we check by name in URL
	url := fmt.Sprintf("%s/instance/connectionState/%s", baseURL, instanceName)
	if target == "go" {
		// For Go, we use /instance/status which uses apikey header
		url = fmt.Sprintf("%s/instance/status", baseURL)
	}

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("apikey", apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Warning: Could not check instance state: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusUnauthorized {
		fmt.Printf("[!] Instance not found or unauthorized (%d). Creating '%s'...\n", resp.StatusCode, instanceName)
		createInstance(target, baseURL)
	} else {
		fmt.Println("[✓] Instance found and active.")
	}
}

func createInstance(target, baseURL string) {
	url := fmt.Sprintf("%s/instance/create", baseURL)

	payload := map[string]interface{}{
		"token":  apiKey,
		"qrcode": true,
	}

	if target == "node" {
		payload["instanceName"] = instanceName
		payload["integration"] = "WHATSAPP-BAILEYS"
	} else {
		payload["name"] = instanceName
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Error creating instance: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusOK || bytes.Contains(bodyBytes, []byte("already exists")) {
		if bytes.Contains(bodyBytes, []byte("already exists")) {
			fmt.Println("[!] Instance already exists. Proceeding...")
		} else {
			fmt.Println("[✓] Instance created successfully.")
		}

		if target == "go" {
			connectInstanceGo(baseURL)
		} else {
			setWebhookNode(baseURL)
		}
	} else {
		log.Fatalf("Failed to create instance: %d - %s", resp.StatusCode, string(bodyBytes))
	}
}

func connectInstanceGo(baseURL string) {
	// For Go, /instance/connect uses apikey from header
	url := fmt.Sprintf("%s/instance/connect", baseURL)
	payload := map[string]interface{}{
		"webhookUrl": webhookURL,
		"subscribe":  []string{"MESSAGE", "SEND_MESSAGE", "CONNECTION"},
		"immediate":  true,
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Warning: Failed to connect instance: %v", err)
		return
	}
	defer resp.Body.Close()
	fmt.Println("[✓] Go Instance connection initiated via /instance/connect")
}

func setWebhookNode(baseURL string) {
	url := fmt.Sprintf("%s/webhook/set/%s", baseURL, instanceName)
	payload := map[string]interface{}{
		"enabled": true,
		"url":     webhookURL,
		"events":  []string{"MESSAGE", "SEND_MESSAGE", "CONNECTION"},
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Warning: Failed to set webhook: %v", err)
		return
	}
	defer resp.Body.Close()
	fmt.Println("[✓] Node Webhook configured to:", webhookURL)
}

func sendText(baseURL, apiKey, instanceName, phone string) {
	url := fmt.Sprintf("%s/message/sendText/%s", baseURL, instanceName)
	if baseURL == "http://localhost:8082" || !bytes.Contains([]byte(url), []byte("8081")) {
		// Heuristic: if port is 8082 or target is go
		if !bytes.Contains([]byte(url), []byte("8081")) {
			url = fmt.Sprintf("%s/send/text", baseURL)
		}
	}

	payload := map[string]interface{}{
		"number": phone,
		"text":   "Teste de Texto ManejoORG (O Grande Coliseu)",
	}
	executeRequest(url, apiKey, payload)
}

func sendAudio(baseURL, apiKey, instanceName, phone string) {
	audioPath := "pmo-bot-go/test_concat.mp3"
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		audioPath = "test_concat.mp3"
		if _, err := os.Stat(audioPath); os.IsNotExist(err) {
			log.Printf("Warning: audio file 'test_concat.mp3' not found. Skipping audio test.")
			return
		}
	}

	content, err := os.ReadFile(audioPath)
	if err != nil {
		log.Fatalf("Error reading audio file: %v", err)
	}

	encoded := base64.StdEncoding.EncodeToString(content)
	dataURI := fmt.Sprintf("data:audio/mp3;base64,%s", encoded)

	url := fmt.Sprintf("%s/message/sendWhatsAppAudio/%s", baseURL, instanceName)
	isGo := !bytes.Contains([]byte(url), []byte("8081"))
	if isGo {
		url = fmt.Sprintf("%s/send/media", baseURL)
	}

	payload := map[string]interface{}{
		"number":   phone,
		"audio":    dataURI,
		"delay":    1000,
		"encoding": true,
	}

	if isGo {
		payload = map[string]interface{}{
			"number":    phone,
			"media":     dataURI,
			"mediatype": "audio",
			"delay":     1000,
		}
	}

	executeRequest(url, apiKey, payload)
}

func sendImage(baseURL, apiKey, instanceName, phone string) {
	url := fmt.Sprintf("%s/message/sendMedia/%s", baseURL, instanceName)
	if !bytes.Contains([]byte(url), []byte("8081")) {
		url = fmt.Sprintf("%s/send/media", baseURL)
	}

	payload := map[string]interface{}{
		"number":    phone,
		"media":     "https://raw.githubusercontent.com/EvolutionAPI/evolution-api/main/docs/static/img/logo.png",
		"mediatype": "image",
		"caption":   "ManejoORG - Benchmark Media Test",
	}
	executeRequest(url, apiKey, payload)
}

func executeRequest(url, apiKey string, payload map[string]interface{}) {
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Error sending request: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	fmt.Printf("Response Status: %d\nResponse Body: %s\n", resp.StatusCode, string(respBody))
}
