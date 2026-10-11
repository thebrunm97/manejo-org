package utils

import (
	"os"
	"strconv"
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

// MoedaSimboloPara devolve a moeda pelo país do telefone: Moçambique (+258)
// fala em meticais; o resto segue MoedaSimbolo().
func MoedaSimboloPara(phone string) string {
	if strings.HasPrefix(strings.TrimPrefix(phone, "+"), "258") {
		return "MT"
	}
	return MoedaSimbolo()
}

// FormatarValor escreve dinheiro no formato lusófono: 1.200,50.
func FormatarValor(v float64) string {
	neg := v < 0
	if neg {
		v = -v
	}
	s := strconv.FormatFloat(v, 'f', 2, 64)
	inteiro, dec := s[:len(s)-3], s[len(s)-2:]
	var b strings.Builder
	for i, c := range inteiro {
		if i > 0 && (len(inteiro)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(c)
	}
	out := b.String() + "," + dec
	if neg {
		out = "-" + out
	}
	return out
}
