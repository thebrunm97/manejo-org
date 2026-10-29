package state

import (
	"strconv"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
)

// camposDuplicata: onde cada ferramenta de registro traz produto e quantidade.
var camposDuplicata = map[string]struct{ produto, qtd, tipo string }{
	"registrar_compra_insumo": {"produto", "quantidade_valor", "compra"},
	"registrar_colheita":      {"cultura", "quantidade", "colheita"},
	"RegistrarPlantio":        {"especies", "quantidade_valor", "plantio"},
	"registrar_plantio":       {"especies", "quantidade_valor", "plantio"},
	"registrar_manejo_campo":  {"produto_utilizado", "dosagem_valor", "aplicação"},
	"registrar_avicultura":    {"", "quantidade", "registo"}, // produto: ver chaveDuplicata
}

// chaveDuplicata extrai produto e quantidade de um pedido de registro. Sem os
// dois não há como comparar, e o registro segue direto.
func chaveDuplicata(tool string, args map[string]interface{}) (produto string, qtd float64, tipo string, ok bool) {
	if args == nil {
		return "", 0, "", false
	}
	c, existe := camposDuplicata[tool]
	if !existe {
		return "", 0, "", false
	}
	if tool == "registrar_avicultura" {
		// O produto gravado sai do evento ("Ovos", "Aves mortas").
		ev, _ := args["evento"].(string)
		vac, _ := args["vacina"].(string)
		produto = domain.ProdutoAvicultura(ev, vac)
	} else {
		produto, _ = args[c.produto].(string)
	}
	produto = strings.TrimSpace(produto)
	switch v := args[c.qtd].(type) {
	case float64:
		qtd = v
	case int:
		qtd = float64(v)
	case string:
		qtd, _ = strconv.ParseFloat(strings.Replace(strings.TrimSpace(v), ",", ".", 1), 64)
	}
	if produto == "" || qtd <= 0 {
		return "", 0, "", false
	}
	return produto, qtd, c.tipo, true
}
