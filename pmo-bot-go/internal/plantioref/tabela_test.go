package plantioref

import (
	"fmt"
	"strings"
	"testing"
)

const cabecalhoCSV = "cultura,sistema,regiao,uf,mes_inicio,mes_fim,observacao,fonte,ano,url,revisor"

// csvSintetico monta um CSV de teste a partir do header canônico + linhas.
func csvSintetico(linhas ...string) string {
	return cabecalhoCSV + "\n" + strings.Join(linhas, "\n") + "\n"
}

// linhaValida produz uma linha de dados válida, com os campos obrigatórios
// (fonte, ano, url) já preenchidos, para os testes focarem no que varia.
func linhaValida(cultura, sistema, regiao, uf, mesInicio, mesFim string) string {
	return strings.Join([]string{
		cultura, sistema, regiao, uf, mesInicio, mesFim,
		"observacao de teste", "Fonte de Teste", "2020", "http://exemplo.org/fonte", "",
	}, ",")
}

// --- O portão de CI: o CSV embarcado tem de ser válido ---

func TestCSVEmbutidoEhValido(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatalf("Carregar() do CSV embutido falhou: %v", err)
	}
	if tab.Total() == 0 {
		t.Fatal("Carregar() não trouxe nenhuma janela")
	}

	piloto := []string{"tomate", "alface", "cenoura"}
	culturas := map[string]bool{}
	for _, c := range tab.Culturas() {
		culturas[c] = true
	}
	for _, c := range piloto {
		if !culturas[c] {
			t.Errorf("cultura do piloto %q não está no CSV embutido", c)
		}
	}

	for _, l := range tab.linhas {
		if l.Fonte == "" || l.FonteAno == 0 || l.FonteURL == "" {
			t.Errorf("linha de %q sem fonte/ano/url completos: %+v", l.Cultura, l.JanelaRef)
		}
	}

	if tab.SHA() == "" {
		t.Error("Carregar() não preencheu o SHA do conteúdo embutido")
	}
}

func TestCSVEstaOrdenado(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatalf("Carregar() falhou: %v", err)
	}
	for i := 1; i < len(tab.linhas); i++ {
		a, b := tab.linhas[i-1], tab.linhas[i]
		chaveA := chaveOrdenacao(a)
		chaveB := chaveOrdenacao(b)
		if chaveA > chaveB {
			t.Errorf("CSV fora de ordem canônica (cultura,regiao,uf,mes_inicio): linha com chave %q vem antes de %q", chaveA, chaveB)
		}
	}
}

// chaveOrdenacao monta uma chave comparável lexicograficamente na mesma ordem
// canônica exigida do CSV: cultura, regiao, uf, mes_inicio. O mês é zero-padded
// para a comparação de string respeitar a ordem numérica (não "10" < "2").
func chaveOrdenacao(l linha) string {
	mes := mesParaNumero(l.MesInicio)
	return fmt.Sprintf("%s|%s|%s|%02d", l.culturaNorm, l.regiao, l.uf, mes)
}

func TestTodaCulturaCobreTodasAsUFs(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatalf("Carregar() falhou: %v", err)
	}
	ufs := []string{
		"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
		"MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
		"SP", "SE", "TO",
	}
	if len(ufs) != 27 {
		t.Fatalf("lista de UFs do teste tem %d, esperado 27", len(ufs))
	}
	for _, cultura := range []string{"tomate", "alface", "cenoura"} {
		for _, uf := range ufs {
			if refs := tab.Buscar(cultura, uf); len(refs) == 0 {
				t.Errorf("Buscar(%q, %q) não devolveu nenhuma janela — buraco de cobertura", cultura, uf)
			}
		}
	}
}

// --- Precedência: a camada mais específica vence inteira, sem mistura ---

func TestPrecedenciaUFVenceRegiao(t *testing.T) {
	csv := csvSintetico(
		linhaValida("couve", "campo_aberto", "sudeste", "", "3", "6"),
		linhaValida("couve", "campo_aberto", "sudeste", "MG", "1", "12"),
	)
	tab, err := CarregarDe(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("CarregarDe falhou: %v", err)
	}
	refs := tab.Buscar("couve", "MG")
	if len(refs) != 1 {
		t.Fatalf("Buscar com UF específica devolveu %d janelas, esperado 1 (sem mistura com a de região)", len(refs))
	}
	if refs[0].Abrangencia != "MG" {
		t.Errorf("Abrangencia = %q, esperado \"MG\"", refs[0].Abrangencia)
	}
}

func TestPrecedenciaRegiaoVenceBrasil(t *testing.T) {
	csv := csvSintetico(
		linhaValida("couve", "protegido", "brasil", "", "1", "12"),
		linhaValida("couve", "protegido", "sudeste", "", "3", "6"),
	)
	tab, err := CarregarDe(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("CarregarDe falhou: %v", err)
	}
	refs := tab.Buscar("couve", "MG") // MG está no Sudeste
	if len(refs) != 1 {
		t.Fatalf("Buscar devolveu %d janelas, esperado 1 (região vence Brasil)", len(refs))
	}
	if refs[0].Abrangencia != "Sudeste" {
		t.Errorf("Abrangencia = %q, esperado \"Sudeste\"", refs[0].Abrangencia)
	}
}

func TestPrecedenciaBrasilComoUltimoRecurso(t *testing.T) {
	csv := csvSintetico(
		linhaValida("couve", "protegido", "brasil", "", "1", "12"),
	)
	tab, err := CarregarDe(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("CarregarDe falhou: %v", err)
	}
	// PR e RS não têm linha própria; só resta o fallback nacional.
	for _, uf := range []string{"PR", "RS"} {
		refs := tab.Buscar("couve", uf)
		if len(refs) != 1 || refs[0].Abrangencia != "Brasil" {
			t.Errorf("Buscar(couve, %q) = %+v, esperado 1 janela com Abrangencia=Brasil", uf, refs)
		}
	}
}

// --- Casamento de cultura por prefixo, nas duas direções ---

func TestCasamentoDeCulturaPorPrefixo(t *testing.T) {
	csv := csvSintetico(
		linhaValida("tomate", "campo_aberto", "sudeste", "", "2", "4"),
	)
	tab, err := CarregarDe(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("CarregarDe falhou: %v", err)
	}

	casos := []struct {
		consulta  string
		deveAchar bool
	}{
		{"tomate", true},
		{"TOMATE", true},
		{"Tomate", true},
		{"tomate cereja", true}, // prefixo da consulta casa com "tomate" do CSV
		{"quiabo", false},
	}
	for _, c := range casos {
		refs := tab.Buscar(c.consulta, "SP")
		achou := len(refs) > 0
		if achou != c.deveAchar {
			t.Errorf("Buscar(%q, SP): achou=%v, esperado=%v", c.consulta, achou, c.deveAchar)
		}
	}
}

func TestJanelaAtravessaViradaDoAno(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatalf("Carregar() falhou: %v", err)
	}
	refs := tab.Buscar("cenoura", "RS") // Sul: nov/jan no CSV curado
	if len(refs) == 0 {
		t.Fatal("Buscar(cenoura, RS) não devolveu nada")
	}
	achou := false
	for _, r := range refs {
		if r.MesInicio == "novembro" && r.MesFim == "janeiro" {
			achou = true
		}
	}
	if !achou {
		t.Errorf("nenhuma janela de cenoura no RS vai de novembro a janeiro: %+v", refs)
	}
}

// --- Validação: cada erro cita a linha, e todos são acumulados de uma vez ---

func TestCSVInvalidoERecusadoComLinha(t *testing.T) {
	casos := map[string]string{
		"mes fora do intervalo": csvSintetico(
			linhaValida("tomate", "campo_aberto", "sudeste", "", "13", "4"),
		),
		"regiao desconhecida": csvSintetico(
			linhaValida("tomate", "campo_aberto", "sertao", "", "2", "4"),
		),
		"uf incoerente com a regiao": csvSintetico(
			linhaValida("tomate", "campo_aberto", "sul", "MG", "2", "4"),
		),
		"ano invalido": csvSintetico(
			"tomate,campo_aberto,sudeste,,2,4,obs,Fonte,202,http://x.org,",
		),
		"url sem http": csvSintetico(
			"tomate,campo_aberto,sudeste,,2,4,obs,Fonte,2020,ftp://x.org,",
		),
		"fonte vazia": csvSintetico(
			"tomate,campo_aberto,sudeste,,2,4,obs,,2020,http://x.org,",
		),
		"coluna faltando": cabecalhoCSV + "\ntomate,campo_aberto,sudeste,,2,4\n",
		"sistema invalido": csvSintetico(
			linhaValida("tomate", "irrigado", "sudeste", "", "2", "4"),
		),
		"regiao brasil fora de protegido": csvSintetico(
			linhaValida("tomate", "campo_aberto", "brasil", "", "2", "4"),
		),
		"duplicata exata": csvSintetico(
			linhaValida("tomate", "campo_aberto", "sudeste", "", "2", "4"),
			linhaValida("tomate", "campo_aberto", "sudeste", "", "2", "4"),
		),
		"so header": cabecalhoCSV + "\n",
	}

	for nome, csv := range casos {
		t.Run(nome, func(t *testing.T) {
			_, err := CarregarDe(strings.NewReader(csv))
			if err == nil {
				t.Fatalf("caso %q: esperava erro, veio nil", nome)
			}
		})
	}
}

func TestCSVInvalidoCitaNumeroDaLinha(t *testing.T) {
	csv := csvSintetico(
		linhaValida("tomate", "campo_aberto", "sudeste", "", "2", "4"),
		linhaValida("alface", "campo_aberto", "sudeste", "", "13", "4"), // linha 3: mês inválido
	)
	_, err := CarregarDe(strings.NewReader(csv))
	if err == nil {
		t.Fatal("esperava erro por mês inválido")
	}
	if !strings.Contains(err.Error(), "linha 3") {
		t.Errorf("erro não cita a linha 3: %v", err)
	}
}

func TestCSVComHeaderReordenadoEhRecusado(t *testing.T) {
	csv := "sistema,cultura,regiao,uf,mes_inicio,mes_fim,observacao,fonte,ano,url,revisor\n" +
		"campo_aberto,tomate,sudeste,,2,4,obs,Fonte,2020,http://x.org,\n"
	_, err := CarregarDe(strings.NewReader(csv))
	if err == nil {
		t.Fatal("esperava erro por header reordenado")
	}
}

func TestBuscarComTabelaNilNaoQuebra(t *testing.T) {
	var tab *Tabela
	if refs := tab.Buscar("tomate", "SP"); refs != nil {
		t.Errorf("Buscar em Tabela nil deveria devolver nil, veio %+v", refs)
	}
	if got := tab.Total(); got != 0 {
		t.Errorf("Total() em Tabela nil = %d, esperado 0", got)
	}
	if got := tab.SHA(); got != "" {
		t.Errorf("SHA() em Tabela nil = %q, esperado vazio", got)
	}
	if got := tab.Culturas(); got != nil {
		t.Errorf("Culturas() em Tabela nil deveria ser nil, veio %+v", got)
	}
}
