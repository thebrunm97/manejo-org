// Package zae fornece janelas de sementeira de REFERÊNCIA para Moçambique,
// organizadas pelas 10 Zonas Agroecológicas (R1–R10) do IIAM.
//
// Moçambique não tem equivalente digital ao ZARC brasileiro (tábua oficial de
// risco climático por município, ligada a crédito e seguro). O que existe de
// aberto e estruturado é o calendário agrícola da FAO por zona agroecológica,
// e é ele a base desta tabela. Por isso este pacote é irmão de
// internal/plantioref, não de internal/zarc: tudo aqui é REFERÊNCIA publicada,
// sem percentual de risco nem portaria, e a ferramenta que o consome
// (internal/mcp/tools_zarc.go) diz isso ao produtor com todas as letras.
//
// Os dados ficam em CSVs embarcados no binário (go:embed), como em plantioref:
//
//	dados/zonas.csv           — R1–R10 (gerado: scripts/ingestion/fao_cropcalendar_mz.py)
//	dados/janelas_fao.csv     — calendário da FAO (gerado pelo mesmo script)
//	dados/janelas_manual.csv  — outras fontes (IIAM, MASA...), curadas à mão
//	dados/distritos_zonas.csv — distrito → zona(s), curado à mão do texto da FAO
//
// Toda linha precisa de fonte e URL: Carregar recusa a tabela inteira se uma
// faltar. Sem revisor agronômico disponível, a citação é a única garantia de
// que nada foi inventado.
package zae

import (
	"embed"
	"encoding/csv"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/zarc"
)

//go:embed dados/*.csv
var dadosEmbutidos embed.FS

// Provincias mapeia o código ISO 3166-2:MZ (sem o prefixo "MZ-") para o nome.
// É o que vai em propriedades.uf quando propriedades.pais = 'MZ'.
var Provincias = map[string]string{
	"L": "Maputo", "MPM": "Maputo Cidade", "G": "Gaza", "I": "Inhambane",
	"S": "Sofala", "B": "Manica", "T": "Tete", "Q": "Zambézia",
	"N": "Nampula", "P": "Cabo Delgado", "A": "Niassa",
}

// ProvinciaISO aceita o código ("G", "MZ-G") ou o nome ("Gaza", "zambezia",
// "Cidade de Maputo") e devolve o código. "Maputo" sozinho é a PROVÍNCIA (L);
// a capital precisa vir como "Maputo Cidade" ou "Cidade de Maputo".
func ProvinciaISO(s string) (string, bool) {
	up := strings.ToUpper(strings.TrimPrefix(strings.ToUpper(strings.TrimSpace(s)), "MZ-"))
	if _, ok := Provincias[up]; ok {
		return up, true
	}
	n := chave(s)
	switch n {
	case "maputo cidade", "cidade de maputo", "maputo city", "cidade do maputo":
		return "MPM", true
	case "maputo provincia", "provincia de maputo":
		return "L", true
	}
	for cod, nome := range Provincias {
		if chave(nome) == n {
			return cod, true
		}
	}
	return "", false
}

// SepararDistritoProvincia lê "Boane, Maputo", "Chókwè - Gaza", "Lichinga/A"
// e devolve o distrito e a província ISO. ok=false quando a parte final não é
// uma província de Moçambique — aí o texto é tratado como cidade/UF do Brasil.
// Nenhuma província (nem código) colide com UF brasileira.
func SepararDistritoProvincia(s string) (distrito, provincia string, ok bool) {
	s = strings.TrimSpace(s)
	for _, sep := range []string{",", " - ", "/"} {
		if i := strings.LastIndex(s, sep); i > 0 {
			if prov, okProv := ProvinciaISO(s[i+len(sep):]); okProv {
				return strings.TrimSpace(s[:i]), prov, true
			}
		}
	}
	return "", "", false
}

// ZonaDoDistrito é uma zona agroecológica possível para um distrito.
type ZonaDoDistrito struct {
	Zona       string `json:"zona"`
	Cobertura  string `json:"cobertura"` // "total" | "parcial"
	Observacao string `json:"observacao,omitempty"`
}

// Janela é uma janela de sementeira de REFERÊNCIA. Datas em "dd/mm" do ano
// civil, podendo atravessar a virada do ano. Sem risco percentual: a fonte não
// tem, e a ausência é intencional (ver o doc do pacote).
type Janela struct {
	Cultura          string `json:"cultura"`
	Zona             string `json:"zona"`
	Epoca            string `json:"epoca"` // "1ª época" | "2ª época" | "época única" | "todo o ano"
	SementeiraInicio string `json:"sementeira_inicio,omitempty"`
	SementeiraFim    string `json:"sementeira_fim,omitempty"`
	ColheitaInicio   string `json:"colheita_inicio,omitempty"`
	ColheitaFim      string `json:"colheita_fim,omitempty"`
	Ciclo            string `json:"ciclo,omitempty"`
	ObservacaoEpoca  string `json:"observacao_epoca,omitempty"`
	Observacao       string `json:"observacao,omitempty"`
	Fonte            string `json:"fonte"`
	FonteAno         int    `json:"fonte_ano"`
	FonteURL         string `json:"fonte_url"`
	Revisado         bool   `json:"revisado_por_agronomo"`
}

// Variedade é uma ficha do "Catálogo de Tecnologias Libertadas pelo IIAM
// 2011-2022" (dados/variedades_iiam.csv, gerado por
// scripts/ingestion/iiam_variedades.py). Ficha é o texto ORIGINAL da fonte e é
// dele que o bot deve responder; os demais campos só existem quando a extração
// foi inequívoca (vazio = não extraído, nunca chutado).
type Variedade struct {
	Cultura       string `json:"cultura"`
	Variedade     string `json:"variedade"`
	Tipo          string `json:"tipo,omitempty"`
	Maturacao     string `json:"maturacao,omitempty"`
	Rendimento    string `json:"rendimento,omitempty"`
	AnoLibertacao string `json:"ano_libertacao,omitempty"`
	Ficha         string `json:"ficha"`
	Pagina        int    `json:"pagina"`
	NotaCuradoria string `json:"nota_curadoria,omitempty"`
	Fonte         string `json:"fonte"`
	FonteURL      string `json:"fonte_url"`
}

// Tabela é o conjunto validado de zonas, distritos e janelas.
type Tabela struct {
	variedades map[string][]Variedade                 // cultura (chave) -> fichas do IIAM
	zonas      map[string]string                      // R1 -> unidades administrativas (texto da fonte)
	distritos  map[string]map[string][]ZonaDoDistrito // provincia -> distrito (chave) ou "*" -> zonas
	porCultura map[string][]Janela                    // cultura (chave) -> janelas
	total      int
}

var (
	headerZonas      = []string{"zona", "fao_aez_id", "unidades_administrativas", "praticas_agricolas", "fonte", "url"}
	headerDistritos  = []string{"provincia", "distrito", "zona", "cobertura", "observacao", "fonte", "url"}
	headerVariedades = []string{"cultura", "variedade", "tipo", "maturacao", "rendimento", "ano_libertacao", "ficha", "pagina", "nota_curadoria", "fonte", "url"}
	headerJanelas    = []string{
		"cultura", "cultura_fonte", "zona", "epoca", "sementeira_inicio", "sementeira_fim",
		"colheita_inicio", "colheita_fim", "ciclo", "observacao_epoca", "observacao",
		"fonte", "ano", "url", "revisor",
	}
	rotuloEpoca = map[string]string{"1a": "1ª época", "2a": "2ª época", "unica": "época única", "todo_ano": "todo o ano"}
	reDDMM      = regexp.MustCompile(`^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$`)
)

// Carregar lê e valida os CSVs embarcados.
func Carregar() (*Tabela, error) {
	ler := func(nome string) (io.Reader, error) {
		f, err := dadosEmbutidos.Open("dados/" + nome)
		if err != nil {
			return nil, fmt.Errorf("abrindo %s embutido: %w", nome, err)
		}
		return f, nil
	}
	zonas, err := ler("zonas.csv")
	if err != nil {
		return nil, err
	}
	distritos, err := ler("distritos_zonas.csv")
	if err != nil {
		return nil, err
	}
	fao, err := ler("janelas_fao.csv")
	if err != nil {
		return nil, err
	}
	manual, err := ler("janelas_manual.csv")
	if err != nil {
		return nil, err
	}
	t, err := CarregarDe(zonas, distritos, fao, manual)
	if err != nil {
		return nil, err
	}
	variedades, err := ler("variedades_iiam.csv")
	if err != nil {
		return nil, err
	}
	if err := t.CarregarVariedades(variedades); err != nil {
		return nil, err
	}
	return t, nil
}

// CarregarVariedades valida e indexa as fichas de variedades do IIAM.
func (t *Tabela) CarregarVariedades(r io.Reader) error {
	linhas, err := lerCSV("variedades_iiam.csv", r, headerVariedades)
	if err != nil {
		return err
	}
	var erros []string
	t.variedades = map[string][]Variedade{}
	for _, l := range linhas {
		errs := exigirFonte(l, 9, 10)
		if l.campo(0) == "" || l.campo(1) == "" || l.campo(6) == "" {
			errs = append(errs, l.erro("cultura, variedade e ficha são obrigatórias"))
		}
		pagina, errPag := strconv.Atoi(l.campo(7))
		if errPag != nil || pagina <= 0 {
			errs = append(errs, l.erro("pagina %q inválida", l.campo(7)))
		}
		erros = append(erros, errs...)
		if len(errs) > 0 {
			continue
		}
		k := canonica(l.campo(0))
		t.variedades[k] = append(t.variedades[k], Variedade{
			Cultura: l.campo(0), Variedade: l.campo(1), Tipo: l.campo(2), Maturacao: l.campo(3),
			Rendimento: l.campo(4), AnoLibertacao: l.campo(5), Ficha: l.campo(6), Pagina: pagina,
			NotaCuradoria: l.campo(8), Fonte: l.campo(9), FonteURL: l.campo(10),
		})
	}
	if len(erros) > 0 {
		return fmt.Errorf("variedades_iiam.csv inválido (%d erro(s)):\n%s", len(erros), strings.Join(erros, "\n"))
	}
	return nil
}

// Variedades devolve as fichas do IIAM para a cultura (com sinônimos e
// casamento por prefixo, como Buscar).
func (t *Tabela) Variedades(cultura string) []Variedade {
	if t == nil || len(t.variedades) == 0 {
		return nil
	}
	k := canonica(cultura)
	if k == "" {
		return nil
	}
	if vs, ok := t.variedades[k]; ok {
		return vs
	}
	chaves := make([]string, 0, len(t.variedades))
	for c := range t.variedades {
		chaves = append(chaves, c)
	}
	sort.Strings(chaves)
	for _, c := range chaves {
		if strings.HasPrefix(k, c) || strings.HasPrefix(c, k) {
			return t.variedades[c]
		}
	}
	return nil
}

// CarregarDe valida e monta a tabela a partir de leitores arbitrários —
// exportada para testes com CSVs sintéticos. Acumula todos os erros, como
// plantioref: quem corrige a curadoria quer a lista inteira de uma vez.
func CarregarDe(zonasCSV, distritosCSV io.Reader, janelasCSVs ...io.Reader) (*Tabela, error) {
	t := &Tabela{
		zonas:      map[string]string{},
		distritos:  map[string]map[string][]ZonaDoDistrito{},
		porCultura: map[string][]Janela{},
	}
	var erros []string

	linhas, err := lerCSV("zonas.csv", zonasCSV, headerZonas)
	if err != nil {
		return nil, err
	}
	for _, l := range linhas {
		erros = append(erros, exigirFonte(l, 4, 5)...)
		t.zonas[l.campo(0)] = l.campo(2)
	}

	linhas, err = lerCSV("distritos_zonas.csv", distritosCSV, headerDistritos)
	if err != nil {
		return nil, err
	}
	for _, l := range linhas {
		erros = append(erros, exigirFonte(l, 5, 6)...)
		prov, distrito, zona, cob := l.campo(0), l.campo(1), l.campo(2), l.campo(3)
		if _, ok := Provincias[prov]; !ok {
			erros = append(erros, l.erro("provincia %q não é um código ISO 3166-2:MZ válido", prov))
		}
		if _, ok := t.zonas[zona]; !ok {
			erros = append(erros, l.erro("zona %q não existe em zonas.csv", zona))
		}
		if cob != "total" && cob != "parcial" {
			erros = append(erros, l.erro("cobertura %q inválida (total|parcial)", cob))
		}
		if distrito == "" {
			erros = append(erros, l.erro("distrito vazio (use * para o resto da província)"))
		}
		k := distrito
		if k != "*" {
			k = chave(distrito)
		}
		if t.distritos[prov] == nil {
			t.distritos[prov] = map[string][]ZonaDoDistrito{}
		}
		t.distritos[prov][k] = append(t.distritos[prov][k], ZonaDoDistrito{Zona: zona, Cobertura: cob, Observacao: l.campo(4)})
	}

	for i, r := range janelasCSVs {
		linhas, err = lerCSV(fmt.Sprintf("janelas[%d]", i), r, headerJanelas)
		if err != nil {
			return nil, err
		}
		for _, l := range linhas {
			j, errs := t.validarJanela(l)
			erros = append(erros, errs...)
			if len(errs) == 0 {
				k := canonica(j.Cultura)
				t.porCultura[k] = append(t.porCultura[k], j)
				t.total++
			}
		}
	}

	if len(erros) > 0 {
		return nil, fmt.Errorf("tabelas de zae inválidas (%d erro(s)):\n%s", len(erros), strings.Join(erros, "\n"))
	}
	if len(t.zonas) == 0 || t.total == 0 {
		return nil, fmt.Errorf("tabelas de zae vazias (zonas=%d, janelas=%d)", len(t.zonas), t.total)
	}
	return t, nil
}

func (t *Tabela) validarJanela(l linhaCSV) (Janela, []string) {
	errs := exigirFonte(l, 11, 13)
	if l.campo(0) == "" {
		errs = append(errs, l.erro("cultura vazia"))
	}
	if _, ok := t.zonas[l.campo(2)]; !ok {
		errs = append(errs, l.erro("zona %q não existe em zonas.csv", l.campo(2)))
	}
	epoca, ok := rotuloEpoca[l.campo(3)]
	if !ok {
		errs = append(errs, l.erro("epoca %q inválida (1a|2a|unica|todo_ano)", l.campo(3)))
	}
	for _, i := range []int{4, 5, 6, 7} {
		if v := l.campo(i); v != "" && !reDDMM.MatchString(v) {
			errs = append(errs, l.erro("coluna %s = %q não está em dd/mm", headerJanelas[i], v))
		}
	}
	if l.campo(3) != "todo_ano" && (l.campo(4) == "" || l.campo(5) == "") {
		errs = append(errs, l.erro("sementeira_inicio/fim obrigatórios fora de todo_ano"))
	}
	ano, errAno := strconv.Atoi(l.campo(12))
	if errAno != nil || ano < 1990 {
		errs = append(errs, l.erro("ano %q inválido", l.campo(12)))
	}
	return Janela{
		Cultura:          l.campo(0),
		Zona:             l.campo(2),
		Epoca:            epoca,
		SementeiraInicio: l.campo(4),
		SementeiraFim:    l.campo(5),
		ColheitaInicio:   l.campo(6),
		ColheitaFim:      l.campo(7),
		Ciclo:            l.campo(8),
		ObservacaoEpoca:  l.campo(9),
		Observacao:       l.campo(10),
		Fonte:            l.campo(11),
		FonteAno:         ano,
		FonteURL:         l.campo(13),
		Revisado:         l.campo(14) != "",
	}, errs
}

// ResolverZonas devolve as zonas possíveis do distrito. Sem linha específica
// para o distrito, usa a linha "*" da província (porProvincia = true), que é
// menos precisa — a ferramenta avisa o produtor nesse caso.
func (t *Tabela) ResolverZonas(distrito, provincia string) (zonas []ZonaDoDistrito, porProvincia bool, ok bool) {
	if t == nil {
		return nil, false, false
	}
	prov, okProv := ProvinciaISO(provincia)
	if !okProv {
		return nil, false, false
	}
	if z := t.distritos[prov][chave(distrito)]; len(z) > 0 {
		return z, false, true
	}
	if z := t.distritos[prov]["*"]; len(z) > 0 {
		return z, true, true
	}
	return nil, false, false
}

// ProvinciasDoDistrito devolve, em ordem, as províncias (código ISO) que têm um
// distrito com este nome na tabela. Serve para o produtor que responde só
// "Boane": com uma província só, não é preciso perguntar de novo. Só acha os
// distritos listados um a um — os cobertos pela linha "*" da província não.
func (t *Tabela) ProvinciasDoDistrito(distrito string) []string {
	if t == nil {
		return nil
	}
	k := chave(distrito)
	if k == "" || k == "*" {
		return nil
	}
	var out []string
	for prov, ds := range t.distritos {
		if len(ds[k]) > 0 {
			out = append(out, prov)
		}
	}
	sort.Strings(out)
	return out
}

// Buscar devolve as janelas da cultura numa zona. Aceita sinônimos (milho,
// maize, corn; nhemba, feijão-frade, cowpea...) e casa por prefixo nas duas
// direções, como plantioref ("feijão nhemba precoce" acha "feijão-nhemba").
func (t *Tabela) Buscar(cultura, zona string) []Janela {
	if t == nil {
		return nil
	}
	var out []Janela
	for _, j := range t.candidatas(canonica(cultura)) {
		if j.Zona == zona {
			out = append(out, j)
		}
	}
	return out
}

func (t *Tabela) candidatas(k string) []Janela {
	if k == "" {
		return nil
	}
	if js, ok := t.porCultura[k]; ok {
		return js
	}
	chaves := make([]string, 0, len(t.porCultura))
	for c := range t.porCultura {
		chaves = append(chaves, c)
	}
	sort.Strings(chaves) // determinístico quando mais de uma casa
	for _, c := range chaves {
		if strings.HasPrefix(k, c) || strings.HasPrefix(c, k) {
			return t.porCultura[c]
		}
	}
	return nil
}

// CulturasDaZona lista as culturas com janela na zona — para responder "não
// tenho dado de X" oferecendo o que existe.
func (t *Tabela) CulturasDaZona(zona string) []string {
	if t == nil {
		return nil
	}
	vistas := map[string]bool{}
	var out []string
	for _, js := range t.porCultura {
		for _, j := range js {
			if j.Zona == zona && !vistas[j.Cultura] {
				vistas[j.Cultura] = true
				out = append(out, j.Cultura)
			}
		}
	}
	sort.Strings(out)
	return out
}

// Total é o número de janelas carregadas (para log de boot).
func (t *Tabela) Total() int { return t.total }

// chave normaliza para comparação: sem acento, minúsculas, hífen = espaço.
func chave(s string) string {
	return strings.Join(strings.Fields(strings.ReplaceAll(zarc.Normalizar(s), "-", " ")), " ")
}

// sinonimos leva a forma como o produtor (MZ ou BR) ou a fonte (inglês) diz a
// cultura até o nome canônico usado nos CSVs.
var sinonimos = map[string]string{
	"maize": "milho", "corn": "milho", "milho": "milho",
	"groundnut": "amendoim", "peanut": "amendoim",
	"nhemba": "feijao nhemba", "feijao frade": "feijao nhemba", "feijao de corda": "feijao nhemba",
	"feijao macassar": "feijao nhemba", "cowpea": "feijao nhemba",
	"feijao comum": "feijao", "feijao vulgar": "feijao", "bean": "feijao",
	"sesamo": "gergelim", "sesame": "gergelim",
	"milheto": "mexoeira", "pearl millet": "mexoeira",
	"foxtail millet": "painco",
	"couve repolho":  "repolho", "cabbage": "repolho",
	"berinjela": "beringela", "eggplant": "beringela",
	"batata reno": "batata", "batata inglesa": "batata", "potato": "batata",
	"cassava": "mandioca", "macaxeira": "mandioca", "aipim": "mandioca",
	"pumpkin":      "abobora",
	"melao amargo": "cacana", "melao de sao caetano": "cacana", "bitter gourd": "cacana",
	"pak choi": "couve chinesa", "bok choy": "couve chinesa", "acelga chinesa": "couve chinesa",
	"alho porro": "alho frances", "leek": "alho frances",
	"chives": "cebolinha", "teff": "tef", "wheat": "trigo", "rice": "arroz",
	"soybean": "soja", "sunflower": "girassol", "spinach": "espinafre",
	"lettuce": "alface", "carrot": "cenoura", "garlic": "alho",
	"sorgo": "mapira", "sorghum": "mapira", "batata doce": "batata doce", "sweet potato": "batata doce",
	"amaranthus": "amaranto", "cotton": "algodao", "mango": "manga", "tomato": "tomate",
	"onion": "cebola", "barley": "cevada", "strawberry": "morango", "arracacha": "mandioquinha salsa",
}

func canonica(cultura string) string {
	k := chave(cultura)
	if c, ok := sinonimos[k]; ok {
		return c
	}
	return k
}

// ── leitura de CSV ──────────────────────────────────────────────────────────

type linhaCSV struct {
	arquivo string
	num     int
	campos  []string
}

func (l linhaCSV) campo(i int) string { return strings.TrimSpace(l.campos[i]) }

func (l linhaCSV) erro(formato string, args ...interface{}) string {
	return fmt.Sprintf("%s linha %d: %s", l.arquivo, l.num, fmt.Sprintf(formato, args...))
}

func exigirFonte(l linhaCSV, iFonte, iURL int) []string {
	var errs []string
	if l.campo(iFonte) == "" {
		errs = append(errs, l.erro("fonte vazia — toda linha precisa citar de onde veio"))
	}
	if !strings.HasPrefix(l.campo(iURL), "http") {
		errs = append(errs, l.erro("url %q deveria começar com http", l.campo(iURL)))
	}
	return errs
}

func lerCSV(nome string, r io.Reader, header []string) ([]linhaCSV, error) {
	cr := csv.NewReader(r)
	cr.Comment = '#'
	cr.FieldsPerRecord = -1
	regs, err := cr.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parseando %s: %w", nome, err)
	}
	if len(regs) == 0 {
		return nil, fmt.Errorf("%s vazio (nem header tem)", nome)
	}
	for i, want := range header {
		if i >= len(regs[0]) || strings.TrimSpace(regs[0][i]) != want {
			return nil, fmt.Errorf("%s: header deveria ser %s", nome, strings.Join(header, ","))
		}
	}
	var out []linhaCSV
	for i, reg := range regs[1:] {
		if len(reg) != len(header) {
			return nil, fmt.Errorf("%s linha %d: %d colunas, esperado %d", nome, i+2, len(reg), len(header))
		}
		out = append(out, linhaCSV{arquivo: nome, num: i + 2, campos: reg})
	}
	return out, nil
}
