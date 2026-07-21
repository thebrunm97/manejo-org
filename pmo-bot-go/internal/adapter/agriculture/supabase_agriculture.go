package agriculture

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// SupabaseAgriculturalRepository implementa a interface AgriculturalRepository
// utilizando o cliente Supabase existente, traduzindo structs tipadas para as
// RPCs legadas que esperam map[string]interface{}.
type SupabaseAgriculturalRepository struct {
	client *supabase.Client
}

// NewSupabaseAgriculturalRepository cria uma nova instância do repositório
func NewSupabaseAgriculturalRepository(client *supabase.Client) *SupabaseAgriculturalRepository {
	return &SupabaseAgriculturalRepository{
		client: client,
	}
}

// RegistrarLoteOperacoes itera sobre um lote de operações e as registra no Supabase.
// Implementa o modelo de Sucesso Parcial.
func (r *SupabaseAgriculturalRepository) RegistrarLoteOperacoes(ctx context.Context, pmoID int, userID string, operacoes []mcp.OperacaoLoteItem) (*ports.BatchResult, error) {
	result := &ports.BatchResult{
		Sucessos: make([]string, 0),
		Erros:    make([]string, 0),
	}

	for i, item := range operacoes {
		var err error

		switch item.Tipo {
		case "Limpeza":
			err = r.processarLimpeza(ctx, pmoID, userID, item.Limpeza)
		case "Propagacao":
			err = r.processarPropagacao(ctx, pmoID, userID, item.Propagacao)
		case "Compostagem":
			err = r.processarCompostagem(ctx, pmoID, userID, item.Compostagem)
		case "Compra":
			err = r.processarCompra(ctx, pmoID, userID, item.Compra)
		case "Colheita":
			err = r.processarColheita(ctx, pmoID, userID, item.Colheita)
		case "Venda":
			err = r.processarVenda(ctx, pmoID, userID, item.Venda)
		default:
			err = fmt.Errorf("tipo de operação desconhecido: %s", item.Tipo)
		}

		if err != nil {
			result.Erros = append(result.Erros, fmt.Sprintf("Erro no item %d (%s): %v", i+1, item.Tipo, err))
		} else {
			result.Sucessos = append(result.Sucessos, fmt.Sprintf("Item %d (%s) registrado com sucesso", i+1, item.Tipo))
		}
	}

	return result, nil
}

func (r *SupabaseAgriculturalRepository) processarLimpeza(ctx context.Context, defaultPmoID int, userID string, schema *mcp.RegistrarLimpezaSchema) error {
	if schema == nil {
		return fmt.Errorf("schema de limpeza vazio")
	}
	pmoID := resolvePmoID(schema.PmoID, defaultPmoID)

	payload := map[string]interface{}{
		"item_area":         schema.AreaLimpa,
		"tipo_limpeza":      schema.Metodo,
		"produto_utilizado": schema.Insumos,
		"observacao":        schema.Objetivo,
		"data":              time.Now().Format("2006-01-02"),
	}

	args := map[string]interface{}{
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": 0, // Fallback
		"user_id_arg":        userID,
		"tipo_arg":           "Limpeza",
		"payload_arg":        payload,
	}

	res, err := r.client.RegistrarOperacaoCampoRPC(ctx, args, payload["data"].(string))
	return checkRPCError(res, err)
}

func (r *SupabaseAgriculturalRepository) processarPropagacao(ctx context.Context, defaultPmoID int, userID string, schema *mcp.RegistrarPropagacaoSchema) error {
	if schema == nil {
		return fmt.Errorf("schema de propagacao vazio")
	}
	pmoID := resolvePmoID(schema.PmoID, defaultPmoID)

	propID := 0
	if schema.PropriedadeID != "" {
		if val, err := strconv.Atoi(schema.PropriedadeID); err == nil {
			propID = val
		}
	}

	payload := map[string]interface{}{
		"tipo":             schema.Tipo,
		"especies":         schema.Especies,
		"origem":           schema.Origem,
		"quantidade":       schema.Quantidade,
		"sistema_organico": schema.SistemaOrganico,
		"data":             time.Now().Format("2006-01-02"),
	}

	args := map[string]interface{}{
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": propID,
		"user_id_arg":        userID,
		"tipo_arg":           "Propagacao",
		"payload_arg":        payload,
	}

	res, err := r.client.RegistrarOperacaoCampoRPC(ctx, args, payload["data"].(string))
	return checkRPCError(res, err)
}

func (r *SupabaseAgriculturalRepository) processarCompostagem(ctx context.Context, defaultPmoID int, userID string, schema *mcp.RegistrarCompostagemSchema) error {
	if schema == nil {
		return fmt.Errorf("schema de compostagem vazio")
	}
	pmoID := resolvePmoID(schema.PmoID, defaultPmoID)

	payload := map[string]interface{}{
		"ingredientes": schema.Ingredientes,
		"origem":       schema.Origem,
		"volume":       schema.Volume,
		"uso_previsto": schema.UsoPrevisto,
		"data":         time.Now().Format("2006-01-02"),
	}

	args := map[string]interface{}{
		"pmo_id_arg":  pmoID,
		"user_id_arg": userID,
		"tipo_arg":    "Compostagem",
		"payload_arg": payload,
	}

	res, err := r.client.RegistrarAtividadeRPC(ctx, args)
	return checkRPCError(res, err)
}

func (r *SupabaseAgriculturalRepository) processarCompra(ctx context.Context, defaultPmoID int, userID string, schema *mcp.RegistrarCompraSchema) error {
	if schema == nil {
		return fmt.Errorf("schema de compra vazio")
	}
	pmoID := resolvePmoID(schema.PmoID, defaultPmoID)

	dataCompra := schema.DataCompra
	if dataCompra == "" {
		dataCompra = time.Now().Format("2006-01-02")
	}

	payload := map[string]interface{}{
		"pmo_id":      pmoID,
		"item":        schema.Item,
		"fornecedor":  schema.Fornecedor,
		"quantidade":  schema.Quantidade,
		"valor_pago":  schema.ValorPago,
		"data_compra": dataCompra,
		"user_id":     userID,
	}

	res, err := r.client.RegistrarCompraInsumoRPC(ctx, payload)
	return checkRPCError(res, err)
}

func (r *SupabaseAgriculturalRepository) processarColheita(ctx context.Context, defaultPmoID int, userID string, schema *mcp.RegistrarColheitaSchema) error {
	if schema == nil {
		return fmt.Errorf("schema de colheita vazio")
	}
	pmoID := resolvePmoID(schema.PmoID, defaultPmoID)

	dataOperacao := schema.Data
	if dataOperacao == "" {
		dataOperacao = time.Now().Format("2006-01-02")
	}

	payload := map[string]interface{}{
		"cultura":    schema.Cultura,
		"quantidade": schema.Quantidade,
		"unidade":    schema.Unidade,
		"talhao":     schema.Talhao,
		"data":       dataOperacao,
		"destino":    schema.Destino,
		"lote":       schema.Lote,
	}

	args := map[string]interface{}{
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": 0, // Fallback
		"user_id_arg":        userID,
		"tipo_arg":           "Colheita",
		"payload_arg":        payload,
	}

	res, err := r.client.RegistrarOperacaoCampoRPC(ctx, args, dataOperacao)
	return checkRPCError(res, err)
}

func (r *SupabaseAgriculturalRepository) processarVenda(ctx context.Context, defaultPmoID int, userID string, schema *mcp.RegistrarVendaSchema) error {
	if schema == nil {
		return fmt.Errorf("schema de venda vazio")
	}
	pmoID := resolvePmoID(schema.PmoID, defaultPmoID)

	dataOperacao := time.Now().Format("2006-01-02")
	
	// Assuming Quantity could be string, but the RPC might expect numbers in some fields
	// Let's pass the raw string if the schema is string, because the original handler parses to float
	// Actually, the new schema is string: Quantidade string.
	// But `handleRegistrarVenda` parses `quantidade` to float. Let's parse it if possible, else 0.
	qtdFloat, _ := strconv.ParseFloat(schema.Quantidade, 64)
	valorVendaFloat, _ := strconv.ParseFloat(schema.ValorVenda, 64)

	payload := map[string]interface{}{
		"data":                dataOperacao,
		"produto":             schema.Produto,
		"quantidade_valor":    qtdFloat,
		"quantidade_unidade":  "kg", // Schema does not have Unidade for Venda, assuming generic or empty
		"fornecedor":          schema.Comprador,
		"valor_total":         valorVendaFloat,
		"observacao_original": fmt.Sprintf("Venda de %s para %s registrada via Lote.", schema.Produto, schema.Comprador),
		"nota_fiscal":         schema.NotaFiscal,
	}

	args := map[string]interface{}{
		"pmo_id_arg":         pmoID,
		"propriedade_id_arg": 0, // Fallback
		"user_id_arg":        userID,
		"tipo_arg":           "Venda",
		"payload_arg":        payload,
	}

	res, err := r.client.RegistrarOperacaoCampoRPC(ctx, args, dataOperacao)
	return checkRPCError(res, err)
}

// Helpers

func checkRPCError(res map[string]interface{}, err error) error {
	if err != nil {
		return err
	}
	if res != nil {
		if status, ok := res["status"].(string); ok && status == "error" {
			return fmt.Errorf("RPC DB error: %v", res["message"])
		}
		if code, ok := res["code"].(string); ok && code != "" && res["message"] != nil {
			return fmt.Errorf("RPC API error (%s): %v", code, res["message"])
		}
	}
	return nil
}

// Helpers
func resolvePmoID(schemaPmoID, defaultPmoID int) interface{} {
	if schemaPmoID > 0 {
		return schemaPmoID
	}
	if defaultPmoID > 0 {
		return defaultPmoID
	}
	return nil
}
