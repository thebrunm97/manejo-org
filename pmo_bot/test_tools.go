package main

import (
	"encoding/json"
	"fmt"
	"github.com/google/generative-ai-go/genai"
)

func main() {
	schema := &genai.Schema{
		Type:       genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"acao": {
				Type: genai.TypeString,
				Enum: []string{"A", "B"},
			},
		},
		Required: []string{"acao"},
	}
	b, _ := json.MarshalIndent(schema, "", "  ")
	fmt.Println("Result:")
	fmt.Println(string(b))
}
