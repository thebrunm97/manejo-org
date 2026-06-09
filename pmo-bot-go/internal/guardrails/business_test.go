package guardrails

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type MockLimitesProvider struct {
	LimiteTransacao float64
	LimiteManejo    float64
	Err             error
	Called          bool
}

func (m *MockLimitesProvider) GetLimitesSeguranca(ctx context.Context, propriedadeID, pmoID int64) (float64, float64, error) {
	m.Called = true
	if m.Err != nil {
		return 0, 0, m.Err
	}
	return m.LimiteTransacao, m.LimiteManejo, nil
}

func TestDeterministicEvaluator_EvaluateTransaction(t *testing.T) {
	evalCtx := EvaluationContext{
		PropriedadeID: 123,
		PmoID:         456,
		UserID:        "user-789",
	}

	t.Run("Sucesso - Transação dentro do limite padrão", func(t *testing.T) {
		evaluator := NewDeterministicEvaluator(nil)
		payload := TransactionPayload{
			ValorTotal: 1000.0,
			Produto:    "Adubo",
			Talhoes:    []string{"Talhão A"},
		}

		err := evaluator.EvaluateTransaction(context.Background(), evalCtx, payload)
		if err != nil {
			t.Fatalf("esperava sucesso, mas obteve erro: %v", err)
		}
	})

	t.Run("Falha - Transação excede o limite padrão", func(t *testing.T) {
		evaluator := NewDeterministicEvaluator(nil)
		payload := TransactionPayload{
			ValorTotal: 50001.0, // Acima de 50.000,00
			Produto:    "Trator Novo",
		}

		err := evaluator.EvaluateTransaction(context.Background(), evalCtx, payload)
		if err == nil {
			t.Fatal("esperava erro por exceder o limite, mas obteve sucesso")
		}

		if !strings.Contains(err.Error(), "excede o limite de segurança") {
			t.Errorf("mensagem de erro inesperada: %v", err)
		}
	})

	t.Run("Sucesso - Limite customizado (override) maior", func(t *testing.T) {
		mockProvider := &MockLimitesProvider{
			LimiteTransacao: 100000.0,
		}
		evaluator := NewDeterministicEvaluator(mockProvider)
		payload := TransactionPayload{
			ValorTotal: 75000.0, // Acima do default (50k), mas abaixo do custom (100k)
			Produto:    "Implemento",
		}

		err := evaluator.EvaluateTransaction(context.Background(), evalCtx, payload)
		if err != nil {
			t.Fatalf("esperava sucesso devido ao limite customizado, mas obteve erro: %v", err)
		}

		if !mockProvider.Called {
			t.Error("esperava que o provedor de limites tivesse sido consultado")
		}
	})

	t.Run("Falha - Limite customizado (override) menor", func(t *testing.T) {
		mockProvider := &MockLimitesProvider{
			LimiteTransacao: 10000.0,
		}
		evaluator := NewDeterministicEvaluator(mockProvider)
		payload := TransactionPayload{
			ValorTotal: 15000.0, // Abaixo do default (50k), mas acima do custom (10k)
			Produto:    "Adubo",
		}

		err := evaluator.EvaluateTransaction(context.Background(), evalCtx, payload)
		if err == nil {
			t.Fatal("esperava erro pois excedeu o limite customizado de 10k")
		}
	})

	t.Run("Fallback - Erro do banco aplica limite padrão", func(t *testing.T) {
		mockProvider := &MockLimitesProvider{
			Err: errors.New("banco indisponível"),
		}
		evaluator := NewDeterministicEvaluator(mockProvider)

		// 45.000,00 está dentro do limite padrão (50k)
		payload := TransactionPayload{
			ValorTotal: 45000.0,
		}

		err := evaluator.EvaluateTransaction(context.Background(), evalCtx, payload)
		if err != nil {
			t.Fatalf("esperava que o fallback aplicasse o limite padrão e permitisse, mas obteve erro: %v", err)
		}
	})

	t.Run("Sucesso - Transação financeira com talhão nulo/vazio", func(t *testing.T) {
		evaluator := NewDeterministicEvaluator(nil)
		payload := TransactionPayload{
			ValorTotal: 500.0,
			Produto:    "Adubo Geral",
			Talhoes:    nil, // Sem talhão
		}

		err := evaluator.EvaluateTransaction(context.Background(), evalCtx, payload)
		if err != nil {
			t.Fatalf("esperava sucesso pois talhão é opcional em transações, mas obteve erro: %v", err)
		}
	})
}

func TestDeterministicEvaluator_EvaluateManejo(t *testing.T) {
	evalCtx := EvaluationContext{
		PropriedadeID: 123,
		PmoID:         456,
		UserID:        "user-789",
	}

	t.Run("Sucesso - Quantidade dentro do limite padrão", func(t *testing.T) {
		evaluator := NewDeterministicEvaluator(nil)
		payload := ManejoPayload{
			Quantidade:    3000.0,
			Unidade:       "kg",
			Produto:       "Fertilizante",
			TalhaoNome:    "Talhão Norte",
			TipoAtividade: "Adubação",
		}

		err := evaluator.EvaluateManejo(context.Background(), evalCtx, payload)
		if err != nil {
			t.Fatalf("esperava sucesso, mas obteve erro: %v", err)
		}
	})

	t.Run("Falha - Quantidade excede o limite padrão", func(t *testing.T) {
		evaluator := NewDeterministicEvaluator(nil)
		payload := ManejoPayload{
			Quantidade:    6000.0, // Acima de 5.000
			Unidade:       "kg",
			Produto:       "Calcário",
			TalhaoNome:    "Talhão Norte",
			TipoAtividade: "Calagem",
		}

		err := evaluator.EvaluateManejo(context.Background(), evalCtx, payload)
		if err == nil {
			t.Fatal("esperava erro por quantidade abusiva, mas obteve sucesso")
		}

		if !strings.Contains(err.Error(), "excede o limite de segurança") {
			t.Errorf("mensagem de erro inesperada: %v", err)
		}
	})

	t.Run("Falha - Talhão obrigatório ausente", func(t *testing.T) {
		evaluator := NewDeterministicEvaluator(nil)
		payload := ManejoPayload{
			Quantidade:    100.0,
			Unidade:       "L",
			Produto:       "Herbicida",
			TalhaoNome:    "", // Nulo
			TipoAtividade: "Aplicação",
		}

		err := evaluator.EvaluateManejo(context.Background(), evalCtx, payload)
		if err == nil {
			t.Fatal("esperava erro por falta de talhão, mas obteve sucesso")
		}

		if !strings.Contains(err.Error(), "obrigatório especificar o talhão") {
			t.Errorf("mensagem de erro inesperada: %v", err)
		}
	})

	t.Run("Sucesso - Override customizado maior", func(t *testing.T) {
		mockProvider := &MockLimitesProvider{
			LimiteManejo: 10000.0,
		}
		evaluator := NewDeterministicEvaluator(mockProvider)
		payload := ManejoPayload{
			Quantidade:    7500.0, // Acima de 5k (default), mas abaixo de 10k (custom)
			Unidade:       "L",
			Produto:       "Água",
			TalhaoNome:    "Talhão Sul",
			TipoAtividade: "Irrigação",
		}

		err := evaluator.EvaluateManejo(context.Background(), evalCtx, payload)
		if err != nil {
			t.Fatalf("esperava sucesso pelo override do limite, mas obteve erro: %v", err)
		}
	})

	t.Run("Fallback - Erro do banco aplica limite padrão", func(t *testing.T) {
		mockProvider := &MockLimitesProvider{
			Err: errors.New("timeout"),
		}
		evaluator := NewDeterministicEvaluator(mockProvider)
		payload := ManejoPayload{
			Quantidade:    4000.0, // Dentro do limite padrão
			Unidade:       "kg",
			Produto:       "Composto",
			TalhaoNome:    "Talhão A",
			TipoAtividade: "Adubação",
		}

		err := evaluator.EvaluateManejo(context.Background(), evalCtx, payload)
		if err != nil {
			t.Fatalf("esperava sucesso com limite padrão no fallback, mas obteve erro: %v", err)
		}
	})
}
