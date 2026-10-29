package domain

import "strings"

// EventoAve descreve como um evento do lote de aves vira linha no caderno de
// campo (tipo_atividade 'Avicultura'): o texto de `produto` e a unidade.
type EventoAve struct {
	Produto string
	Unidade string
	// Saida: o evento tira aves do lote (morte, abate, venda/consumo).
	Saida bool
}

// EventosAvicultura: os eventos que o bot sabe registar. A quantidade é de
// aves, menos em postura (ovos) e pesagem (peso médio em kg).
var EventosAvicultura = map[string]EventoAve{
	"entrada":     {Produto: "Entrada de aves", Unidade: "aves"},
	"postura":     {Produto: "Ovos", Unidade: "ovos"},
	"mortalidade": {Produto: "Aves mortas", Unidade: "aves", Saida: true},
	"vacinacao":   {Produto: "Vacina", Unidade: "aves"},
	"pesagem":     {Produto: "Pesagem", Unidade: "kg"},
	"abate":       {Produto: "Aves abatidas", Unidade: "aves", Saida: true},
	"saida":       {Produto: "Saída de aves", Unidade: "aves", Saida: true},
}

// ProdutoAvicultura devolve o texto gravado em caderno_campo.produto. Na
// vacinação leva o nome da vacina ("Vacina Newcastle").
func ProdutoAvicultura(evento, vacina string) string {
	ev, ok := EventosAvicultura[evento]
	if !ok {
		return ""
	}
	if v := strings.TrimSpace(vacina); evento == "vacinacao" && v != "" {
		return ev.Produto + " " + v
	}
	return ev.Produto
}
