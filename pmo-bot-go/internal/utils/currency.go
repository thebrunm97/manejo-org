package utils

import (
	"os"
	"strings"
)

// MoedaSimbolo devolve o símbolo de moeda usado nas respostas do bot e nas
// mensagens de guardrail. Configurável via CURRENCY_SYMBOL, com "R$" como
// padrão — zero mudança de comportamento em produção até a env ser setada.
//
// Existe para internacionalização (ex.: expansão para Moçambique, Metical
// "MT"): antes desta função, o símbolo estava hardcoded em 6 arquivos
// diferentes (tools_financeiro.go, handlers_financeiro.go, tools_producao.go,
// hitl.go, tools_registry.go, business.go). Trocar de moeda hoje é só essa
// env var. Quando o produto precisar de moeda por propriedade/conta (decisão
// de produto ainda pendente), este é o único ponto que muda para ler de lá
// em vez do ambiente — os chamadores continuam iguais.
func MoedaSimbolo() string {
	if v := strings.TrimSpace(os.Getenv("CURRENCY_SYMBOL")); v != "" {
		return v
	}
	return "R$"
}
