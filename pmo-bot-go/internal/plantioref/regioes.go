package plantioref

import "strings"

// Regiao é uma macrorregião do IBGE. A literatura de hortaliças da Embrapa é
// organizada por região, não por município — ao contrário do ZARC, que zoneia
// município a município. Essa diferença de escala é real e o produtor precisa
// vê-la na resposta, por isso ela sobe até o LLM no campo "abrangencia".
type Regiao string

const (
	RegiaoNorte       Regiao = "norte"
	RegiaoNordeste    Regiao = "nordeste"
	RegiaoCentroOeste Regiao = "centro_oeste"
	RegiaoSudeste     Regiao = "sudeste"
	RegiaoSul         Regiao = "sul"

	// RegiaoBrasil é o último recurso, aceito apenas para cultivo protegido:
	// em ambiente controlado a região realmente perde relevância. Uma janela
	// "nacional" de campo aberto seria agronomicamente vazia, e a validação do
	// CSV recusa essa combinação.
	RegiaoBrasil Regiao = "brasil"
)

// regioesValidas existe para a validação do CSV não depender da ordem de um slice.
var regioesValidas = map[Regiao]bool{
	RegiaoNorte: true, RegiaoNordeste: true, RegiaoCentroOeste: true,
	RegiaoSudeste: true, RegiaoSul: true, RegiaoBrasil: true,
}

// rotulos traduz a região para a forma que vai ao produtor. O CSV usa
// "centro_oeste" porque é chave; a resposta diz "Centro-Oeste".
var rotulos = map[Regiao]string{
	RegiaoNorte: "Norte", RegiaoNordeste: "Nordeste", RegiaoCentroOeste: "Centro-Oeste",
	RegiaoSudeste: "Sudeste", RegiaoSul: "Sul", RegiaoBrasil: "Brasil",
}

// regioesPorUF é a divisão regional do IBGE.
//
// Não é dado curado — é constante, e por isso vive em Go e não no CSV: nenhum
// PR de curadoria agronômica deveria poder mover Minas para o Sul. Em Go o mapa
// ganha checagem de compilação e não precisa ser validado no boot.
var regioesPorUF = map[string]Regiao{
	"AC": RegiaoNorte, "AP": RegiaoNorte, "AM": RegiaoNorte, "PA": RegiaoNorte,
	"RO": RegiaoNorte, "RR": RegiaoNorte, "TO": RegiaoNorte,

	"AL": RegiaoNordeste, "BA": RegiaoNordeste, "CE": RegiaoNordeste, "MA": RegiaoNordeste,
	"PB": RegiaoNordeste, "PE": RegiaoNordeste, "PI": RegiaoNordeste, "RN": RegiaoNordeste,
	"SE": RegiaoNordeste,

	"DF": RegiaoCentroOeste, "GO": RegiaoCentroOeste,
	"MT": RegiaoCentroOeste, "MS": RegiaoCentroOeste,

	"ES": RegiaoSudeste, "MG": RegiaoSudeste, "RJ": RegiaoSudeste, "SP": RegiaoSudeste,

	"PR": RegiaoSul, "RS": RegiaoSul, "SC": RegiaoSul,
}

// RegiaoDaUF devolve a macrorregião da UF. O segundo retorno é falso para uma
// sigla desconhecida, que é um caso de perguntar ao produtor — não de erro.
func RegiaoDaUF(uf string) (Regiao, bool) {
	r, ok := regioesPorUF[strings.ToUpper(strings.TrimSpace(uf))]
	return r, ok
}

// Rotulo é a forma legível da região, para a resposta ao produtor.
func (r Regiao) Rotulo() string {
	if s, ok := rotulos[r]; ok {
		return s
	}
	return string(r)
}
