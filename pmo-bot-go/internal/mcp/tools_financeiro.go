package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// handleConsultarBalancoFinanceiro processes the tool call to get financial reports.
func (s *Server) handleConsultarBalancoFinanceiro(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	// A propriedade SEMPRE vem da sessão, nunca dos args do LLM (DT-67): o schema desta
	// tool nem declara "propriedade_id" como parâmetro, então um valor aqui só chegaria
	// por alucinação do modelo — e a query correria com a service_role key, que ignora RLS.
	if tenant.PropriedadeID == 0 {
		return nil, fmt.Errorf("usuário não tem propriedade ativa selecionada")
	}
	propriedadeID := int(tenant.PropriedadeID)

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
	var bal balancoIA
	if err := json.Unmarshal([]byte(result), &bal); err != nil {
		return result, nil // formato inesperado: deixa o LLM lidar com o JSON cru, como antes
	}
	return map[string]interface{}{
		"status": "success",
		"dados":  bal,
		// Vai direto ao produtor: o LLM trocava MT por R$ e acrescentava
		// comentário em pt-BR depois de um "---".
		"resposta_direta": TextoBalanco(tenant.Telefone, ano, mesPtr, bal),
		"message":         "Balanço pronto enviado ao produtor. Não recalcule nem repita os números.",
	}, nil
}

// balancoIA é o JSON de rpc_get_balanco_ia.
type balancoIA struct {
	Receitas float64 `json:"receitas"`
	Despesas float64 `json:"despesas"`
	Saldo    float64 `json:"saldo"`
	Top      []struct {
		Categoria *string `json:"c"`
		Valor     float64 `json:"v"`
	} `json:"top_despesas"`
}

var nomesMes = []string{"janeiro", "fevereiro", "março", "abril", "maio", "junho",
	"julho", "agosto", "setembro", "outubro", "novembro", "dezembro"}

// TextoBalanco monta o balanço na moeda do país do produtor.
func TextoBalanco(phone string, ano int, mes *int, b balancoIA) string {
	moeda := utils.MoedaSimboloPara(phone)
	valor := func(v float64) string {
		if v < 0 {
			return "−" + utils.FormatarValor(-v) + " " + moeda
		}
		return utils.FormatarValor(v) + " " + moeda
	}
	periodo := fmt.Sprintf("%d", ano)
	if mes != nil && *mes >= 1 && *mes <= 12 {
		periodo = fmt.Sprintf("%s/%d", nomesMes[*mes-1], ano)
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "💰 *Balanço — %s*\n\n", periodo)
	fmt.Fprintf(&sb, "• Receitas: %s\n• Despesas: %s\n\n*Saldo:* %s", valor(b.Receitas), valor(b.Despesas), valor(b.Saldo))
	if len(b.Top) > 0 && b.Despesas > 0 {
		sb.WriteString("\n\nMaiores despesas:")
		for _, t := range b.Top {
			cat := "Sem categoria"
			if t.Categoria != nil && strings.TrimSpace(*t.Categoria) != "" {
				cat = *t.Categoria
			}
			fmt.Fprintf(&sb, "\n• %s: %s", cat, valor(t.Valor))
		}
	}
	return sb.String()
}

// handleRegistrarDespesa processes the tool call to register a financial expense.
func (s *Server) handleRegistrarDespesa(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
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
		"propriedade_id":     tenant.PropriedadeID,
		"categoria_id":       categoriaID,
		"tipo":               "DESPESA",
		"valor_total":        valorTotalFloat,
		"fornecedor_cliente": descricao,
		"user_id":            tenant.UserID,
		"pmo_id":             tenant.PmoID,
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

	log.Printf("✅ [MCP] Despesa de %s %.2f registrada com sucesso", utils.MoedaSimbolo(), valorTotalFloat)
	return fmt.Sprintf("Despesa registrada com sucesso no valor de %s %.2f (Categoria: %s).", utils.MoedaSimbolo(), valorTotalFloat, categoriaNome), nil
}
