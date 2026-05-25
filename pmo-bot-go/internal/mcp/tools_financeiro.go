package mcp

import (
	"context"
	"fmt"
	"log"
)

// handleConsultarBalancoFinanceiro processes the tool call to get financial reports.
func (s *Server) handleConsultarBalancoFinanceiro(args map[string]interface{}) (interface{}, error) {
	log.Printf("🛠️ [MCP] Executando consultar_balanco_financeiro")

	propriedadeIDFloat, err := parseArgToFloat(args["propriedade_id"])
	if err != nil {
		return nil, fmt.Errorf("argumento 'propriedade_id' é obrigatório e deve ser numérico")
	}
	propriedadeID := int(propriedadeIDFloat)

	anoFloat, err := parseArgToFloat(args["ano"])
	if err != nil {
		return nil, fmt.Errorf("argumento 'ano' é obrigatório e deve ser numérico")
	}
	ano := int(anoFloat)

	var mesPtr *int
	if mesVal, ok := args["mes"]; ok && mesVal != nil {
		if mesFloat, err := parseArgToFloat(mesVal); err == nil {
			mes := int(mesFloat)
			mesPtr = &mes
		}
	}

	result, err := s.supabase.GetBalancoIA(context.Background(), propriedadeID, ano, mesPtr)
	if err != nil {
		log.Printf("❌ [MCP] Erro ao buscar balanço financeiro: %v", err)
		return nil, fmt.Errorf("erro ao buscar balanço financeiro no banco de dados: %w", err)
	}

	log.Printf("✅ [MCP] Balanço financeiro retornado com sucesso para propriedade %d", propriedadeID)
	return result, nil
}
