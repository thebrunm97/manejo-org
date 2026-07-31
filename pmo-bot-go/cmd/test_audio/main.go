package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	// Configurações do .env.prod
	baseURL := "http://localhost:8082" // Evolution Go exposto na porta 8082
	instanceName := "manejo-org"
	apiKey := "SsU8y6SMSvsMkZdvWqFNqxQKs5c8F3gKWCl3xuht7uNRSI1qPkomSwoQsS0VyuN1"

	// Número do destinatário (formato WhatsApp)
	to := "553497317545@s.whatsapp.net"

	// Gerar um áudio de teste simples (silêncio de 1 segundo em MP3)
	// Usando um MP3 mínimo válido (ID3 header + frame mpeg)
	testMP3 := []byte{
		0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // ID3v2 header
		0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // MPEG frame header (silence)
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	}

	base64Audio := base64.StdEncoding.EncodeToString(testMP3)

	url := fmt.Sprintf("%s/send/media", baseURL)
	payload := map[string]interface{}{
		"number":       to,
		"media":        base64Audio,
		"mediatype":    "audio",
		"ptt":          true,
		"instanceName": instanceName,
	}

	jsonPayload, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, bytes.NewReader(jsonPayload))
	if err != nil {
		log.Fatalf("Erro ao criar request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Erro ao enviar request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	fmt.Printf("Status: %d\n", resp.StatusCode)
	fmt.Printf("Response: %s\n", string(body))

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Println("✅ Áudio de teste enviado com sucesso!")
	} else {
		fmt.Println("❌ Falha ao enviar áudio")
		os.Exit(1)
	}
}
