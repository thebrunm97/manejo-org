package zae

import (
	"strings"
	"testing"
)

const cabecalhoRegionais = "cultura,regiao,sementeira_inicio,sementeira_fim,observacao,fonte,ano,url\n"

func TestRegionaisFiltraPorCultura(t *testing.T) {
	csvTxt := cabecalhoRegionais +
		"# comentário ignorado\n" +
		"milho,Sul,Outubro,Novembro,\"semear cedo\",MADER,2021,https://exemplo.test/a\n" +
		"arroz,Sul,Outubro,,,MADER,2021,https://exemplo.test/a\n"

	tab := &Tabela{}
	if err := tab.CarregarRegionais(strings.NewReader(csvTxt)); err != nil {
		t.Fatalf("CarregarRegionais: %v", err)
	}

	got := tab.Regionais("Milho")
	if len(got) != 1 {
		t.Fatalf("Regionais(milho) = %d linha(s), queria 1", len(got))
	}
	if got[0].Regiao != "Sul" || got[0].FonteAno != 2021 {
		t.Errorf("referência inesperada: %+v", got[0])
	}
	if len(tab.Regionais("tomate")) != 0 {
		t.Error("tomate não deveria ter referência regional")
	}
}

func TestRegionaisRecusaLinhaSemFonte(t *testing.T) {
	csvTxt := cabecalhoRegionais + "milho,Sul,Outubro,Novembro,,,2021,\n"

	tab := &Tabela{}
	if err := tab.CarregarRegionais(strings.NewReader(csvTxt)); err == nil {
		t.Fatal("linha sem fonte e url deveria recusar o arquivo")
	}
}

func TestRegionaisEmbutidoCarrega(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatalf("Carregar: %v", err)
	}
	vigentes, anteriores := tab.SplitRegionais("milho")
	if len(vigentes) != 3 || vigentes[0].FonteAno != 2026 {
		t.Errorf("milho deveria ter 3 referências vigentes de 2026, veio %d", len(vigentes))
	}
	if len(anteriores) != 3 || anteriores[0].FonteAno != 2021 {
		t.Errorf("milho deveria ter 3 referências anteriores de 2021, veio %d", len(anteriores))
	}
}
