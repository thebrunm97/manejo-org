package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// ToolRequest encapsulates the context and payload of a tool execution.
type ToolRequest struct {
	ToolName    string
	ToolID      string
	RawArgs     map[string]interface{}
	ParsedArgs  any
	Provider    string
	TraceEvents *[]TraceEvent
	History     *[]llm.MensagemAgnostica
}

// ToolResponse encapsulates the execution outcome.
type ToolResponse struct {
	Result       interface{}
	IsSynthetic  bool
	ErrorMessage string
}

// ToolHandler processes a tool request.
type ToolHandler interface {
	Handle(ctx context.Context, req ToolRequest) (ToolResponse, error)
}

type ToolHandlerFunc func(ctx context.Context, req ToolRequest) (ToolResponse, error)

func (f ToolHandlerFunc) Handle(ctx context.Context, req ToolRequest) (ToolResponse, error) {
	return f(ctx, req)
}

// ToolInterceptor intercepts the execution of a tool request.
type ToolInterceptor interface {
	Intercept(ctx context.Context, req ToolRequest, next ToolHandler) (ToolResponse, error)
}

// InterceptorChain drives the execution of interceptors.
type InterceptorChain struct {
	interceptors []ToolInterceptor
	finalHandler ToolHandler
}

// NewInterceptorChain creates a new execution pipeline.
func NewInterceptorChain(final ToolHandler, interceptors ...ToolInterceptor) *InterceptorChain {
	return &InterceptorChain{
		interceptors: interceptors,
		finalHandler: final,
	}
}

// Execute triggers the pipeline.
func (c *InterceptorChain) Execute(ctx context.Context, req ToolRequest) (ToolResponse, error) {
	var next ToolHandler = c.finalHandler
	for i := len(c.interceptors) - 1; i >= 0; i-- {
		interceptor := c.interceptors[i]
		currentNext := next
		next = ToolHandlerFunc(func(ctx context.Context, r ToolRequest) (ToolResponse, error) {
			return interceptor.Intercept(ctx, r, currentNext)
		})
	}
	return next.Handle(ctx, req)
}

// ---------------------------------------------------------------------------
// 1. ContextInjectorMiddleware
// ---------------------------------------------------------------------------

type ContextInjectorMiddleware struct {
	Profile *supabase.Profile
}

func (m *ContextInjectorMiddleware) Intercept(ctx context.Context, req ToolRequest, next ToolHandler) (ToolResponse, error) {
	if req.RawArgs == nil {
		req.RawArgs = make(map[string]interface{})
	}

	req.RawArgs["user_id"] = m.Profile.ID
	req.RawArgs["pmo_id"] = m.Profile.PmoAtivoID
	req.RawArgs["propriedade_id"] = m.Profile.PropriedadeAtivaID

	// Segurança
	req.RawArgs["_internal_user_id"] = m.Profile.ID
	req.RawArgs["_internal_pmo_id"] = m.Profile.PmoAtivoID

	if rawPayloadID, ok := ctx.Value("raw_payload_id").(string); ok && rawPayloadID != "" {
		req.RawArgs["raw_payload_id"] = rawPayloadID
	}

	if req.ToolName == "ConsultarLeiOrganica_RAG" {
		if q, ok := req.RawArgs["query"].(string); !ok || strings.TrimSpace(q) == "" {
			log.Printf("⚠️ [ToolPipeline] Argumento 'query' faltando/malformado no ToolCall. Injetando fallback.")
			req.RawArgs["query"] = "regras gerais lei organica agricultura"
		}
	}

	return next.Handle(ctx, req)
}

// ---------------------------------------------------------------------------
// 2. HITLMiddleware
// ---------------------------------------------------------------------------

type HITLMiddleware struct {
	Controller    guardrails.HITLHandler
	Phone         string
	WhatsApp      ports.MessageSender
	Profile       *supabase.Profile
	HitlRequested map[string]bool
}

func (m *HITLMiddleware) Intercept(ctx context.Context, req ToolRequest, next ToolHandler) (ToolResponse, error) {
	if m.Controller == nil {
		return next.Handle(ctx, req)
	}

	if needsHITL, label := guardrails.RequiresHITL(req.ToolName); needsHITL {
		fp := hitlFingerprint(req.ToolName, req.RawArgs)
		if m.HitlRequested[fp] {
			log.Printf("🔄 [HITL-DEDUP] Confirmação já solicitada para tool=%s (fp=%s) — reutilizando synthetic result", req.ToolName, fp)
			synthResult := map[string]interface{}{
				"status":  "awaiting_confirmation",
				"message": fmt.Sprintf("Ação '%s' já aguarda confirmação do produtor via WhatsApp.", label),
			}
			synthJSON, _ := json.Marshal(synthResult)
			*req.History = append(*req.History, llm.MensagemAgnostica{
				Role:     llm.PapelTool,
				Content:  string(synthJSON),
				ToolID:   req.ToolID,
				ToolName: req.ToolName,
			})
			return ToolResponse{Result: synthResult, IsSynthetic: true}, fmt.Errorf("hitl_pending")
		}

		token, hitlErr := m.Controller.RequestApproval(ctx, guardrails.HITLRecord{
			FromPhone:   m.Phone,
			PmoID:       &m.Profile.PmoAtivoID,
			UserID:      m.Profile.ID,
			ToolName:    req.ToolName,
			ToolArgs:    req.RawArgs,
			ActionLabel: label,
		})
		if hitlErr == nil {
			m.HitlRequested[fp] = true
			log.Printf("⏸️ [HITL] Aprovação solicitada — tool=%s token=%s phone=%s", req.ToolName, token, m.Phone)
			if m.WhatsApp != nil {
				confirmMsg := guardrails.BuildConfirmationMessage(label, req.RawArgs)
				buttons := []map[string]string{
					{"type": "reply", "displayText": "SIM", "id": "SIM"},
					{"type": "reply", "displayText": "NÃO", "id": "NÃO"},
				}
				if err := m.WhatsApp.SendButton(m.Phone, "Confirmação Necessária", confirmMsg, "Esta confirmação expira em 10 minutos", buttons); err != nil {
					log.Printf("⚠️ [HITL] Falha ao enviar botões de confirmação: %v", err)
				}
			}

			synthResult := map[string]interface{}{
				"status":  "awaiting_confirmation",
				"message": fmt.Sprintf("Ação '%s' aguarda confirmação do produtor via WhatsApp.", label),
				"token":   token,
			}
			synthJSON, _ := json.Marshal(synthResult)
			*req.History = append(*req.History, llm.MensagemAgnostica{
				Role:     llm.PapelTool,
				Content:  string(synthJSON),
				ToolID:   req.ToolID,
				ToolName: req.ToolName,
			})
			*req.TraceEvents = append(*req.TraceEvents, TraceEvent{
				Action: "hitl_requested",
				Tool:   req.ToolName,
				Output: synthResult,
				Time:   time.Now(),
			})
			return ToolResponse{Result: synthResult, IsSynthetic: true}, fmt.Errorf("hitl_pending")
		}
		log.Printf("⚠️ [HITL] Falha ao solicitar aprovação — executando ferramenta diretamente: %v", hitlErr)
	}

	return next.Handle(ctx, req)
}

// ---------------------------------------------------------------------------
// 3. BusinessGuardrailMiddleware
// ---------------------------------------------------------------------------

type BusinessGuardrailMiddleware struct {
	Evaluator guardrails.BusinessEvaluator
	Profile   *supabase.Profile
	SB        *supabase.Client
}

func (m *BusinessGuardrailMiddleware) Intercept(ctx context.Context, req ToolRequest, next ToolHandler) (ToolResponse, error) {
	if m.Evaluator == nil || req.ParsedArgs == nil {
		return next.Handle(ctx, req)
	}

	startEvaluator := time.Now()
	evalCtx := guardrails.EvaluationContext{
		PmoID:         m.Profile.PmoAtivoID,
		PropriedadeID: m.Profile.PropriedadeAtivaID,
		UserID:        m.Profile.ID,
	}

	var evalErr error

	// Polymorphic Type Assertion
	if finOp, ok := req.ParsedArgs.(domain.FinancialOperation); ok {
		evalErr = m.Evaluator.EvaluateTransaction(ctx, evalCtx, guardrails.TransactionPayload{
			ValorTotal: finOp.GetValorTotal(),
			Produto:    finOp.GetProduto(),
		})
	} else if agriOp, ok := req.ParsedArgs.(domain.AgriculturalOperation); ok {
		evalErr = m.Evaluator.EvaluateManejo(ctx, evalCtx, guardrails.ManejoPayload{
			Quantidade:    agriOp.GetQuantidade(),
			Unidade:       agriOp.GetUnidade(),
			Produto:       agriOp.GetProduto(),
			TalhaoNome:    agriOp.GetTalhao(),
			TipoAtividade: agriOp.GetTipoAtividade(),
		})
	}

	log.Printf("⏱️ [TRACING] Sub-passo: Business Evaluator: %v", time.Since(startEvaluator))

	if evalErr != nil {
		log.Printf("🚨 [Guardrail-Business] Payload REPROVADO para a ferramenta %s: %v", req.ToolName, evalErr)
		if rawPayloadID, ok := ctx.Value("raw_payload_id").(string); ok && rawPayloadID != "" {
			_ = m.SB.UpdateRawPayloadStatus(ctx, rawPayloadID, "FAILED", evalErr.Error())
		}
		*req.History = append(*req.History, llm.MensagemAgnostica{
			Role:    llm.PapelAssistant,
			Content: "Bloqueio do Guardrail: " + evalErr.Error(),
		})
		return ToolResponse{ErrorMessage: evalErr.Error(), IsSynthetic: true}, evalErr
	}

	return next.Handle(ctx, req)
}

// ---------------------------------------------------------------------------
// 4. MCPExecutionHandler
// ---------------------------------------------------------------------------

type MCPExecutionHandler struct {
	MCPServer *mcp.Server
	Guard     *mcp.LoopGuard
}

func (h *MCPExecutionHandler) Handle(ctx context.Context, req ToolRequest) (ToolResponse, error) {
	result, err := h.MCPServer.CallToolWithGuard(h.Guard, req.ToolName, req.RawArgs)
	if err != nil {
		log.Printf("⚠️ [ToolPipeline] Erro na ferramenta %s: %v", req.ToolName, err)
		return ToolResponse{Result: map[string]interface{}{"error": err.Error()}}, nil
	}
	return ToolResponse{Result: result}, nil
}
