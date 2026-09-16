// Package plantioref fornece janelas de plantio de REFERÊNCIA — não oficiais —
// para culturas que o ZARC/MAPA não zoneia (ver internal/zarc). São a maioria
// das hortaliças: tomate, alface, cenoura, couve, brócolis e outras não têm
// tábua de risco climático, e sem esta camada o produtor recebe um beco sem
// saída para justamente as culturas mais comuns do nosso público.
//
// O dado é uma tabela curada à mão, versionada em Git como CSV e embarcada no
// binário via go:embed — ao contrário do zarc.sqlite, que é construído fora de
// produção e montado como volume. A diferença de forma reflete a diferença de
// natureza: o ZARC é dado público de mais de 3 milhões de linhas, reconstruído
// a cada safra; esta tabela é literatura agronômica, algumas dezenas de linhas,
// que muda por PR revisado por humano. Nenhuma das duas justifica um serviço de
// banco dedicado — a pergunta relevante é a frequência de uso real, não o
// volume dos dados (ver a decisão equivalente para a base do ZARC).
//
// A separação de pacote em relação a internal/zarc é deliberada, não acidental:
// misturar as duas apagaria a fronteira entre dado oficial (audita crédito
// rural e seguro agrícola) e referência de literatura — fronteira que o handler
// em internal/mcp/tools_zarc.go gasta uma mensagem inteira reforçando ao LLM.
package plantioref

import (
	"crypto/sha256"
	"embed"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/zarc"
)

//go:embed dados/janelas_referencia.csv
var csvEmbutido embed.FS

const caminhoCSV = "dados/janelas_referencia.csv"

// header é o contrato de colunas do CSV, na ordem exata. Comparado campo a
// campo no Carregar: reordenar uma coluna num editor de planilha sem atualizar
// aqui é um erro de curadoria clássico, e não vale a pena descobri-lo em
// produção.
var header = []string{
	"cultura", "sistema", "regiao", "uf", "mes_inicio", "mes_fim",
	"observacao", "fonte", "ano", "url", "revisor",
}

var sistemasValidos = map[string]bool{
	"campo_aberto": true, "protegido": true, "qualquer": true,
}

var mesesPorExtenso = [...]string{
	"", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
	"julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
}

// linha é uma janela curada, já validada e indexada por cultura normalizada.
type linha struct {
	culturaNorm string // chave de busca
	JanelaRef
	regiao Regiao
	uf     string // "" ou UF em maiúsculas
}

// JanelaRef é uma janela de REFERÊNCIA da literatura agronômica — não a tábua
// oficial do ZARC. A forma do tipo é deliberadamente diferente de zarc.Janela:
// granularidade de MÊS (nunca "dd/mm") e nenhum campo de risco percentual ou
// portaria. Essas ausências são a fonte da verdade, não uma simplificação —
// são propriedades da literatura, e sua falta é o que impede o LLM de fundir
// esta resposta com a do ZARC na mesma frase.
type JanelaRef struct {
	Cultura     string `json:"cultura"`
	Sistema     string `json:"sistema_cultivo"` // "campo aberto" | "ambiente protegido" | "qualquer sistema"
	Abrangencia string `json:"abrangencia"`     // "MG" | "Sudeste" | "Brasil"
	MesInicio   string `json:"mes_inicio"`      // "fevereiro", nunca "02"
	MesFim      string `json:"mes_fim"`
	Observacao  string `json:"observacao,omitempty"`
	Fonte       string `json:"fonte"`
	FonteAno    int    `json:"fonte_ano"`
	FonteURL    string `json:"fonte_url"`
}

// Tabela é o conjunto de janelas de referência carregado e validado.
type Tabela struct {
	linhas     []linha
	porCultura map[string][]int // cultura normalizada -> índices em linhas
	sha        string
	total      int
}

// Carregar lê e valida o CSV embarcado no binário.
func Carregar() (*Tabela, error) {
	f, err := csvEmbutido.Open(caminhoCSV)
	if err != nil {
		return nil, fmt.Errorf("abrindo CSV embutido de plantioref: %w", err)
	}
	defer f.Close()

	conteudo, err := io.ReadAll(f)
	if err != nil {
		return nil, fmt.Errorf("lendo CSV embutido de plantioref: %w", err)
	}

	t, err := CarregarDe(strings.NewReader(string(conteudo)))
	if err != nil {
		return nil, err
	}
	t.sha = sha256Hex(conteudo)
	return t, nil
}

// CarregarDe parseia e valida um CSV a partir de qualquer io.Reader. Exportada
// para os testes montarem CSVs sintéticos sem depender do arquivo embarcado.
//
// Acumula TODOS os erros de validação encontrados, em vez de parar no
// primeiro: a curadoria é manual, e um curador corrigindo um CSV quer ver a
// lista inteira de problemas num só round, não descobri-los um a um a cada
// nova tentativa.
func CarregarDe(r io.Reader) (*Tabela, error) {
	cr := csv.NewReader(r)
	cr.Comment = '#'
	cr.FieldsPerRecord = -1 // checamos a contagem nós mesmos, para reportar o nº da linha

	registros, err := cr.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parseando CSV de plantioref: %w", err)
	}
	if len(registros) == 0 {
		return nil, fmt.Errorf("CSV de plantioref está vazio (nem header tem)")
	}

	if err := validarHeader(registros[0]); err != nil {
		return nil, err
	}

	var erros []string
	var linhas []linha
	vistos := map[string]int{} // chave de duplicata -> nº da linha original

	for i, reg := range registros[1:] {
		numLinha := i + 2 // +1 pelo header, +1 porque CSV é 1-indexado

		if len(reg) != len(header) {
			erros = append(erros, fmt.Sprintf("linha %d: %d colunas, esperado %d", numLinha, len(reg), len(header)))
			continue
		}

		l, errsLinha := validarLinha(numLinha, reg)
		erros = append(erros, errsLinha...)
		if len(errsLinha) > 0 {
			continue
		}

		chave := fmt.Sprintf("%s|%s|%s|%s|%d|%d", l.culturaNorm, l.Sistema, l.regiao, l.uf, mesParaNumero(l.MesInicio), mesParaNumero(l.MesFim))
		if outra, dup := vistos[chave]; dup {
			erros = append(erros, fmt.Sprintf("linha %d: duplicata exata da linha %d (%s)", numLinha, outra, chave))
			continue
		}
		vistos[chave] = numLinha

		linhas = append(linhas, l)
	}

	if len(erros) > 0 {
		return nil, fmt.Errorf("CSV de plantioref inválido (%d erro(s)):\n%s", len(erros), strings.Join(erros, "\n"))
	}
	if len(linhas) == 0 {
		return nil, fmt.Errorf("CSV de plantioref não tem nenhuma linha de dados válida")
	}

	t := &Tabela{linhas: linhas, total: len(linhas)}
	t.porCultura = map[string][]int{}
	for idx, l := range t.linhas {
		t.porCultura[l.culturaNorm] = append(t.porCultura[l.culturaNorm], idx)
	}
	return t, nil
}

func validarHeader(got []string) error {
	if len(got) != len(header) {
		return fmt.Errorf("header do CSV de plantioref tem %d colunas, esperado %d (%s)", len(got), len(header), strings.Join(header, ","))
	}
	for i, want := range header {
		if strings.TrimSpace(got[i]) != want {
			return fmt.Errorf("header do CSV de plantioref: coluna %d é %q, esperado %q — ordem das colunas não pode mudar sem atualizar internal/plantioref/tabela.go", i+1, got[i], want)
		}
	}
	return nil
}

// validarLinha valida uma linha de dados e a converte em linha indexada.
// Devolve todos os problemas encontrados nessa linha, não só o primeiro.
func validarLinha(numLinha int, reg []string) (linha, []string) {
	var erros []string
	get := func(i int) string { return strings.TrimSpace(reg[i]) }

	cultura := get(0)
	culturaNorm := zarc.Normalizar(cultura)
	if cultura == "" {
		erros = append(erros, fmt.Sprintf("linha %d: cultura vazia", numLinha))
	} else if cultura != culturaNorm {
		erros = append(erros, fmt.Sprintf("linha %d: cultura %q deveria estar normalizada (minúsculas, sem acento) como %q", numLinha, cultura, culturaNorm))
	}

	sistema := get(1)
	if !sistemasValidos[sistema] {
		erros = append(erros, fmt.Sprintf("linha %d: sistema %q inválido (esperado campo_aberto, protegido ou qualquer)", numLinha, sistema))
	}

	regiaoStr := get(2)
	regiao := Regiao(regiaoStr)
	if !regioesValidas[regiao] {
		erros = append(erros, fmt.Sprintf("linha %d: regiao %q inválida", numLinha, regiaoStr))
	}
	if regiao == RegiaoBrasil && sistema != "protegido" {
		erros = append(erros, fmt.Sprintf("linha %d: regiao=brasil só é aceita para sistema=protegido (ambiente controlado); campo aberto precisa de uma janela por região", numLinha))
	}

	uf := strings.ToUpper(get(3))
	if uf != "" {
		regiaoDaUF, ok := RegiaoDaUF(uf)
		if !ok {
			erros = append(erros, fmt.Sprintf("linha %d: uf %q desconhecida", numLinha, uf))
		} else if regioesValidas[regiao] && regiaoDaUF != regiao {
			erros = append(erros, fmt.Sprintf("linha %d: uf %q pertence à região %q, mas a linha diz regiao=%q", numLinha, uf, regiaoDaUF, regiaoStr))
		}
	}

	mesInicio, errMi := parseMes(get(4))
	if errMi != nil {
		erros = append(erros, fmt.Sprintf("linha %d: mes_inicio %v", numLinha, errMi))
	}
	mesFim, errMf := parseMes(get(5))
	if errMf != nil {
		erros = append(erros, fmt.Sprintf("linha %d: mes_fim %v", numLinha, errMf))
	}

	observacao := get(6)

	fonte := get(7)
	if fonte == "" {
		erros = append(erros, fmt.Sprintf("linha %d: fonte vazia — toda janela de referência precisa citar de onde veio", numLinha))
	}

	anoStr := get(8)
	ano, errAno := strconv.Atoi(anoStr)
	if errAno != nil || ano < 1990 || ano > time.Now().Year()+1 {
		erros = append(erros, fmt.Sprintf("linha %d: ano %q inválido (esperado entre 1990 e %d)", numLinha, anoStr, time.Now().Year()+1))
	}

	url := get(9)
	if !strings.HasPrefix(url, "http") {
		erros = append(erros, fmt.Sprintf("linha %d: url %q deveria começar com http", numLinha, url))
	}

	if len(erros) > 0 {
		return linha{}, erros
	}

	return linha{
		culturaNorm: culturaNorm,
		regiao:      regiao,
		uf:          uf,
		JanelaRef: JanelaRef{
			Cultura:     cultura,
			Sistema:     rotuloSistema(sistema),
			Abrangencia: abrangencia(uf, regiao),
			MesInicio:   mesesPorExtenso[mesInicio],
			MesFim:      mesesPorExtenso[mesFim],
			Observacao:  observacao,
			Fonte:       fonte,
			FonteAno:    ano,
			FonteURL:    url,
		},
	}, nil
}

func rotuloSistema(s string) string {
	switch s {
	case "campo_aberto":
		return "campo aberto"
	case "protegido":
		return "ambiente protegido"
	default:
		return "qualquer sistema"
	}
}

func abrangencia(uf string, r Regiao) string {
	if uf != "" {
		return uf
	}
	return r.Rotulo()
}

func parseMes(s string) (int, error) {
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("%q não é um número de mês", s)
	}
	if n < 1 || n > 12 {
		return 0, fmt.Errorf("%d fora do intervalo 1..12", n)
	}
	return n, nil
}

func mesParaNumero(nome string) int {
	for i, m := range mesesPorExtenso {
		if m == nome {
			return i
		}
	}
	return -1
}

// Buscar devolve as janelas de referência para a cultura e a UF informadas,
// já resolvidas pela regra de precedência: a camada mais específica vence
// INTEIRA, sem misturar com uma mais genérica. Uma linha de MG ao lado de uma
// do Sudeste faria o LLM apresentar janelas conflitantes como alternativas e
// escolher a que soa melhor — a mais específica é a mais informada, e
// substitui, não complementa.
//
// Casamento de cultura, na mesma lógica de zarc.Store.BuscarJanelas: igualdade
// exata primeiro; se vazio, prefixo do nome do CSV sobre a consulta ("alface"
// encontra "alface crespa" se existir); se ainda vazio, prefixo da consulta
// sobre o nome do CSV ("tomate cereja" cai em "tomate"). A primeira etapa que
// achar algo vence.
func (t *Tabela) Buscar(cultura, uf string) []JanelaRef {
	if t == nil {
		return nil
	}
	culturaNorm := zarc.Normalizar(cultura)
	ufNorm := strings.ToUpper(strings.TrimSpace(uf))

	candidatas := t.candidatasPorCultura(culturaNorm)
	if len(candidatas) == 0 {
		return nil
	}

	regiaoDaUF, _ := RegiaoDaUF(ufNorm)

	var porUF, porRegiao, porBrasil []JanelaRef
	for _, idx := range candidatas {
		l := t.linhas[idx]
		switch {
		case l.uf != "" && l.uf == ufNorm:
			porUF = append(porUF, l.JanelaRef)
		case l.uf == "" && l.regiao == regiaoDaUF:
			porRegiao = append(porRegiao, l.JanelaRef)
		case l.uf == "" && l.regiao == RegiaoBrasil:
			porBrasil = append(porBrasil, l.JanelaRef)
		}
	}

	switch {
	case len(porUF) > 0:
		return porUF
	case len(porRegiao) > 0:
		return porRegiao
	default:
		return porBrasil
	}
}

// candidatasPorCultura resolve o nome da cultura por prefixo nas duas direções.
func (t *Tabela) candidatasPorCultura(culturaNorm string) []int {
	if idx, ok := t.porCultura[culturaNorm]; ok {
		return idx
	}
	for chave, idx := range t.porCultura {
		if strings.HasPrefix(chave, culturaNorm) || strings.HasPrefix(culturaNorm, chave) {
			return idx
		}
	}
	return nil
}

// Culturas devolve os nomes (na forma curada, não normalizada) de todas as
// culturas presentes na tabela, ordenados. Alimenta a resposta de "cultura sem
// ZARC nem referência": o bot pode oferecer o que de fato tem.
func (t *Tabela) Culturas() []string {
	if t == nil {
		return nil
	}
	vistas := map[string]bool{}
	var out []string
	for _, l := range t.linhas {
		if !vistas[l.Cultura] {
			vistas[l.Cultura] = true
			out = append(out, l.Cultura)
		}
	}
	sort.Strings(out)
	return out
}

// SHA identifica qual conteúdo do CSV está embarcado neste binário — logado no
// boot para rastrear qual curadoria está no ar, mesmo padrão de zarc.Store.SHA.
func (t *Tabela) SHA() string {
	if t == nil {
		return ""
	}
	return t.sha
}

// Total é o número de janelas carregadas.
func (t *Tabela) Total() int {
	if t == nil {
		return 0
	}
	return t.total
}

func sha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
