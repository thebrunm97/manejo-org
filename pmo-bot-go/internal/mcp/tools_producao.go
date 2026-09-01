package mcp

import (
	"context"
	"fmt"
	"log"
	"time"
)

func (s *Server) handleRegistrarColheita(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	log.Printf("🧺 [MCP-TOOL] handleRegistrarColheita Args: %+v", args)
	data := sanitize(args["data"])
	if data == "" {
		data = time.Now().Format("2006-01-02")
	}

	qtd, errQtd := parseArgToFloat(args["quantidade"])
	log.Printf("🛠️ [DEBUG] parseArgToFloat(quantidade) -> qtd: %f, err: %v, original: %v, type: %T", qtd, errQtd, args["quantidade"], args["quantidade"])
	unidade := sanitize(args["unidade"])
	talhao := sanitize(args["talhao"])
	cultura := sanitize(args["cultura"])
	if cultura == "" {
		return nil, fmt.Errorf("o campo 'cultura' é obrigatório")
	}
	valorTotal, _ := parseArgToFloat(args["valor_total"])

	payloadArg := map[string]interface{}{
		"data":                data,
		"produto":             cultura,
		"quantidade_valor":    qtd,
		"quantidade_unidade":  unidade,
		"talhao_nome":         talhao,
		"destino_inicial":     sanitize(args["destino_inicial"]),
		"observacao_original": fmt.Sprintf("Colheita de %s registrada via MCP Tool.", cultura),
		"valor_total":         valorTotal,
	}
	if rawPayloadID, ok := args["raw_payload_id"].(string); ok && rawPayloadID != "" {
		payloadArg["raw_payload_id"] = rawPayloadID
	}
	resp, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": propID,
		"user_id_arg":        userID,
		"tipo_arg":           "Colheita",
		"payload_arg":        payloadArg,
	}, data)
	if err != nil {
		return fmt.Sprintf("Erro ao registrar colheita via RPC: %v", err), nil
	}

	id := resp["id"]
	lote := resp["lote"]

	if id == nil {
		return "Erro: O banco de dados confirmou a operação, mas não retornou um ID de registro (Silent Failure). O registro pode não ter sido salvo devido a permissões de segurança (RLS).", nil
	}

	return fmt.Sprintf("Colheita de %v %s de %s registrada com sucesso (Lote: %v).", qtd, unidade, cultura, lote), nil
}

func (s *Server) handleRegistrarVenda(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	log.Printf("💰 [MCP-TOOL] handleRegistrarVenda Args: %+v", args)
	data := sanitize(args["data"])
	if data == "" {
		data = time.Now().Format("2006-01-02")
	}

	qtd, _ := parseArgToFloat(args["quantidade"])
	unidade := sanitize(args["unidade"])
	valorUnit, _ := parseArgToFloat(args["valor_unitario"])
	produto := sanitize(args["produto"])
	cliente := sanitize(args["cliente"])
	valorTotal, _ := parseArgToFloat(args["valor_total"])
	if valorTotal <= 0 && valorUnit > 0 && qtd > 0 {
		valorTotal = valorUnit * qtd
	}

	payloadArg := map[string]interface{}{
		"data":                data,
		"produto":             produto,
		"quantidade_valor":    qtd,
		"quantidade_unidade":  unidade,
		"fornecedor":          cliente,
		"destinacao":          sanitize(args["destinacao"]),
		"valor_unitario":      valorUnit,
		"observacao_original": fmt.Sprintf("Venda de %s para %s registrada via MCP Tool.", produto, cliente),
		"valor_total":         valorTotal,
	}
	if rawPayloadID, ok := args["raw_payload_id"].(string); ok && rawPayloadID != "" {
		payloadArg["raw_payload_id"] = rawPayloadID
	}
	resp, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": propID,
		"user_id_arg":        userID,
		"tipo_arg":           "Venda",
		"payload_arg":        payloadArg,
	}, data)
	if err != nil {
		return fmt.Sprintf("Erro ao registrar venda via RPC: %v", err), nil
	}

	id := resp["id"]

	if id == nil {
		return "Erro: O banco de dados confirmou a venda, mas não retornou um ID de registro (Silent Failure). Verifique as permissões de acesso.", nil
	}

	return fmt.Sprintf("Venda de %s (%v %s) para '%s' salva com sucesso.", produto, qtd, unidade, cliente), nil
}

func (s *Server) handleConsultarDemandasCooperativa(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	log.Printf("📋 [MCP-TOOL] handleConsultarDemandasCooperativa Args: %+v", args)
	if propID == 0 {
		return "Erro: propriedade_id não informado. Não consigo consultar as demandas sem saber a qual fazenda você pertence.", nil
	}

	demandas, err := s.supabase.FetchDemandasPorPropriedade(propID)
	if err != nil {
		return fmt.Sprintf("Erro ao consultar o mural de demandas: %v", err), nil
	}

	if len(demandas) == 0 {
		return "Não encontrei nenhuma demanda aberta no mural das suas organizações no momento.", nil
	}

	var response string
	response = "Aqui estão as demandas abertas para as suas organizações:\n\n"
	for i, d := range demandas {
		prazo := "sem prazo"
		if d.DataEntrega != "" {
			// Suportando formatos variados (YYYY-MM-DD ou RFC3339)
			dateStr := d.DataEntrega
			if len(dateStr) > 10 {
				dateStr = dateStr[:10]
			}
			t, err := time.Parse("2006-01-02", dateStr)
			if err == nil {
				prazo = t.Format("02/01/2006")
			} else {
				prazo = d.DataEntrega
			}
		}

		response += fmt.Sprintf("%d) *%s*\n", i+1, d.Titulo)
		response += fmt.Sprintf("   • Produto: %s\n", d.Cultura)
		response += fmt.Sprintf("   • Volume: %v %s\n", d.QuantidadeTotal, d.Unidade)
		if d.PrecoReferencia > 0 {
			response += fmt.Sprintf("   • Preço Ref.: R$ %.2f/%s\n", d.PrecoReferencia, d.Unidade)
		}
		response += fmt.Sprintf("   • Prazo: %s\n", prazo)
		if d.ModalidadeExigida != "" {
			response += fmt.Sprintf("   • Modalidade: %s\n", d.ModalidadeExigida)
		}
		response += "\n"
	}

	response += "Para ofertar sua produção para alguma destas demandas, você pode me informar por aqui que eu registro sua intenção."

	return response, nil
}
