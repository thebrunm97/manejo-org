package state

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// janelaDuplicata: registro igual dentro deste intervalo vira pergunta antes
// de gravar. Reenvio por rede ruim chega em minutos; duas compras iguais de
// verdade no mesmo dia são raras, e a pergunta resolve as duas.
const janelaDuplicata = 2 * time.Hour

// camposDuplicata: onde cada ferramenta de registro traz produto e quantidade.
var camposDuplicata = map[string]struct{ produto, qtd, tipo string }{
	"registrar_compra_insumo": {"produto", "quantidade_valor", "compra"},
	"registrar_colheita":      {"cultura", "quantidade", "colheita"},
	"RegistrarPlantio":        {"especies", "quantidade_valor", "plantio"},
	"registrar_plantio":       {"especies", "quantidade_valor", "plantio"},
	"registrar_manejo_campo":  {"produto_utilizado", "dosagem_valor", "aplicação"},
}

// chaveDuplicata extrai produto e quantidade de um pedido de registro. Sem os
// dois não há como comparar, e o registro segue direto.
func chaveDuplicata(tool string, args map[string]interface{}) (produto string, qtd float64, tipo string, ok bool) {
	c, existe := camposDuplicata[tool]
	if !existe || args == nil {
		return "", 0, "", false
	}
	produto, _ = args[c.produto].(string)
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

// fusoDoProdutor: o sistema roda no fuso do Brasil; para +258 a hora vai no
// de Moçambique (UTC+2, sem horário de verão).
func fusoDoProdutor(phone string, sistema *time.Location) *time.Location {
	if strings.HasPrefix(strings.TrimPrefix(phone, "+"), "258") {
		return time.FixedZone("CAT", 2*3600)
	}
	return sistema
}

func textoDuplicata(phone, produto string, qtd float64, tipo string, quando, agora time.Time) string {
	mz := strings.HasPrefix(strings.TrimPrefix(phone, "+"), "258")
	quando = quando.In(fusoDoProdutor(phone, agora.Location()))
	dia := "hoje"
	if quando.Format("2006-01-02") != agora.In(quando.Location()).Format("2006-01-02") {
		dia = "ontem"
	}
	n := strings.Replace(strconv.FormatFloat(qtd, 'f', -1, 64), ".", ",", 1)
	repetido := "registro repetido"
	if mz {
		repetido = "registo repetido"
	}
	return fmt.Sprintf("⚠️ Já anotei %s de %s (%s) %s às %s. Se é outra, confirme; se é %s, cancele para não ficar em dobro.",
		tipo, produto, n, dia, quando.Format("15:04"), repetido)
}
