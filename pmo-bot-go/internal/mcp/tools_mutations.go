package mcp

import (
	"context"
	"fmt"
	"log"
	"time"
)

// handleRegistrarPlantio processes the execution of the RegistrarPlantio tool.
func (s *Server) handleRegistrarPlantio(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID

	log.Printf("🛡️ [SECURITY] Mutações executadas com Sessão Ativa (PMO: %d, User: %s).", pmoID, userID)

	// 2. Montagem do payload JSONB exigido pela RPC
	// Todos os argumentos validados pelo JSON schema (especies, quantidade_valor, etc.) já estão em `args`.
	// Mas precisamos agrupá-los num "payload_arg" para a RPC.

	// A RPC espera um "payload_arg" JSONB que mapeie os campos
	payloadArg := map[string]interface{}{
		"especies":           args["especies"],
		"quantidade":         fmt.Sprintf("%v %v", args["quantidade_valor"], args["quantidade_unidade"]),
		"quantidade_valor":   args["quantidade_valor"],
		"quantidade_unidade": args["quantidade_unidade"],
		"talhao_nome":        args["talhao_nome"],
	}

	if data, exists := args["data"]; exists {
		payloadArg["data"] = data
	}

	if origem, exists := args["origem"]; exists {
		payloadArg["origem"] = origem
	}

	// Passar raw_payload_id se estiver presente (importante para rastreabilidade/ledger)
	if rawPayloadID, exists := args["raw_payload_id"]; exists {
		payloadArg["raw_payload_id"] = rawPayloadID
	}

	// 3. Montagem dos parâmetros da RPC em si
	rpcArgs := map[string]interface{}{
		"pmo_id_arg":  pmoID,
		"user_id_arg": userID,
		"tipo_arg":    "Plantio",
		"payload_arg": payloadArg,
	}

	// A RPC 'rpc_registrar_operacao_campo' em client.go está implementada como:
	// func (c *Client) RegistrarOperacaoCampoRPC(ctx context.Context, args map[string]interface{}, dataArg string)
	// Vamos usá-la. A 'data_arg' pode ser apenas uma string vazia ou ignorada pelo Supabase se não estiver na assinatura da nova RPC.
	// Contudo, se a implementação interna do Supabase não esperar dataArg, o RegistrarOperacaoCampoRPC adiciona data_arg ao payload, o que não faz mal.

	log.Printf("🌱 [MCP] Invocando RPC rpc_registrar_operacao_campo para Plantio. PMO: %d", pmoID)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	result, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, rpcArgs, "")
	if err != nil {
		return nil, fmt.Errorf("falha ao registrar plantio via RPC: %w", err)
	}

	return result, nil
}

// handleCadastrarPropriedade processes property creation, initial PMO setup, and profile activation.
func (s *Server) handleCadastrarPropriedade(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	nome, ok := args["nome"].(string)
	if !ok || nome == "" {
		return nil, fmt.Errorf("nome da propriedade é obrigatório")
	}

	areaTotal, _ := parseArgToFloat(args["area_total_ha"])
	cidade, _ := args["municipio"].(string)
	if cidade == "" {
		cidade, _ = args["cidade"].(string)
	}
	estado, _ := args["uf"].(string)
	if estado == "" {
		estado, _ = args["estado"].(string)
	}
	modalidade, _ := args["modalidade_predominante"].(string)
	if modalidade == "" {
		modalidade = "Organico"
	}

	propID, pmoID, err := s.supabase.CriarPropriedadeComPMO(ctx, tenant.UserID, nome, areaTotal, cidade, estado, modalidade)
	if err != nil {
		return nil, fmt.Errorf("falha ao cadastrar propriedade: %w", err)
	}

	// Atualiza o tenant ativo para o RESTO DESTE TURNO: se o LLM encadear outra
	// chamada de ferramenta na mesma resposta (ex: cadastrar propriedade e já
	// registrar um plantio nela), essa chamada seguinte precisa enxergar o PMO/
	// propriedade recém-criados sem esperar um refetch do profile no banco.
	// tenantUpdaterFromContext é injetado só por CallTool — é o único ponto do
	// pacote fora deste handler que ainda toca o *supabase.Profile original,
	// exatamente para preservar este caso sem devolver acesso amplo a Profile
	// pros outros 26 handlers (DT-67).
	if update := tenantUpdaterFromContext(ctx); update != nil {
		update(propID, pmoID)
	}

	return fmt.Sprintf("✅ Propriedade '%s' cadastrada com sucesso (ID: %d)! PMO inicial ativado (ID: %d). A propriedade foi selecionada como ativa.", nome, propID, pmoID), nil
}

// handleRegistrarManejoCampo processes general field management operations (organic fertilization, biofertilizers, pruning, pest control).
func (s *Server) handleRegistrarManejoCampo(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	pmoID := tenant.PmoID
	userID := tenant.UserID
	propID := tenant.PropriedadeID

	tipoManejo, _ := args["tipo_manejo"].(string)
	if tipoManejo == "" {
		tipoManejo = "Manejo Geral"
	}

	talhaoNome, _ := args["talhao_nome"].(string)
	if talhaoNome == "" {
		return nil, fmt.Errorf("talhao_nome é obrigatório para registrar manejo")
	}

	payloadArg := map[string]interface{}{
		"tipo_manejo":       tipoManejo,
		"talhao_nome":       talhaoNome,
		"produto_utilizado": args["produto_utilizado"],
		"dosagem_valor":     args["dosagem_valor"],
		"dosagem_unidade":   args["dosagem_unidade"],
		"observacoes":       args["observacoes"],
		"canteiro_numero":   args["canteiro_numero"],
	}

	if data, ok := args["data"].(string); ok && data != "" {
		payloadArg["data"] = data
	} else {
		payloadArg["data"] = time.Now().Format("2006-01-02")
	}

	if rawPayloadID, exists := args["raw_payload_id"]; exists {
		payloadArg["raw_payload_id"] = rawPayloadID
	}
	if idempKey, exists := args["idempotency_key"]; exists {
		payloadArg["idempotency_key"] = idempKey
	}

	rpcArgs := map[string]interface{}{
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": propID,
		"user_id_arg":        userID,
		"tipo_arg":           "Manejo",
		"payload_arg":        payloadArg,
	}

	result, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, rpcArgs, payloadArg["data"].(string))
	if err != nil {
		return nil, fmt.Errorf("falha ao registrar manejo de campo via RPC: %w", err)
	}

	return result, nil
}

// handleRegistrarCotaCooperativa processes quota commitments for cooperative demands.
func (s *Server) handleRegistrarCotaCooperativa(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	demandaIDStr, _ := args["demanda_id"].(string)
	if demandaIDStr == "" {
		if dNum, ok := args["demanda_id"].(float64); ok {
			demandaIDStr = fmt.Sprintf("%.0f", dNum)
		}
	}
	if demandaIDStr == "" {
		return nil, fmt.Errorf("demanda_id é obrigatório para assumir cota")
	}

	qtd, err := parseArgToFloat(args["quantidade_comprometida"])
	if err != nil || qtd <= 0 {
		return nil, fmt.Errorf("quantidade_comprometida é obrigatória e deve ser maior que zero")
	}

	dataEntrega, _ := args["data_prevista_entrega"].(string)
	if dataEntrega == "" {
		dataEntrega = time.Now().AddDate(0, 1, 0).Format("2006-01-02")
	}

	obs, _ := args["observacoes"].(string)
	unidade, _ := args["unidade"].(string)
	if unidade == "" {
		unidade = "kg"
	}

	payload := map[string]interface{}{
		"demanda_id":     demandaIDStr,
		"propriedade_id": tenant.PropriedadeID,
		"usuario_id":     tenant.UserID,
		"quantidade":     qtd,
		"data_plantio":   dataEntrega,
		"observacao_ia":  fmt.Sprintf("Cota assumida via PMO Bot: %.2f %s. %s", qtd, unidade, obs),
	}

	err = s.supabase.RegistrarCotaComCronograma(ctx, payload)
	if err != nil {
		return nil, fmt.Errorf("falha ao registrar cota na cooperativa: %w", err)
	}

	return fmt.Sprintf("✅ Cota de %.2f %s registrada com sucesso para a Demanda #%s! O cronograma de entrega foi vinculado.", qtd, unidade, demandaIDStr), nil
}
