package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
)

func chunkText(text string, limit int) []string {
	var chunks []string
	runes := []rune(text)
	for len(runes) > 0 {
		if len(runes) <= limit {
			chunks = append(chunks, string(runes))
			break
		}
		cutPoint := limit
		for i := limit; i > 0; i-- {
			if runes[i] == ' ' || runes[i] == '.' || runes[i] == ',' || runes[i] == ';' {
				cutPoint = i + 1
				break
			}
		}
		chunks = append(chunks, string(runes[:cutPoint]))
		runes = runes[cutPoint:]
	}
	return chunks
}

func main() {
	text := "✅ Registro Salvo com Sucesso! Atividade: Colheita. Item: Alface Americana. Qtd: 120 unidades. Local: Talhão Central; Canteiro 1. O manejo orgânico é sensacional e a colheita foi super produtiva hoje. Continuaremos amanhã com mais força de trabalho. Obrigado por manter os dados atualizados no caderno de campo."

	chunks := chunkText(text, 150)
	var audioBuffer bytes.Buffer

	for i, chunk := range chunks {
		reqURL := fmt.Sprintf("https://translate.google.com/translate_tts?ie=UTF-8&q=%s&tl=pt-br&client=tw-ob", url.QueryEscape(chunk))
		req, _ := http.NewRequestWithContext(context.Background(), "GET", reqURL, nil)
		resp, _ := http.DefaultClient.Do(req)

		fmt.Printf("Chunk %d returned: %d\n", i, resp.StatusCode)
		io.Copy(&audioBuffer, resp.Body)
		resp.Body.Close()
	}

	err := os.WriteFile("test_concat.mp3", audioBuffer.Bytes(), 0644)
	if err != nil {
		fmt.Println("Error writing file:", err)
	} else {
		fmt.Println("File written to test_concat.mp3")
	}
}
