package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

type AlocacaoTalhao struct {
	TalhaoID     *int64  `json:"talhao_id,omitempty"`
	TalhaoNome   string  `json:"talhao_nome"`
	ValorAlocado float64 `json:"valor_alocado"`
}

func (s *Server) handleCalcularAdubacao(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	cultura := sanitize(args["cultura"])
	meta, _ := parseArgToFloat(args["meta_produtividade"])
	aduboNome := sanitize(args["adubo_base_nome"])

	if cultura == "" || meta <= 0 || aduboNome == "" {
		return nil, fmt.Errorf("argumentos insuficientes para cálculo: cultura=%s, meta=%v, adubo=%s", cultura, meta, aduboNome)
	}

	log.Printf("🧪 [MCP-TOOL] Calculando recomendação agronomica para %s (Meta: %v t/ha) com %s", cultura, meta, aduboNome)
	res, err := s.supabase.CalcularBalancoNutricional(ctx, cultura, meta, aduboNome)
	if err != nil {
		return nil, fmt.Errorf("erro no motor agronômico: %w", err)
	}

	return res, nil
}

func (s *Server) handleAdicionarInsumoPMO(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	// SECURE SESSION INJECTION — pmo_id vem do TenantCtx, nunca dos args (DT-67)
	pmoID := tenant.PmoID

	log.Printf("🚨 [DEBUG TOOL] handleAdicionarInsumoPMO Args recebidos do LLM: %+v", args)

	// SECURITY: pmo_id sempre do TenantCtx, args value is ignored
	pmoIDVal := pmoID
	var pmoIDPtr *int64
	if pmoIDVal > 0 {
		val := int64(pmoIDVal)
		pmoIDPtr = &val
	}

	record := supabase.PmoInsumoInsert{
		PmoID:           pmoIDPtr,
		ProdutoManejo:   sanitize(args["produto_manejo"]),
		CulturaDestino:  sanitize(args["cultura_destino"]),
		EpocaFrequencia: sanitize(args["epoca_frequencia"]),
		Procedencia:     sanitize(args["procedencia"]),
		Composicao:      sanitize(args["composicao"]),
		Marca:           sanitize(args["marca"]),
		Dosagem:         sanitize(args["dosagem"]),
	}

	log.Printf("🧪 [MCP-TOOL] Registrando insumo '%s' para PMO %v", record.ProdutoManejo, pmoIDPtr)

	qtd := strings.TrimSpace(strings.ToUpper(record.Dosagem))
	if record.ProdutoManejo == "" || qtd == "" || qtd == "0" || qtd == "NÃO INFORMADO" || qtd == "NULL" || qtd == "NENHUM" || strings.Contains(qtd, "0 ") {
		return "ERRO FATAL: O usuário não informou a quantidade/dosagem exata. Não adivinhe, não use zeros. Pergunte a ele: 'Qual a quantidade que você usou ou comprou?'", nil
	}

	err := s.supabase.InsertPMOInsumo(record)
	if err != nil {
		return fmt.Sprintf("Erro ao inserir insumo: %v", err), nil
	}

	return fmt.Sprintf("Insumo '%s' registrado com sucesso na Seção 8 do seu plano.", record.ProdutoManejo), nil
}

func (s *Server) handleRegistrarLimpeza(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	log.Printf("🧽 [MCP-TOOL] handleRegistrarLimpeza Args: %+v", args)
	payload := map[string]interface{}{
		"item_area":         sanitize(args["item_area"]),
		"tipo_limpeza":      sanitize(args["tipo_limpeza"]),
		"produto_utilizado": sanitize(args["produto_utilizado"]),
		"dosagem":           sanitize(args["dosagem"]),
		"responsavel":       sanitize(args["responsavel"]),
		"observacao":        sanitize(args["observacao"]),
		"data":              time.Now().Format("2006-01-02"),
	}
	if rawPayloadID, ok := args["raw_payload_id"].(string); ok && rawPayloadID != "" {
		payload["raw_payload_id"] = rawPayloadID
	}

	var pmoIDValue interface{}
	if pmoID > 0 {
		pmoIDValue = pmoID
	} else {
		pmoIDValue = nil
	}
	dataArg := payload["data"].(string)
	res, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
		"pmo_id_arg":         pmoIDValue,
		"propriedade_id_arg": propID,
		"user_id_arg":        userID,
		"tipo_arg":           "Limpeza",
		"payload_arg":        payload,
	}, dataArg)

	if err != nil {
		return fmt.Errorf("erro ao registrar limpeza: %w", err), nil
	}

	if status, ok := res["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco: %v", res["message"]), nil
	}

	return fmt.Sprintf("Limpeza de '%s' registrada com sucesso.", payload["item_area"]), nil
}

func (s *Server) handleRegistrarPropagacaoVegetal(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	log.Printf("🌱 [MCP-TOOL] handleRegistrarPropagacaoVegetal Args: %+v", args)
	valorTotal, _ := parseArgToFloat(args["valor_total"])

	payload := map[string]interface{}{
		"tipo":             sanitize(args["tipo"]),
		"especies":         sanitize(args["especies"]),
		"origem":           sanitize(args["origem"]),
		"quantidade":       sanitize(args["quantidade"]),
		"sistema_organico": args["sistema_organico"],
		"data":             sanitize(args["data_compra"]),
		"valor_total":      valorTotal,
	}
	if rawPayloadID, ok := args["raw_payload_id"].(string); ok && rawPayloadID != "" {
		payload["raw_payload_id"] = rawPayloadID
	}

	if payload["especies"] == "" || payload["tipo"] == "" || payload["quantidade"] == "" {
		return "ERRO FATAL: Espécie, tipo e quantidade são obrigatórios.", nil
	}

	var pmoIDValue interface{}
	if pmoID > 0 {
		pmoIDValue = pmoID
	} else {
		pmoIDValue = nil
	}
	dataArg := time.Now().Format("2006-01-02")
	res, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
		"pmo_id_arg":         pmoIDValue,
		"propriedade_id_arg": propID,
		"user_id_arg":        userID,
		"tipo_arg":           "Propagacao",
		"payload_arg":        payload,
	}, dataArg)

	if err != nil {
		return fmt.Errorf("erro ao registrar propagação: %w", err), nil
	}

	if status, ok := res["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco: %v", res["message"]), nil
	}

	return fmt.Sprintf("Material de propagação '%s' (%s) registrado com sucesso.", payload["especies"], payload["tipo"]), nil
}

func (s *Server) handleRegistrarCompostagem(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	log.Printf("🍂 [MCP-TOOL] handleRegistrarCompostagem Args: %+v", args)
	payload := map[string]interface{}{
		"acao":                sanitize(args["acao"]),
		"identificador_pilha": sanitize(args["identificador_pilha"]),
		"materiais":           sanitize(args["materiais"]),
		"temperatura":         args["temperatura"],
		"observacao":          sanitize(args["observacao"]),
		"data":                time.Now().Format("2006-01-02"),
	}
	if rawPayloadID, ok := args["raw_payload_id"].(string); ok && rawPayloadID != "" {
		payload["raw_payload_id"] = rawPayloadID
	}

	if payload["acao"] == "" || payload["identificador_pilha"] == "" {
		return "ERRO FATAL: Ação e identificador da pilha são obrigatórios.", nil
	}

	var pmoIDValue interface{}
	if pmoID > 0 {
		pmoIDValue = pmoID
	} else {
		pmoIDValue = nil
	}
	dataArg := payload["data"].(string)
	res, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
		"pmo_id_arg":         pmoIDValue,
		"propriedade_id_arg": propID,
		"user_id_arg":        userID,
		"tipo_arg":           "Compostagem",
		"payload_arg":        payload,
	}, dataArg)

	if err != nil {
		return fmt.Errorf("erro ao processar ação de compostagem: %w", err), nil
	}

	if status, ok := res["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Aviso: %v", res["message"]), nil
	}

	return res["message"], nil
}

func (s *Server) handleRegistrarCompraInsumo(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID
	_ = pmoID
	_ = userID
	_ = propID

	log.Printf("🛒 [MCP-TOOL] handleRegistrarCompraInsumo Args: %+v", args)
	var qtdValorPtr *float64
	if val, ok := args["quantidade_valor"]; ok && val != nil {
		if f, err := parseArgToFloat(val); err == nil && f > 0 {
			v := f
			qtdValorPtr = &v
		}
	}

	var qtdUnidadeVal interface{}
	if val, ok := args["quantidade_unidade"]; ok && val != nil {
		sVal := sanitize(val)
		if sVal != "" {
			qtdUnidadeVal = sVal
		}
	}

	var alocacoesPtr *[]AlocacaoTalhao
	if rawAlocs, ok := args["alocacoes_talhoes"]; ok && rawAlocs != nil {
		var alocList []AlocacaoTalhao
		rawJSON, err := json.Marshal(rawAlocs)
		if err == nil {
			if err := json.Unmarshal(rawJSON, &alocList); err == nil && len(alocList) > 0 {
				alocacoesPtr = &alocList
			}
		}
	}

	produto := sanitize(args["produto"])
	fornecedor := sanitize(args["fornecedor"])

	dataCompra := sanitize(args["data_compra"])
	if dataCompra == "" {
		dataCompra = time.Now().Format("2006-01-02")
	}
	valorTotal, _ := parseArgToFloat(args["valor_total"])

	rpcArgs := map[string]interface{}{
		"pmo_id_arg":             pmoID,
		"propriedade_id_arg":     propID,
		"user_id_arg":            userID,
		"produto_arg":            produto,
		"quantidade_valor_arg":   qtdValorPtr,
		"quantidade_unidade_arg": qtdUnidadeVal,
		"fornecedor_arg":         fornecedor,
		"data_compra_arg":        dataCompra,
		"nota_fiscal_arg":        sanitize(args["nota_fiscal"]),
		"marca_arg":              sanitize(args["marca"]),
		"composicao_arg":         sanitize(args["composicao"]),
		"procedencia_arg":        sanitize(args["procedencia"]),
		"valor_total_arg":        valorTotal,
		"alocacoes_talhoes_arg":  alocacoesPtr,
		"categoria_nome_arg":     sanitize(args["categoria_nome"]),
	}
	if rawPayloadID, ok := args["raw_payload_id"].(string); ok && rawPayloadID != "" {
		rpcArgs["raw_payload_id_arg"] = rawPayloadID
	}

	if produto == "" {
		return "ERRO FATAL: O usuário não informou o produto. Pergunte a ele os detalhes da compra.", nil
	}

	log.Printf("🛒 [MCP-TOOL] Chamando RPC para compra de '%s' para PMO %d", produto, pmoID)

	resp, err := s.supabase.RegistrarCompraInsumoRPC(ctx, rpcArgs)
	if err != nil {
		return fmt.Errorf("erro ao registrar compra via RPC: %w", err), nil
	}

	if status, ok := resp["status"].(string); ok && status == "error" {
		return fmt.Sprintf("Erro no banco de dados: %v", resp["message"]), nil
	}

	compraID := resp["compra_id"]
	if compraID == nil {
		return "Erro: O banco de dados confirmou o registro da compra, mas não retornou um ID (Silent Failure). Isso geralmente indica um bloqueio de RLS ou falta de vinculação com a propriedade correta.", nil
	}

	return fmt.Sprintf("Compra de '%s' registrada com sucesso.", produto), nil
}
