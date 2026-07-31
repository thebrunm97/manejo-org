package mcp

import (
	"encoding/json"
	"fmt"
	"testing"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"google.golang.org/genai"
)

func TestCheckTools(t *testing.T) {
	s := &Server{
		tools:        make(map[string]Tool),
	}
	s.InitializeTools()

	hasError := false
	for _, tool := range s.tools {
		schema := llm.MapToGenaiSchema(tool.Definition.Parameters, true)
		checkSchemaRecursive(tool.Definition.Name, "root", schema, &hasError)
		if tool.Definition.Name == "consultar_base_conhecimento" {
			googleTool := tool.Definition.ParaGoogle()
			b, _ := json.MarshalIndent(googleTool, "", "  ")
			fmt.Printf("JSON for consultar_base_conhecimento TOOL:\n%s\n", string(b))
		}
	}
	if !hasError {
		fmt.Println("All tools are valid.")
	} else {
		t.Fail()
	}
}

func checkSchemaRecursive(toolName, path string, s *genai.Schema, hasError *bool) {
	if s == nil {
		return
	}
	if s.Required != nil {
		for j, req := range s.Required {
			prop, ok := s.Properties[req]
			if !ok {
				fmt.Printf("Error in tool '%s' at path '%s': required property '%s' (index %d) is NOT defined in properties!\n", toolName, path, req, j)
				*hasError = true
			} else if prop.Type == "" {
				fmt.Printf("Error in tool '%s' at path '%s': required property '%s' has NO TYPE!\n", toolName, path, req)
				*hasError = true
			}
		}
	}
	for k, prop := range s.Properties {
		checkSchemaRecursive(toolName, path+"."+k, prop, hasError)
	}
	if s.Items != nil {
		checkSchemaRecursive(toolName, path+".items", s.Items, hasError)
	}
}
