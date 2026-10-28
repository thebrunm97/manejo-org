package mcp

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// Onde cada operação do rascunho costuma trazer produto e quantidade (o LLM
// monta o payload livremente, então aceitamos as variações conhecidas).
var (
	chavesProduto    = []string{"produto", "cultura", "especies", "produto_utilizado", "produto_insumo"}
	chavesQuantidade = []string{"quantidade_valor", "quantidade", "dosagem_valor"}
)

func tipoDaOperacao(op domain.BatchMutationItem) string {
	if op.Type == "compra_insumo" {
		return "compra"
	}
	if t := strings.TrimSpace(op.TipoOperacao); t != "" {
		return strings.ToLower(t)
	}
	return "registo"
}

func numeroDe(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case string:
		f, _ := strconv.ParseFloat(strings.Replace(strings.TrimSpace(n), ",", ".", 1), 64)
		return f
	}
	return 0
}

// avisosDuplicata devolve um aviso por operação do rascunho que repete um
// registro das últimas horas (mesmo produto e quantidade). Falha na consulta
// não impede o rascunho.
func (s *Server) avisosDuplicata(ctx context.Context, pmoID int64, phone string, ops []domain.BatchMutationItem) []string {
	if s.supabase == nil || pmoID <= 0 {
		return nil
	}
	agora := time.Now().In(utils.TimezoneSistema())
	var avisos []string
	for _, op := range ops {
		if op.Type == "cotas_produtores" || op.Payload == nil {
			continue
		}
		var produto string
		for _, k := range chavesProduto {
			if p, _ := op.Payload[k].(string); strings.TrimSpace(p) != "" {
				produto = strings.TrimSpace(p)
				break
			}
		}
		var qtd float64
		for _, k := range chavesQuantidade {
			if qtd = numeroDe(op.Payload[k]); qtd > 0 {
				break
			}
		}
		if produto == "" || qtd <= 0 {
			continue
		}
		quando, achou, err := s.supabase.RegistroIgualRecente(ctx, pmoID, produto, qtd, agora.Add(-guardrails.JanelaDuplicata))
		if err != nil {
			log.Printf("⚠️ [Duplicata] checagem do rascunho falhou: %v", err)
			continue
		}
		if achou {
			avisos = append(avisos, guardrails.TextoDuplicata(phone, produto, qtd, tipoDaOperacao(op), quando, agora))
		}
	}
	return avisos
}
