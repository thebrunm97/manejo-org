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
)

// HighRiskTools lists MCP tool names that require producer confirmation before execution.
// Any tool that performs irreversible mutations on the database should be listed here.
var HighRiskTools = map[string]string{
	"registrar_operacao_campo":  "Registro de Operação de Campo",
	"registrar_compra_insumo":   "Registro de Compra de Insumo",
	"registrar_atividade_pmo":   "Registro de Atividade no PMO",
	"registrar_transacao":       "Registro de Transação Financeira",
	"registrar_plantio":         "Registro de Plantio",
	"deletar_caderno_campo":     "Exclusão de Registro de Campo",
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
// It intercepts high-risk tool calls, persists the context, and
// provides lookup+resolution methods for the webhook SIM/NÃO handler.
//
// Lifecycle:
//
//	Orchestrator calls RequiresHITL() → true
//	Orchestrator calls RequestApproval() → persists record, returns token
//	Producer receives WhatsApp prompt and replies SIM or NÃO
//	Webhook calls FindPendingByPhone() → gets record
//	Webhook calls Approve() or Reject() → updates status, returns tool_args to execute
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

// RequiresHITL returns true and a human-readable action label if the tool
// is in the high-risk list and requires producer confirmation.
func RequiresHITL(toolName string) (bool, string) {
	label, ok := HighRiskTools[toolName]
	return ok, label
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
