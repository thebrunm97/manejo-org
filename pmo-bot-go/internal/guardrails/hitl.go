package guardrails

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
)

// HighRiskIrreversibleTools defines tools that always require producer confirmation regardless of values.
var HighRiskIrreversibleTools = map[string]string{
	"cadastrar_propriedade":        "Cadastro de Nova Propriedade",
	"criar_infraestrutura_fazenda": "Criação de Infraestrutura de Talhão e Canteiros",
	"criar_talhao":                 "Criação de Talhão",
	"criar_canteiros":              "Criação de Canteiros em Lote",
	"deletar_caderno_campo":        "Exclusão de Registro de Campo",
	"registrar_cota_cooperativa":   "Compromisso de Cota com Cooperativa",
}

// HITLRecord represents a pending approval stored in hitl_pending.
type HITLRecord struct {
	ID          string                 `json:"id,omitempty"`
	FromPhone   string                 `json:"from_phone"`
	PmoID       *int64                 `json:"pmo_id,omitempty"`
	UserID      string                 `json:"user_id,omitempty"`
	ToolName    string                 `json:"tool_name"`
	ToolArgs    map[string]interface{} `json:"tool_args"`
	ActionLabel string                 `json:"action_label"`
	Status      string                 `json:"status,omitempty"` // waiting | approved | rejected | expired
	JobID       string                 `json:"job_id,omitempty"`
}

// HITLController manages the Human-in-the-Loop approval workflow.
type HITLController struct {
	supabaseURL string
	supabaseKey string
	httpClient  *http.Client
}

// NewHITLController creates a controller backed by the hitl_pending Supabase table.
func NewHITLController(supabaseURL, supabaseKey string) *HITLController {
	return &HITLController{
		supabaseURL: supabaseURL,
		supabaseKey: supabaseKey,
		httpClient:  &http.Client{Timeout: 8 * time.Second},
	}
}

// RequiresHITL evaluates the dynamic risk-threshold policy:
// 1. Irreversible / Structural Tools -> always true
// 2. Financial operations (despesa/compra/venda) with valor_total > R$ 500 or without invoice -> true
// 3. Agricultural operations with physical quantity > 2.500 kg/L -> true
// 4. Batch operations with 2+ items -> true
// 5. Routine operations below thresholds -> false (direct execution with post-action feedback)
func RequiresHITL(toolName string, rawArgs map[string]interface{}) (bool, string) {
	// Rule 1: Irreversible / Structural Tools
	if label, ok := HighRiskIrreversibleTools[toolName]; ok {
		return true, label
	}

	// Rule 4: Batch Operations
	if toolName == "RegistrarLoteOperacoes" {
		if rawArgs != nil {
			if ops, ok := rawArgs["operacoes"].([]interface{}); ok && len(ops) >= 2 {
				return true, fmt.Sprintf("Lote de %d Operações Agrícolas", len(ops))
			}
		}
		return true, "Registro de Operações em Lote"
	}

	// Rule 1: Financial Threshold (R$ 500)
	switch toolName {
	case "registrar_despesa", "registrar_transacao":
		val := parseArgFloat(rawArgs, "valor_total", "valor")
		desc := parseArgString(rawArgs, "descricao", "item", "categoria_nome")
		if val > 500.0 {
			return true, fmt.Sprintf("Despesa Financeira de R$ %.2f (%s)", val, desc)
		}
		if desc == "" && val > 0 {
			return true, fmt.Sprintf("Despesa Financeira de R$ %.2f", val)
		}

	case "registrar_compra_insumo":
		val := parseArgFloat(rawArgs, "valor_total")
		prod := parseArgString(rawArgs, "produto")
		nf := parseArgString(rawArgs, "nota_fiscal")
		if val > 500.0 || (val > 200.0 && nf == "") {
			return true, fmt.Sprintf("Compra de %s (R$ %.2f)", prod, val)
		}

	case "registrar_venda":
		val := parseArgFloat(rawArgs, "valor_total")
		prod := parseArgString(rawArgs, "produto")
		if val > 500.0 {
			return true, fmt.Sprintf("Venda de %s (R$ %.2f)", prod, val)
		}
	}

	// Rule 2: Volume & Agronomic Scale (> 2.500 kg/L)
	switch toolName {
	case "registrar_plantio", "RegistrarPlantio", "registrar_colheita", "registrar_operacao_campo", "registrar_manejo_campo":
		qtd := parseArgFloat(rawArgs, "quantidade_valor", "quantidade", "dosagem_valor")
		unid := parseArgString(rawArgs, "quantidade_unidade", "unidade", "dosagem_unidade")
		item := parseArgString(rawArgs, "especies", "cultura", "produto", "produto_insumo", "item_area")
		if qtd > 2500.0 {
			return true, fmt.Sprintf("Operação de Grande Escala: %.2f %s de %s", qtd, unid, item)
		}
	}

	// Legacy backward compatibility for tests or unhandled tools
	if toolName == "registrar_operacao_campo" && rawArgs == nil {
		return true, "Registro de Operação de Campo"
	}

	// Routine operations under threshold -> direct execution without blocking
	return false, ""
}

func parseArgFloat(args map[string]interface{}, keys ...string) float64 {
	if args == nil {
		return 0
	}
	for _, k := range keys {
		if v, ok := args[k]; ok && v != nil {
			switch val := v.(type) {
			case float64:
				return val
			case float32:
				return float64(val)
			case int:
				return float64(val)
			case int64:
				return float64(val)
			}
		}
	}
	return 0
}

func parseArgString(args map[string]interface{}, keys ...string) string {
	if args == nil {
		return ""
	}
	for _, k := range keys {
		if v, ok := args[k]; ok && v != nil {
			if s, ok := v.(string); ok {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

// RequestApproval persists a HITL record and returns its UUID token.
// The token is used by the webhook lookup to find the pending approval.
func (h *HITLController) RequestApproval(ctx context.Context, rec HITLRecord) (token string, err error) {
	id := generateID() // reuse crypto/rand helper from factory.go
	rec.ID = id
	rec.Status = "waiting"

	payload, err := json.Marshal(rec)
	if err != nil {
		return "", fmt.Errorf("marshal hitl record: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/hitl_pending", h.supabaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	h.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("HTTP post: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase error (%d): %s", resp.StatusCode, string(body))
	}

	log.Printf("🕐 [HITL] Aprovação solicitada: token=%s tool=%s phone=%s", id, rec.ToolName, rec.FromPhone)
	return id, nil
}

// FindPendingByPhone returns the most recent 'waiting' HITL record for a phone.
// Returns nil (no error) if none is found. This is the hot path in the webhook.
func (h *HITLController) FindPendingByPhone(ctx context.Context, phone string) (*HITLRecord, error) {
	reqURL := fmt.Sprintf(
		"%s/rest/v1/hitl_pending?from_phone=eq.%s&status=eq.waiting&expires_at=gt.%s&order=created_at.desc&limit=1",
		h.supabaseURL,
		phone,
		time.Now().UTC().Format(time.RFC3339),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	h.setHeaders(req)
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP get: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase error (%d): %s", resp.StatusCode, string(body))
	}

	var records []HITLRecord
	if err := json.Unmarshal(body, &records); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	if len(records) == 0 {
		return nil, nil // No pending approval
	}

	return &records[0], nil
}

// Approve marks the HITL record as approved and returns the stored tool args.
// Returns the tool args ready for re-execution by the webhook handler.
func (h *HITLController) Approve(ctx context.Context, id string) (toolName string, toolArgs map[string]interface{}, err error) {
	rec, err := h.updateStatus(ctx, id, "approved")
	if err != nil {
		return "", nil, err
	}
	log.Printf("✅ [HITL] Aprovado: token=%s tool=%s", id, rec.ToolName)
	return rec.ToolName, rec.ToolArgs, nil
}

// Reject marks the HITL record as rejected.
func (h *HITLController) Reject(ctx context.Context, id string) error {
	rec, err := h.updateStatus(ctx, id, "rejected")
	if err != nil {
		return err
	}
	log.Printf("❌ [HITL] Rejeitado: token=%s tool=%s", id, rec.ToolName)
	return nil
}

// updateStatus performs a PATCH on the hitl_pending record and returns the full row.
func (h *HITLController) updateStatus(ctx context.Context, id, status string) (*HITLRecord, error) {
	// First fetch the record to capture tool_name and tool_args for response
	rec, err := h.fetchByID(ctx, id)
	if err != nil || rec == nil {
		return nil, fmt.Errorf("HITL record %s not found: %w", id, err)
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
	})

	reqURL := fmt.Sprintf("%s/rest/v1/hitl_pending?id=eq.%s", h.supabaseURL, id)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, reqURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	h.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase patch error (%d): %s", resp.StatusCode, string(body))
	}

	return rec, nil
}

// fetchByID retrieves a HITL record by its UUID.
func (h *HITLController) fetchByID(ctx context.Context, id string) (*HITLRecord, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/hitl_pending?id=eq.%s&limit=1", h.supabaseURL, id)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	h.setHeaders(req)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var records []HITLRecord
	if err := json.Unmarshal(body, &records); err != nil || len(records) == 0 {
		return nil, nil
	}
	return &records[0], nil
}

// setHeaders injects the Supabase auth headers on every request.
func (h *HITLController) setHeaders(req *http.Request) {
	req.Header.Set("apikey", h.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+h.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
}

// BuildConfirmationMessage returns the WhatsApp confirmation prompt for the producer.
// Kept here so the message format is owned by the guardrails package (single source).
func BuildConfirmationMessage(label string, args map[string]interface{}) string {
	details := formatArgsForHuman(args)
	return fmt.Sprintf(
		"⚠️ *Confirmação Necessária*\n\n"+
			"O assistente deseja realizar:\n*%s*\n\n"+
			"%s\n"+
			"_Responda *SIM* para confirmar ou *NÃO* para cancelar._\n"+
			"_(Esta confirmação expira em 10 minutos)_",
		label,
		details,
	)
}

// formatValueCleanly recursively formats values, rendering talhão maps in a user-friendly format.
func formatValueCleanly(val interface{}, depth int) string {
	indent := strings.Repeat("  ", depth)
	switch v := val.(type) {
	case map[string]interface{}:
		hasTalhao := false
		var talhaoNome, talhaoID, valorAlocado interface{}
		for k, valMap := range v {
			if k == "talhao_nome" || k == "talhao_id" {
				hasTalhao = true
			}
			if k == "talhao_nome" {
				talhaoNome = valMap
			} else if k == "talhao_id" {
				talhaoID = valMap
			} else if k == "valor_alocado" {
				valorAlloc := valMap
				if str, ok := valorAlloc.(string); ok && str == "" {
					valorAlocado = nil
				} else {
					valorAlocado = valorAlloc
				}
			}
		}

		if hasTalhao {
			nameStr := "Sem Nome"
			if talhaoNome != nil {
				nameStr = fmt.Sprintf("%v", talhaoNome)
			}
			idStr := ""
			if talhaoID != nil {
				idStr = fmt.Sprintf("%v", talhaoID)
			}
			var finalStr string
			if idStr != "" && idStr != "<nil>" && idStr != "0" {
				finalStr = fmt.Sprintf("• %s (ID: %s)", nameStr, idStr)
			} else {
				finalStr = fmt.Sprintf("• %s", nameStr)
			}
			if valorAlocado != nil && fmt.Sprintf("%v", valorAlocado) != "" {
				finalStr += fmt.Sprintf(": R$ %v", valorAlocado)
			}
			return finalStr
		}

		var parts []string
		for k, valMap := range v {
			parts = append(parts, fmt.Sprintf("%s%s: %s", indent, k, formatValueCleanly(valMap, depth+1)))
		}
		return "{\n" + strings.Join(parts, "\n") + "\n" + indent + "}"

	case map[interface{}]interface{}:
		hasTalhao := false
		var talhaoNome, talhaoID, valorAlocado interface{}
		for k, valMap := range v {
			kStr := fmt.Sprintf("%v", k)
			if kStr == "talhao_nome" || kStr == "talhao_id" {
				hasTalhao = true
			}
			if kStr == "talhao_nome" {
				talhaoNome = valMap
			} else if kStr == "talhao_id" {
				talhaoID = valMap
			} else if kStr == "valor_alocado" {
				valorAlloc := valMap
				if str, ok := valorAlloc.(string); ok && str == "" {
					valorAlocado = nil
				} else {
					valorAlocado = valorAlloc
				}
			}
		}

		if hasTalhao {
			nameStr := "Sem Nome"
			if talhaoNome != nil {
				nameStr = fmt.Sprintf("%v", talhaoNome)
			}
			idStr := ""
			if talhaoID != nil {
				idStr = fmt.Sprintf("%v", talhaoID)
			}
			var finalStr string
			if idStr != "" && idStr != "<nil>" && idStr != "0" {
				finalStr = fmt.Sprintf("• %s (ID: %s)", nameStr, idStr)
			} else {
				finalStr = fmt.Sprintf("• %s", nameStr)
			}
			if valorAlocado != nil && fmt.Sprintf("%v", valorAlocado) != "" {
				finalStr += fmt.Sprintf(": R$ %v", valorAlocado)
			}
			return finalStr
		}

		var parts []string
		for k, valMap := range v {
			parts = append(parts, fmt.Sprintf("%s%v: %s", indent, k, formatValueCleanly(valMap, depth+1)))
		}
		return "{\n" + strings.Join(parts, "\n") + "\n" + indent + "}"

	case []interface{}:
		var parts []string
		for _, valSlice := range v {
			parts = append(parts, formatValueCleanly(valSlice, depth))
		}
		return "\n" + strings.Join(parts, "\n")

	default:
		return fmt.Sprintf("%v", v)
	}
}

// formatArgsForHuman renders the tool args as a readable bullet list,
// filtering out system-injected fields (user_id, pmo_id, etc.).
func formatArgsForHuman(args map[string]interface{}) string {
	systemKeys := map[string]bool{
		"user_id": true, "pmo_id": true, "propriedade_id": true, "data_arg": true,
	}

	var lines []string
	for k, v := range args {
		if systemKeys[k] {
			continue
		}
		if v == nil || v == "" {
			continue
		}
		lines = append(lines, fmt.Sprintf("• *%s:* %s", k, formatValueCleanly(v, 0)))
	}

	if len(lines) == 0 {
		return "_(Sem detalhes adicionais disponíveis)_"
	}
	return strings.Join(lines, "\n")
}

// CreateOrSupersedeDraft calls public.create_or_supersede_mutation_draft RPC atomically.
func (h *HITLController) CreateOrSupersedeDraft(ctx context.Context, pmoID int64, userID, phone string, operations []domain.BatchMutationItem, summaryText string, ttlMinutes int) (draftID string, supersededID *string, err error) {
	if ttlMinutes <= 0 {
		ttlMinutes = 45
	}

	payload := map[string]interface{}{
		"p_pmo_id":       pmoID,
		"p_user_id":      userID,
		"p_from_phone":   phone,
		"p_operations":   operations,
		"p_summary_text": summaryText,
		"p_ttl_minutes":  ttlMinutes,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", nil, fmt.Errorf("marshal draft payload: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/rpc/create_or_supersede_mutation_draft", h.supabaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		return "", nil, fmt.Errorf("create request: %w", err)
	}
	h.setHeaders(req)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", nil, fmt.Errorf("supabase rpc error (%d): %s", resp.StatusCode, string(respBody))
	}

	var res struct {
		Status             string  `json:"status"`
		DraftID            string  `json:"draft_id"`
		SupersededDraftID *string `json:"superseded_draft_id"`
		Message            string  `json:"message"`
	}
	if err := json.Unmarshal(respBody, &res); err != nil {
		return "", nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if res.Status != "created" {
		return "", nil, fmt.Errorf("draft creation failed: %s", res.Message)
	}

	log.Printf("📝 [HITL] Rascunho criado: draft_id=%s superseded=%v phone=%s pmo_id=%d", res.DraftID, res.SupersededDraftID, phone, pmoID)
	return res.DraftID, res.SupersededDraftID, nil
}

// FindPendingDraft queries for the active pending draft for a phone and PMO ID.
func (h *HITLController) FindPendingDraft(ctx context.Context, phone string, pmoID int64) (*domain.MutationDraftRecord, error) {
	nowRFC := time.Now().UTC().Format(time.RFC3339)
	reqURL := fmt.Sprintf(
		"%s/rest/v1/mutation_drafts?from_phone=eq.%s&pmo_id=eq.%d&status=eq.pending&expires_at=gt.%s&order=created_at.desc&limit=1",
		h.supabaseURL,
		phone,
		pmoID,
		nowRFC,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	h.setHeaders(req)
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase query error (%d): %s", resp.StatusCode, string(body))
	}

	var records []domain.MutationDraftRecord
	if err := json.Unmarshal(body, &records); err != nil || len(records) == 0 {
		return nil, nil
	}

	return &records[0], nil
}

// CommitDraft calls public.commit_mutation_draft RPC atomically.
func (h *HITLController) CommitDraft(ctx context.Context, draftID string, userID string, pmoID int64) (domain.CommitMutationResult, error) {
	payload := map[string]interface{}{
		"p_draft_id": draftID,
		"p_user_id":  userID,
		"p_pmo_id":   pmoID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return domain.CommitMutationResult{}, fmt.Errorf("marshal commit payload: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/rpc/commit_mutation_draft", h.supabaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		return domain.CommitMutationResult{}, fmt.Errorf("create request: %w", err)
	}
	h.setHeaders(req)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return domain.CommitMutationResult{}, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return domain.CommitMutationResult{}, fmt.Errorf("supabase rpc error (%d): %s", resp.StatusCode, string(respBody))
	}

	var res domain.CommitMutationResult
	if err := json.Unmarshal(respBody, &res); err != nil {
		return domain.CommitMutationResult{}, fmt.Errorf("unmarshal commit result: %w", err)
	}

	log.Printf("🚀 [HITL] Commit executado: draft_id=%s status=%s", draftID, res.Status)
	return res, nil
}

// RejectDraft marks a mutation draft as rejected.
func (h *HITLController) RejectDraft(ctx context.Context, draftID string) error {
	payload := map[string]interface{}{
		"status":     domain.DraftStatusRejected,
		"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
	}

	body, _ := json.Marshal(payload)
	reqURL := fmt.Sprintf("%s/rest/v1/mutation_drafts?id=eq.%s", h.supabaseURL, draftID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, reqURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	h.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase patch error (%d): %s", resp.StatusCode, string(body))
	}

	log.Printf("❌ [HITL] Rascunho rejeitado: draft_id=%s", draftID)
	return nil
}

// BuildBatchConfirmationMessage builds a user-friendly Portuguese message summarizing a proposed batch of mutations.
func BuildBatchConfirmationMessage(summaryText string, operations []domain.BatchMutationItem) string {
	var sb strings.Builder
	sb.WriteString("📝 *Confirmação de Registro de Operações*\n\n")

	if summaryText != "" {
		sb.WriteString(summaryText)
		sb.WriteString("\n\n")
	}

	sb.WriteString(fmt.Sprintf("Identifiquei *%d* operação(ões) para registro:\n", len(operations)))
	for i, op := range operations {
		opLabel := op.Type
		if op.TipoOperacao != "" {
			opLabel = fmt.Sprintf("%s (%s)", op.Type, op.TipoOperacao)
		}
		sb.WriteString(fmt.Sprintf("\n*%d. %s:*\n", i+1, opLabel))
		sb.WriteString(formatArgsForHuman(op.Payload))
		sb.WriteString("\n")
	}

	sb.WriteString("\n_Responda *1* (ou *SIM*) para confirmar e gravar, ou *2* (ou *NÃO*) para cancelar._\n")
	sb.WriteString("_(Esta confirmação expira em 45 minutos)_")
	return sb.String()
}

