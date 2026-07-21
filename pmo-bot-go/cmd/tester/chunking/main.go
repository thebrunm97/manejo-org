package main

import (
	"fmt"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/chunking"
)

func main() {
	fmt.Println("Testando o SmartSplit do Chunker...")

	// Criação de um texto com parágrafos curtos, frases e uma frase intencionalmente gigante (>3000 chars)
	paragraph1 := "Este é o primeiro parágrafo curto."
	paragraph2 := "Aqui temos o segundo parágrafo.\n\n"
	paragraph3 := "Este é o terceiro parágrafo longo. Ele tem frases! Algumas são separadas por ponto. Ou interrogação?"
	
	// Frase gigante sem pontuação para forçar o HardCut
	giantSentence := "Esta frase é gigante " + strings.Repeat("a", 3100) + " e termina aqui."

	testText := paragraph1 + "\n\n" + paragraph2 + paragraph3 + "\n\n" + giantSentence

	chunks := chunking.SmartSplit(testText, "doc_teste_1")

	for _, chunk := range chunks {
		fmt.Printf("\n--- CHUNK [%d] ---\n", chunk.ChunkIndex)
		fmt.Printf("SourceDocID: %s\n", chunk.SourceDocumentID)
		fmt.Printf("Hash: %s\n", chunk.ChunkHash)
		fmt.Printf("Tamanho (chars): %d\n", len(chunk.Content))
		
		previewLen := 100
		if len(chunk.Content) < previewLen {
			previewLen = len(chunk.Content)
		}
		fmt.Printf("Preview: %s...\n", chunk.Content[:previewLen])
	}

	fmt.Printf("\nTotal de chunks gerados: %d\n", len(chunks))
}
