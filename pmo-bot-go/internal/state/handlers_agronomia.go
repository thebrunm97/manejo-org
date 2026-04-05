package state

import (
	"context"
	"fmt"

	"github.com/google/generative-ai-go/genai"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// executeCalcularAdubacao extrai os argumentos da chamada da função IA e aciona o Motor Agronômico no Supabase.
func executeCalcularAdubacao(ctx context.Context, db *supabase.Client, funcCall *genai.FunctionCall) (*genai.FunctionResponse, error) {
	// Lógica de Extração Segura dos Argumentos
	var cultura string
	var meta float64
	var aduboNome string

	if val, ok := funcCall.Args["cultura"]; ok {
		if s, ok := val.(string); ok {
			cultura = s
		}
	}

	if val, ok := funcCall.Args["meta_produtividade"]; ok {
		// Use the internal parseToFloat helper for robust conversion
		meta = parseToFloat(val)
	}

	if val, ok := funcCall.Args["adubo_base_nome"]; ok {
		if s, ok := val.(string); ok {
			aduboNome = s
		}
	}

	// Validação básica de obrigatoriedade
	if cultura == "" || meta <= 0 || aduboNome == "" {
		return nil, fmt.Errorf("argumentos insuficientes para cálculo: cultura=%s, meta=%v, adubo=%s", cultura, meta, aduboNome)
	}

	// Chamada ao Client Supabase (Passo 2)
	res, err := db.CalcularBalancoNutricional(ctx, cultura, meta, aduboNome)
	if err != nil {
		return nil, fmt.Errorf("erro no motor agronômico: %w", err)
	}

	// Retorno estruturado exigido pelo Gemini
	return &genai.FunctionResponse{
		Name:     "calcular_recomendacao_adubacao",
		Response: res,
	}, nil
}
