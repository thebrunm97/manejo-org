package llm

import (
	"strconv"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
)

// ParseToolArgs parses raw JSON arguments into strongly-typed domain payloads.
// These payloads implement Marker Interfaces (e.g. FinancialOperation, AgriculturalOperation)
// for polymorphic validation in the guardrails middleware.
func ParseToolArgs(toolName string, args map[string]interface{}) (any, error) {
	switch toolName {
	case "registrar_compra_insumo":
		valTotal := parseToFloat(args["valor_total"])
		produto := ""
		if p, ok := args["produto"].(string); ok {
			produto = strings.TrimSpace(p)
		}
		var talhoes []string
		if rawAlocs, ok := args["alocacoes_talhoes"].([]interface{}); ok {
			for _, rawAloc := range rawAlocs {
				if alocMap, ok := rawAloc.(map[string]interface{}); ok {
					if tNome, ok := alocMap["talhao_nome"].(string); ok && tNome != "" {
						talhoes = append(talhoes, tNome)
					}
				}
			}
		}
		return guardrails.TransactionPayload{
			ValorTotal: valTotal,
			Produto:    produto,
			Talhoes:    talhoes,
		}, nil

	case "registrar_venda":
		valTotal := parseToFloat(args["valor_total"])
		if valTotal <= 0 {
			qtd := parseToFloat(args["quantidade"])
			valUnit := parseToFloat(args["valor_unitario"])
			valTotal = qtd * valUnit
		}
		produto := ""
		if p, ok := args["produto"].(string); ok {
			produto = strings.TrimSpace(p)
		}
		return guardrails.TransactionPayload{
			ValorTotal: valTotal,
			Produto:    produto,
		}, nil

	case "registrar_limpeza":
		qtd := parseToFloat(args["dosagem"])
		produto := ""
		if p, ok := args["produto_utilizado"].(string); ok {
			produto = strings.TrimSpace(p)
		}
		talhao := ""
		if t, ok := args["item_area"].(string); ok {
			talhao = strings.TrimSpace(t)
		}
		return guardrails.ManejoPayload{
			Quantidade:    qtd,
			Unidade:       "dosagem",
			Produto:       produto,
			TalhaoNome:    talhao,
			TipoAtividade: "Limpeza",
		}, nil

	case "registrar_propagacao_vegetal":
		tipoStr := ""
		if t, ok := args["tipo"].(string); ok {
			tipoStr = strings.TrimSpace(t)
		}
		if strings.EqualFold(tipoStr, "Compra/Aquisição") {
			valTotal := parseToFloat(args["valor_total"])
			produto := ""
			if p, ok := args["especies"].(string); ok {
				produto = strings.TrimSpace(p)
			}
			return guardrails.TransactionPayload{
				ValorTotal: valTotal,
				Produto:    produto,
			}, nil
		} else {
			qtd := parseToFloat(args["quantidade"])
			produto := ""
			if p, ok := args["especies"].(string); ok {
				produto = strings.TrimSpace(p)
			}
			return guardrails.ManejoPayload{
				Quantidade:    qtd,
				Unidade:       "unidades",
				Produto:       produto,
				TalhaoNome:    "Área de Propagação",
				TipoAtividade: "Propagação Vegetal",
			}, nil
		}

	case "registrar_compostagem":
		acaoStr := ""
		if a, ok := args["acao"].(string); ok {
			acaoStr = strings.TrimSpace(a)
		}
		pilha := ""
		if p, ok := args["identificador_pilha"].(string); ok {
			pilha = strings.TrimSpace(p)
		}
		mat := ""
		if m, ok := args["materiais"].(string); ok {
			mat = strings.TrimSpace(m)
		}
		return guardrails.ManejoPayload{
			Quantidade:    0,
			Unidade:       "pilha",
			Produto:       mat,
			TalhaoNome:    pilha,
			TipoAtividade: "Compostagem (" + acaoStr + ")",
		}, nil

	case "registrar_colheita":
		qtd := parseToFloat(args["quantidade"])
		unid := ""
		if u, ok := args["unidade"].(string); ok {
			unid = strings.TrimSpace(u)
		}
		prod := ""
		if p, ok := args["cultura"].(string); ok {
			prod = strings.TrimSpace(p)
		}
		talhao := ""
		if t, ok := args["talhao"].(string); ok {
			talhao = strings.TrimSpace(t)
		}
		return guardrails.ManejoPayload{
			Quantidade:    qtd,
			Unidade:       unid,
			Produto:       prod,
			TalhaoNome:    talhao,
			TipoAtividade: "Colheita",
		}, nil
	}

	// Unknown or generic tool -> pass-through
	return args, nil
}

// parseToFloat is a helper function to safely extract float64 from mixed interface types
func parseToFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int32:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return 0
}
