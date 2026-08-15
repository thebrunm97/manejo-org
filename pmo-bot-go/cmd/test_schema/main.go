package main

import (
	"encoding/json"
	"fmt"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

func main() {
	schema := llm.MapToGenaiSchema(mcp.CalcularAdubacaoDef.Parameters, true)
	b, _ := json.MarshalIndent(schema, "", "  ")
	fmt.Println(string(b))
}
