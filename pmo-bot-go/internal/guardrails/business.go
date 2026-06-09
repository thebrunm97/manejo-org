package guardrails

import (
	"context"
	"fmt"
	"log"
	"time"
)

// Constantes padrão de limites compiladas no código
const (
	DefaultLimiteTransacao = 50000.00 // R$ 50.000,00
	DefaultLimiteManejo    = 5000.00  // 5.000 kg ou Litros
)

// EvaluationContext encapsula os metadados contextuais do produtor e da fazenda
type EvaluationContext struct {
	PmoID         int64
	PropriedadeID int64
	UserID        string
}

// TransactionPayload representa os dados financeiros de compras, despesas ou receitas
type TransactionPayload struct {
	ValorTotal float64
	Produto    string
	Talhoes    []string
}

// ManejoPayload representa as operações agrícolas realizadas no campo
type ManejoPayload struct {
	Quantidade    float64
	Unidade       string
	Produto       string
	TalhaoNome    string
	TipoAtividade string
}

// BusinessEvaluator define o contrato determinístico para validação pré-escrita no banco
type BusinessEvaluator interface {
	EvaluateTransaction(ctx context.Context, evalCtx EvaluationContext, payload TransactionPayload) error
	EvaluateManejo(ctx context.Context, evalCtx EvaluationContext, payload ManejoPayload) error
}

// LimitesProvider define o contrato para obter os limites customizados do banco de dados
type LimitesProvider interface {
	GetLimitesSeguranca(ctx context.Context, propriedadeID, pmoID int64) (limiteTransacao float64, limiteManejo float64, err error)
}

// DeterministicEvaluator implementa as regras determinísticas com fallback
type DeterministicEvaluator struct {
	Provider LimitesProvider
}

// NewDeterministicEvaluator cria uma nova instância do avaliador
func NewDeterministicEvaluator(provider LimitesProvider) *DeterministicEvaluator {
	return &DeterministicEvaluator{
		Provider: provider,
	}
}

// EvaluateTransaction valida transações financeiras
func (e *DeterministicEvaluator) EvaluateTransaction(ctx context.Context, evalCtx EvaluationContext, payload TransactionPayload) error {
	limiteTransacao := DefaultLimiteTransacao

	// Buscar limites customizados com timeout curto (2 segundos)
	if e.Provider != nil && evalCtx.PropriedadeID > 0 {
		queryCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		customLimTrans, _, err := e.Provider.GetLimitesSeguranca(queryCtx, evalCtx.PropriedadeID, evalCtx.PmoID)
		if err != nil {
			log.Printf("⚠️ [Guardrail] Falha ao buscar limites customizados (Transaction Fallback para Default): %v", err)
		} else if customLimTrans > 0 {
			limiteTransacao = customLimTrans
		}
	}

	// Regra 1: Limite de Valor
	if payload.ValorTotal > limiteTransacao {
		return fmt.Errorf("Atenção: O valor de R$ %.2f excede o limite de segurança de R$ %.2f configurado para a sua propriedade. Por favor, reenvie a operação com o valor correto.", payload.ValorTotal, limiteTransacao)
	}

	return nil
}

// EvaluateManejo valida manejos de campo
func (e *DeterministicEvaluator) EvaluateManejo(ctx context.Context, evalCtx EvaluationContext, payload ManejoPayload) error {
	limiteManejo := DefaultLimiteManejo

	// Buscar limites customizados com timeout curto (2 segundos)
	if e.Provider != nil && evalCtx.PropriedadeID > 0 {
		queryCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		_, customLimManejo, err := e.Provider.GetLimitesSeguranca(queryCtx, evalCtx.PropriedadeID, evalCtx.PmoID)
		if err != nil {
			log.Printf("⚠️ [Guardrail] Falha ao buscar limites customizados (Manejo Fallback para Default): %v", err)
		} else if customLimManejo > 0 {
			limiteManejo = customLimManejo
		}
	}

	// Regra 2: Obrigatoriedade estrita de Talhão
	if payload.TalhaoNome == "" {
		return fmt.Errorf("Atenção: É obrigatório especificar o talhão onde a operação de %s foi realizada. Por favor, reenvie o registro identificando o talhão correto.", payload.TipoAtividade)
	}

	// Regra 3: Limite de Quantidade
	if payload.Quantidade > limiteManejo {
		return fmt.Errorf("Atenção: A quantidade de %.2f %s excede o limite de segurança de %.2f %s configurado para a sua propriedade. Por favor, reenvie a operação com o valor correto.", payload.Quantidade, payload.Unidade, limiteManejo, payload.Unidade)
	}

	return nil
}
