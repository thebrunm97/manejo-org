package webhook_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
)

// MockHITLController simula o Supabase para testes locais
type MockHITLController struct {
	Pending map[string]guardrails.HITLRecord
	LastRej string
}

func (m *MockHITLController) RequestApproval(ctx context.Context, rec guardrails.HITLRecord) (string, error) {
	token := "simulated-token-1234"
	rec.ID = token
	rec.Status = "waiting"
	m.Pending[token] = rec
	fmt.Printf("⏸️ [Orchestrator/HITL] Aprovação solicitada para tool: %s\n", rec.ToolName)
	return token, nil
}

func (m *MockHITLController) FindPendingByPhone(ctx context.Context, phone string) (*guardrails.HITLRecord, error) {
	for _, rec := range m.Pending {
		if rec.FromPhone == phone && rec.Status == "waiting" {
			return &rec, nil
		}
	}
	return nil, nil
}

func (m *MockHITLController) Approve(ctx context.Context, id string) (string, map[string]interface{}, error) {
	rec, exists := m.Pending[id]
	if !exists {
		return "", nil, fmt.Errorf("not found")
	}
	rec.Status = "approved"
	m.Pending[id] = rec
	return rec.ToolName, rec.ToolArgs, nil
}

func (m *MockHITLController) Reject(ctx context.Context, id string) error {
	rec, exists := m.Pending[id]
	if !exists {
		return fmt.Errorf("not found")
	}
	rec.Status = "rejected"
	m.Pending[id] = rec
	m.LastRej = id
	return nil
}

// MockWhatsApp simula envio de mensagens
type MockWhatsApp struct {
	LastSentMessage string
}
func (m *MockWhatsApp) SendMessage(to, body string) error {
	fmt.Printf("📱 [WhatsApp] Enviando para %s:\n%s\n", to, body)
	m.LastSentMessage = body
	return nil
}

func TestE2EHITLFlow(t *testing.T) {
	fmt.Println("=== INICIANDO E2E SMOKE TEST: Fluxo HITL ===")
	
	// 1. Setup
	phone := "5511999999999"
	mockHITL := &MockHITLController{Pending: make(map[string]guardrails.HITLRecord)}
	mockWP := &MockWhatsApp{}
	
	// Simular Orchestrator pausando a tool
	fmt.Println("\n[Passo 1] Orchestrator tenta invocar 'registrar_operacao_campo'")
	needsHITL, label := guardrails.RequiresHITL("registrar_operacao_campo")
	if !needsHITL {
		t.Fatal("Esperava que registrar_operacao_campo exigisse HITL")
	}
	
	toolArgs := map[string]interface{}{
		"talhao_nome": "Lote A",
		"insumo": "Composto Orgânico",
		"data_arg": "2026-04-26",
	}
	
	// Orchestrator chama o RequestApproval e pausa
	_, err := mockHITL.RequestApproval(context.Background(), guardrails.HITLRecord{
		FromPhone:   phone,
		ToolName:    "registrar_operacao_campo",
		ToolArgs:    toolArgs,
		ActionLabel: label,
	})
	if err != nil {
		t.Fatalf("Erro ao solicitar HITL: %v", err)
	}

	mockWP.SendMessage(phone, guardrails.BuildConfirmationMessage(label, toolArgs))

	// 2. Webhook recebe a string "SIM"
	fmt.Println("\n[Passo 2] Usuário responde 'SIM' via WhatsApp")
	
	// Simula a lógica interna do Webhook (handleHITLResponse)
	fmt.Println("\n[Passo 3] Webhook interceta 'SIM' e retoma a Execução da Tool")
	
	ctx := context.Background()
	rec, _ := mockHITL.FindPendingByPhone(ctx, phone)
	if rec == nil {
		t.Fatal("Nenhum registo HITL encontrado para o telefone")
	}

	resolvedTool, resolvedArgs, approveErr := mockHITL.Approve(ctx, rec.ID)
	if approveErr != nil {
		t.Fatalf("Erro na aprovação: %v", approveErr)
	}

	// Simulando a execução da ferramenta via MCP
	fmt.Printf("⚙️ [MCP Server Simulado] Invocando tool: %s com args: %v\n", resolvedTool, resolvedArgs)
	resMap := map[string]interface{}{"message": "Operação Agronômica Registrada com Sucesso"}
	
	fmt.Printf("✅ [Resultado Webhook] Tool retornou: %v\n", resMap["message"])
	mockWP.SendMessage(phone, "✅ *Operação confirmada e registrada com sucesso!*\n\n🌱 Seu caderno de campo foi atualizado.")
	
	if mockHITL.Pending["simulated-token-1234"].Status != "approved" {
		t.Errorf("Status não foi atualizado para 'approved'")
	}
	
	fmt.Println("\n=== E2E SMOKE TEST CONCLUÍDO COM SUCESSO ===")
}
