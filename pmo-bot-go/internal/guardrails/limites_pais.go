package guardrails

import "strings"

// limitesPais são os limiares financeiros de cada país, na moeda local.
// Não há câmbio: cada linha é política escrita à mão, ancorada no peso do
// valor para o produtor (proporção do salário mínimo), não na cotação.
type limitesPais struct {
	ConfirmarSemNota float64 // compra sem nota/factura acima disto pede SIM
	Confirmar        float64 // compra, despesa ou venda acima disto pede SIM
	Bloquear         float64 // acima disto é provável erro de digitação
}

var (
	// Brasil (R$): salário mínimo ~R$ 1.500.
	limitesBR = limitesPais{ConfirmarSemNota: 200, Confirmar: 500, Bloquear: DefaultLimiteTransacao}
	// Moçambique (MT): salário mínimo ~7.000 MT; mesmas proporções do BR,
	// arredondadas (decisão de produto, 2026-10-11).
	limitesMZ = limitesPais{ConfirmarSemNota: 1000, Confirmar: 2500, Bloquear: 250000}
)

func limitesPara(phone string) limitesPais {
	if strings.HasPrefix(strings.TrimPrefix(phone, "+"), "258") {
		return limitesMZ
	}
	return limitesBR
}
