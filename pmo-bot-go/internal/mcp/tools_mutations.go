package mcp

import (
	"context"
	"fmt"
	"log"
	"time"
)

// handleRegistrarPlantio processes the execution of the RegistrarPlantio tool.
func (s *Server) handleRegistrarPlantio(args map[string]interface{}) (interface{}, error) {
	// 1. Extração de argumentos vitais (Sessão Ativa Injetada)
	pmoIDFloat, ok := args["_internal_pmo_id"].(float64)
	if !ok {
		// Tentar ler como inteiro longo (dependendo do JSON unmarshal)
		pmoIDInt, okInt := args["_internal_pmo_id"].(int64)
		if !okInt {
			pmoIDInt2, okInt2 := args["_internal_pmo_id"].(int)
			if !okInt2 {
				return nil, fmt.Errorf("_internal_pmo_id ausente ou inválido no contexto da sessão")
			}
			pmoIDFloat = float64(pmoIDInt2)
		} else {
			pmoIDFloat = float64(pmoIDInt)
		}
	}
	pmoID := int64(pmoIDFloat)

	userID, ok := args["_internal_user_id"].(string)
	if !ok || userID == "" {
		return nil, fmt.Errorf("_internal_user_id ausente no contexto da sessão")
	}

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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, rpcArgs, "")
	if err != nil {
		return nil, fmt.Errorf("falha ao registrar plantio via RPC: %w", err)
	}

	return result, nil
}
