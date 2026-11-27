package zae

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// ReferenciaRegional é uma janela de sementeira dada por região (Sul, Centro,
// Norte), e não por zona agroecológica. Vem de fontes oficiais que não usam o
// zoneamento da FAO, então não entra no cálculo por zona: é citada como
// referência regional da safra indicada em FonteAno.
type ReferenciaRegional struct {
	Cultura          string `json:"cultura"`
	Regiao           string `json:"regiao"`
	SementeiraInicio string `json:"sementeira_inicio"`
	SementeiraFim    string `json:"sementeira_fim,omitempty"`
	Observacao       string `json:"observacao,omitempty"`
	Fonte            string `json:"fonte"`
	FonteAno         int    `json:"fonte_ano"`
	FonteURL         string `json:"fonte_url"`
}

// CarregarRegionais lê referencias_regionais.csv. Colunas:
// cultura,regiao,sementeira_inicio,sementeira_fim,observacao,fonte,ano,url.
// Toda linha precisa de fonte e URL; uma linha inválida recusa o arquivo inteiro.
func (t *Tabela) CarregarRegionais(r io.Reader) error {
	cr := csv.NewReader(r)
	cr.Comment = '#'
	cr.FieldsPerRecord = 8
	cr.TrimLeadingSpace = true
	registros, err := cr.ReadAll()
	if err != nil {
		return fmt.Errorf("referencias_regionais.csv: %w", err)
	}

	var erros []string
	var lista []ReferenciaRegional
	for i, c := range registros {
		if i == 0 {
			continue // cabeçalho
		}
		linha := i + 1
		ref := ReferenciaRegional{
			Cultura:          strings.TrimSpace(c[0]),
			Regiao:           strings.TrimSpace(c[1]),
			SementeiraInicio: strings.TrimSpace(c[2]),
			SementeiraFim:    strings.TrimSpace(c[3]),
			Observacao:       strings.TrimSpace(c[4]),
			Fonte:            strings.TrimSpace(c[5]),
			FonteURL:         strings.TrimSpace(c[7]),
		}
		ano, err := strconv.Atoi(strings.TrimSpace(c[6]))
		if err != nil {
			erros = append(erros, fmt.Sprintf("linha %d: ano inválido %q", linha, c[6]))
			continue
		}
		ref.FonteAno = ano
		if ref.Cultura == "" || ref.Regiao == "" || ref.SementeiraInicio == "" {
			erros = append(erros, fmt.Sprintf("linha %d: cultura, regiao e sementeira_inicio são obrigatórios", linha))
			continue
		}
		if ref.Fonte == "" || ref.FonteURL == "" {
			erros = append(erros, fmt.Sprintf("linha %d: fonte e url são obrigatórias", linha))
			continue
		}
		lista = append(lista, ref)
	}
	if len(erros) > 0 {
		return fmt.Errorf("referencias_regionais.csv inválido (%d erro(s)):\n%s", len(erros), strings.Join(erros, "\n"))
	}
	t.regionais = lista
	return nil
}

// Regionais devolve as referências regionais de uma cultura (comparação pela
// chave canônica, como nas janelas por zona).
func (t *Tabela) Regionais(cultura string) []ReferenciaRegional {
	k := chave(cultura)
	var out []ReferenciaRegional
	for _, r := range t.regionais {
		if chave(r.Cultura) == k {
			out = append(out, r)
		}
	}
	return out
}
