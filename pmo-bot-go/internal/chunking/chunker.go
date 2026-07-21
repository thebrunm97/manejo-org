package chunking

import (
	"crypto/sha256"
	"fmt"
	"log"
	"regexp"
	"strings"
)

// ChunkData armazena o pedaço de texto e os seus metadados.
type ChunkData struct {
	Content          string
	ChunkHash        string
	ChunkIndex       int
	SourceDocumentID string
}

const (
	HardCutLimit = 3000 // Aprox 750 tokens
	WarnMinLimit = 50
	WarnMaxLimit = 3200
)

// SmartSplit faz o particionamento hierárquico do texto
func SmartSplit(text string, sourceDocID string) []ChunkData {
	var chunks []ChunkData
	var indexCounter int

	// Tenta dividir por parágrafos primeiro
	paragraphs := strings.Split(text, "\n\n")

	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}

		if len(p) > HardCutLimit {
			// Tenta dividir por frases
			re := regexp.MustCompile(`([.!?;])\s+`)
			sentences := re.Split(p, -1)
			
			var currentChunk strings.Builder
			for _, sentence := range sentences {
				sentence = strings.TrimSpace(sentence)
				if sentence == "" {
					continue
				}

				if currentChunk.Len()+len(sentence) > HardCutLimit {
					// Guarda o chunk atual se não estiver vazio
					if currentChunk.Len() > 0 {
						chunks = append(chunks, createChunk(currentChunk.String(), sourceDocID, &indexCounter))
						currentChunk.Reset()
					}
					
					// Se a própria frase for maior que o HardCut, corta a cru (hard cut)
					if len(sentence) > HardCutLimit {
						for len(sentence) > HardCutLimit {
							cut := sentence[:HardCutLimit]
							chunks = append(chunks, createChunk(cut, sourceDocID, &indexCounter))
							sentence = sentence[HardCutLimit:]
						}
					}
					currentChunk.WriteString(sentence + " ")
				} else {
					currentChunk.WriteString(sentence + " ")
				}
			}
			// Guarda o que restou
			if currentChunk.Len() > 0 {
				chunks = append(chunks, createChunk(currentChunk.String(), sourceDocID, &indexCounter))
			}
		} else {
			chunks = append(chunks, createChunk(p, sourceDocID, &indexCounter))
		}
	}

	return chunks
}

func createChunk(content, sourceDocID string, index *int) ChunkData {
	content = strings.TrimSpace(content)
	
	if len(content) < WarnMinLimit {
		log.Printf("⚠️ [Chunking Warn] Chunk gerado é muito pequeno (%d chars).", len(content))
	} else if len(content) > WarnMaxLimit {
		log.Printf("⚠️ [Chunking Warn] Chunk gerado excede tamanho recomendado (%d chars).", len(content))
	}

	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(content+sourceDocID)))
	
	chunk := ChunkData{
		Content:          content,
		ChunkHash:        hash,
		ChunkIndex:       *index,
		SourceDocumentID: sourceDocID,
	}
	*index++
	
	return chunk
}
