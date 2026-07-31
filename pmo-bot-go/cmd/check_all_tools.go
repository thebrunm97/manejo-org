package main

import (
	"fmt"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
)

func main() {
	server := &mcp.Server{}
	server.InitializeTools()
	tools := server.GetToolsForIntent("DATABASE")

	hasError := false
	for i, tool := range tools {
		schema := llm.MapToGenaiSchema(tool.Parameters, true)
		if schema.Required != nil {
			for j, req := range schema.Required {
				if _, ok := schema.Properties[req]; !ok {
					fmt.Printf("Error in tools[%d] '%s': required property '%s' (index %d) is NOT defined in properties!\n", i, tool.Name, req, j)
					hasError = true
				}
			}
		}
	}
	if !hasError {
		fmt.Println("All tools are valid.")
	}
}
