package state

// This file is a placeholder for the Phase 03 implementation of financial records and split-billing.
// It will be populated with the rpc_registrar_transacao_com_rateio logic.

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/groq"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/tts"
)

func handleRegistroFinanceiro(ctx context.Context, ext *groq.ExtractionResult, profile *supabase.Profile, sbClient *supabase.Client, wpClient ports.MessageSender, ttsClient *tts.Orchestrator, from string, respondWithAudio bool) (string, ProcessResult) {
	// 1. Extração e Normalização do Valor Total
	valorTotal, err := parseNumeric(ext.ValorTotal)
	if err != nil || valorTotal <= 0 {
		msg := "💰 Ops! Não consegui identificar o valor da transação. Pode repetir o valor, por favor?"
		return msg, ProcessResult{Success: false, Reason: "valor_invalido"}
	}

	// 2. Resolução de Categoria
	tipo := "DESPESA"
	if strings.ToUpper(ext.Intencao) == "VENDA" || strings.ToUpper(ext.Intencao) == "RECEITA" {
		tipo = "RECEITA"
	}

	catNome := ext.Atividade
	if catNome == "" {
		catNome = "Outros"
	}

	categoriaID, err := sbClient.GetCategoriaFinanceiraByName(catNome, tipo)
	if err != nil {
		// Fallback para categoria "Outros" se a específica falhar
		categoriaID, _ = sbClient.GetCategoriaFinanceiraByName("Outros", tipo)
	}

	// 3. Resolução de Talhões (Fuzzy Match)
	var alocacoes []map[string]interface{}
	var talhoesResolvidos []string

	if len(ext.Alocacoes) > 0 {
		for _, aloc := range ext.Alocacoes {
			targetID := int64(0)
			normalizedTarget := strings.ToLower(aloc.TalhaoNome)

			for _, t := range profile.Talhoes {
				if strings.Contains(strings.ToLower(t.Nome), normalizedTarget) {
					targetID = t.ID
					talhoesResolvidos = append(talhoesResolvidos, t.Nome)
					break
				}
			}

			if targetID > 0 {
				alocacoes = append(alocacoes, map[string]interface{}{
					"talhao_id":      targetID,
					"valor_alocado": aloc.Valor,
				})
			}
		}
	}

	// Se pediu alocação mas não resolveu nenhum talhão, avisa o usuário
	if len(ext.Alocacoes) > 0 && len(alocacoes) == 0 {
		msg := fmt.Sprintf("🧐 Não encontrei nenhum talhão com o nome mencionado. Seus talhões ativos são: %s", formatTalhoes(profile.Talhoes))
		return msg, ProcessResult{Success: false, Reason: "talhao_nao_encontrado"}
	}

	// 4. Montagem do Payload para RPC
	payload := map[string]interface{}{
		"propriedade_id":     profile.PropriedadeAtivaID,
		"categoria_id":       categoriaID,
		"tipo":               tipo,
		"valor_total":        valorTotal,
		"fornecedor_cliente": ext.Fornecedor,
		"user_id":            profile.ID,
		"alocacoes":          alocacoes,
	}

	// 5. Chamada RPC Atômica
	res, err := sbClient.RegistrarTransacaoComRateioRPC(ctx, payload)
	if err != nil {
		msg := "❌ Erro ao registrar transação no banco de dados. Por favor, tente novamente em instantes."
		return msg, ProcessResult{Success: false, Reason: "error_rpc"}
	}

	// 6. Feedback de Sucesso
	emoji := "💸"
	if tipo == "RECEITA" {
		emoji = "💰"
	}

	msg := fmt.Sprintf("%s *Registro Financeiro:*\n", emoji)
	msg += fmt.Sprintf("• *Tipo:* %s\n", tipo)
	msg += fmt.Sprintf("• *Valor:* R$ %.2f\n", valorTotal)
	if ext.Fornecedor != "" {
		msg += fmt.Sprintf("• *Origem/Destino:* %s", ext.Fornecedor)
	}

	if len(talhoesResolvidos) > 0 {
		msg += fmt.Sprintf("\n🚜 *Rateado nos talhões:* %s", strings.Join(talhoesResolvidos, ", "))
	} else {
		msg += "\n📍 *Alocado na Propriedade (Geral)*"
	}

	transID := ""
	if res != nil {
		if id, ok := res["transacao_id"].(string); ok {
			transID = id
		}
	}

	return msg, ProcessResult{
		Success:       true,
		Reason:        "record_saved",
		TransactionID: transID,
	}
}

// Helper: parseNumeric lida com os tipos flexíveis do JSON (float64 ou string)
func parseNumeric(val interface{}) (float64, error) {
	switch v := val.(type) {
	case float64:
		return v, nil
	case string:
		return strconv.ParseFloat(v, 64)
	case int:
		return float64(v), nil
	default:
		return 0, fmt.Errorf("invalid type")
	}
}

// Helper: formatTalhoes para mensagem de erro
func formatTalhoes(talhoes []supabase.Talhao) string {
	var names []string
	for _, t := range talhoes {
		names = append(names, t.Nome)
	}
	return strings.Join(names, ", ")
}
