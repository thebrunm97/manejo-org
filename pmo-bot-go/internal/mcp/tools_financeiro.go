package mcp

import (
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"context"
	"fmt"
	"log"
)

// handleConsultarBalancoFinanceiro processes the tool call to get financial reports.
func (s *Server) handleConsultarBalancoFinanceiro(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	// SECURE SESSION INJECTION
	if profile == nil {
		return nil, fmt.Errorf("unauthorized: missing profile")
	}

	// A propriedade SEMPRE vem da sessão, nunca dos args do LLM (DT-67): o schema desta
	// tool nem declara "propriedade_id" como parâmetro, então um valor aqui só chegaria
	// por alucinação do modelo — e a query correria com a service_role key, que ignora RLS.
	if profile.PropriedadeAtivaID == 0 {
		return nil, fmt.Errorf("usuário não tem propriedade ativa selecionada")
	}
	propriedadeID := int(profile.PropriedadeAtivaID)

	log.Printf("🛠️ [MCP] Executando get_dre_mensal")

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

	result, err := s.supabase.GetBalancoIA(ctx, propriedadeID, ano, mesPtr)
	if err != nil {
		log.Printf("❌ [MCP] Erro ao buscar balanço financeiro: %v", err)
		return nil, fmt.Errorf("erro ao buscar balanço financeiro no banco de dados: %w", err)
	}

	log.Printf("✅ [MCP] Balanço financeiro retornado com sucesso para propriedade %d", propriedadeID)
	return result, nil
}

// handleRegistrarDespesa processes the tool call to register a financial expense.
func (s *Server) handleRegistrarDespesa(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	if profile == nil {
		return nil, fmt.Errorf("unauthorized: missing profile")
	}

	valorTotalFloat, err := parseArgToFloat(args["valor_total"])
	if err != nil || valorTotalFloat <= 0 {
		return nil, fmt.Errorf("O valor da despesa não foi informado. Pergunte ao utilizador.")
	}

	descricao, _ := args["descricao"].(string)
	if descricao == "" {
		return nil, fmt.Errorf("descricao é obrigatória")
	}

	categoriaNome, _ := args["categoria_nome"].(string)
	if categoriaNome == "" {
		categoriaNome = "Outros"
	}

	// Fetch category UUID
	categoriaID, err := s.supabase.GetCategoriaFinanceiraByName(categoriaNome, "DESPESA")
	if err != nil {
		// Fallback to "Outros"
		categoriaID, err = s.supabase.GetCategoriaFinanceiraByName("Outros", "DESPESA")
		if err != nil {
			return nil, fmt.Errorf("falha ao buscar categoria: %w", err)
		}
	}

	payload := map[string]interface{}{
		"propriedade_id":     profile.PropriedadeAtivaID,
		"categoria_id":       categoriaID,
		"tipo":               "DESPESA",
		"valor_total":        valorTotalFloat,
		"fornecedor_cliente": descricao,
		"user_id":            profile.ID,
		"pmo_id":             profile.PmoAtivoID,
	}

	if data, ok := args["data"].(string); ok && data != "" {
		payload["data_competencia"] = data
	}

	// Optional talhao logic (could be extended later if GetTalhaoByName is implemented)
	// if talhaoNome, ok := args["talhao_nome"].(string); ok && talhaoNome != "" {
	//    // Fetch talhaoID and inject into payload["alocacoes"]
	// }

	_, err = s.supabase.RegistrarTransacaoComRateioRPC(ctx, payload)
	if err != nil {
		log.Printf("❌ [MCP] Erro ao registrar despesa: %v", err)
		return nil, fmt.Errorf("erro ao registrar despesa no banco de dados: %w", err)
	}

	log.Printf("✅ [MCP] Despesa de R$ %.2f registrada com sucesso", valorTotalFloat)
	return fmt.Sprintf("Despesa registrada com sucesso no valor de R$ %.2f (Categoria: %s).", valorTotalFloat, categoriaNome), nil
}
