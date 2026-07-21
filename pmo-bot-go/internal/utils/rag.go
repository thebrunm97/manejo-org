package utils

import (
	"bytes"
	"time"

	"github.com/ledongthuc/pdf"
)

// ExtractTextFromPDF uses ledongthuc/pdf to get all text from document.
func ExtractTextFromPDF(path string) (string, error) {
	defer TraceLatency("ExtractTextFromPDF", time.Now())
	f, r, err := pdf.Open(path)
	if f != nil {
		defer f.Close()
	}
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	b, err := r.GetPlainText()
	if err != nil {
		return "", err
	}
	buf.ReadFrom(b)

	return buf.String(), nil
}

// SimpleChunking creates chunks of size 'limit' with an 'overlap'.
func SimpleChunking(text string, limit int, overlap int) []string {
	if len(text) <= limit {
		return []string{text}
	}

	var chunks []string
	start := 0
	for start < len(text) {
		end := start + limit
		if end > len(text) {
			end = len(text)
		}

		chunks = append(chunks, text[start:end])
		if end == len(text) {
			break
		}
		start = end - overlap
	}
	return chunks
}
