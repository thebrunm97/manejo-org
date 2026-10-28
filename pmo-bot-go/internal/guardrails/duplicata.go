package guardrails

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// JanelaDuplicata: registro igual (mesmo produto e quantidade) dentro deste
// intervalo vira pergunta antes de gravar. Reenvio por rede ruim chega em
// minutos; duas compras iguais de verdade no mesmo dia são raras, e a
// pergunta resolve as duas.
const JanelaDuplicata = 2 * time.Hour

// fusoDoProdutor: o sistema roda no fuso do Brasil; para +258 a hora vai no
// de Moçambique (UTC+2, sem horário de verão).
func fusoDoProdutor(phone string, sistema *time.Location) *time.Location {
	if strings.HasPrefix(strings.TrimPrefix(phone, "+"), "258") {
		return time.FixedZone("CAT", 2*3600)
	}
	return sistema
}

// TextoDuplicata avisa que um registro igual já foi anotado e quando.
func TextoDuplicata(phone, produto string, qtd float64, tipo string, quando, agora time.Time) string {
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
