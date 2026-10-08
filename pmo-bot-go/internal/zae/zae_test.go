package zae

import (
	"strings"
	"testing"
)

// O CSV embarcado de verdade precisa carregar — inclusive a regra de que toda
// linha tem fonte e URL. É este teste que barra uma curadoria sem citação.
func TestCarregarDadosEmbarcados(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatalf("dados embarcados inválidos: %v", err)
	}
	if len(tab.zonas) != 10 {
		t.Errorf("esperava as 10 zonas agroecológicas, veio %d", len(tab.zonas))
	}
	if tab.Total() == 0 {
		t.Fatal("nenhuma janela carregada")
	}
}

func TestResolverZonas(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatal(err)
	}

	casos := []struct {
		nome, distrito, provincia string
		zonas                     []string
		porProvincia              bool
	}{
		{"distrito com zona única", "Boane", "Maputo", []string{"R1"}, false},
		{"sem acento e por código ISO", "matutuine", "L", []string{"R1", "R2"}, false},
		{"código com prefixo MZ-", "Angonia", "MZ-T", []string{"R10"}, false},
		{"três zonas", "Zumbo", "Tete", []string{"R6", "R7", "R10"}, false},
		{"capital", "KaMpfumu", "Cidade de Maputo", []string{"R1"}, true},
		{"distrito não listado cai na província", "Chókwè", "Gaza", []string{"R3"}, true},
		{"Niassa exceto Lichinga", "Cuamba", "Niassa", []string{"R7"}, true},
		{"Lichinga é exceção", "Lichinga", "Niassa", []string{"R10"}, false},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			zs, porProv, ok := tab.ResolverZonas(c.distrito, c.provincia)
			if !ok {
				t.Fatalf("não resolveu %s/%s", c.distrito, c.provincia)
			}
			var got []string
			for _, z := range zs {
				got = append(got, z.Zona)
			}
			if strings.Join(got, ",") != strings.Join(c.zonas, ",") {
				t.Errorf("zonas = %v, queria %v", got, c.zonas)
			}
			if porProv != c.porProvincia {
				t.Errorf("porProvincia = %v, queria %v", porProv, c.porProvincia)
			}
		})
	}

	if _, _, ok := tab.ResolverZonas("Boane", "Minas Gerais"); ok {
		t.Error("província inexistente não deveria resolver")
	}
}

func TestBuscarComSinonimos(t *testing.T) {
	tab, err := Carregar()
	if err != nil {
		t.Fatal(err)
	}
	for _, nome := range []string{"milho", "Milho", "maize", "corn"} {
		if js := tab.Buscar(nome, "R1"); len(js) == 0 {
			t.Errorf("%q em R1 deveria achar as janelas de milho", nome)
		}
	}
	for _, nome := range []string{"nhemba", "feijão-nhemba", "Feijao nhemba", "cowpea"} {
		if js := tab.Buscar(nome, "R2"); len(js) == 0 {
			t.Errorf("%q em R2 deveria achar feijão-nhemba", nome)
		}
	}
	// Sem dado na fonte: não inventa.
	if js := tab.Buscar("tomate", "R1"); len(js) != 0 {
		t.Errorf("tomate não tem janela na FAO para R1; veio %v", js)
	}
	if js := tab.Buscar("milho", "R9"); len(js) != 0 {
		t.Errorf("R9 não tem dado na fonte; veio %v", js)
	}
	for _, j := range tab.Buscar("milho", "R1") {
		if j.Fonte == "" || j.FonteURL == "" || j.Epoca == "" {
			t.Errorf("janela sem fonte/época: %+v", j)
		}
	}
}

func TestCarregarDeRecusaLinhaSemFonte(t *testing.T) {
	zonas := "zona,fao_aez_id,unidades_administrativas,praticas_agricolas,fonte,url\nR1,001,x,y,FAO,https://fao\n"
	distritos := "provincia,distrito,zona,cobertura,observacao,fonte,url\nL,Boane,R1,total,,FAO,https://fao\n"
	janelas := "cultura,cultura_fonte,zona,epoca,sementeira_inicio,sementeira_fim,colheita_inicio,colheita_fim,ciclo,observacao_epoca,observacao,fonte,ano,url,revisor\n" +
		"milho,Corn,R1,1a,01/10,30/11,,,,,,,2025,,\n"
	_, err := CarregarDe(strings.NewReader(zonas), strings.NewReader(distritos), strings.NewReader(janelas))
	if err == nil || !strings.Contains(err.Error(), "fonte vazia") || !strings.Contains(err.Error(), "url") {
		t.Fatalf("esperava recusa por fonte e url vazias, veio: %v", err)
	}
}

func TestCarregarDeAcumulaErros(t *testing.T) {
	zonas := "zona,fao_aez_id,unidades_administrativas,praticas_agricolas,fonte,url\nR1,001,x,y,FAO,https://fao\n"
	distritos := "provincia,distrito,zona,cobertura,observacao,fonte,url\nXX,Boane,R7,meio,,FAO,https://fao\n"
	janelas := "cultura,cultura_fonte,zona,epoca,sementeira_inicio,sementeira_fim,colheita_inicio,colheita_fim,ciclo,observacao_epoca,observacao,fonte,ano,url,revisor\n" +
		"milho,Corn,R1,3a,1/10,30/11,,,,,,FAO,2025,https://fao,\n"
	_, err := CarregarDe(strings.NewReader(zonas), strings.NewReader(distritos), strings.NewReader(janelas))
	if err == nil {
		t.Fatal("esperava erro")
	}
	for _, trecho := range []string{"provincia \"XX\"", "zona \"R7\"", "cobertura \"meio\"", "epoca \"3a\"", "dd/mm"} {
		if !strings.Contains(err.Error(), trecho) {
			t.Errorf("faltou %q no erro:\n%v", trecho, err)
		}
	}
}

func TestProvinciaISO(t *testing.T) {
	casos := map[string]string{
		"Gaza": "G", "zambezia": "Q", "Zambézia": "Q", "Maputo": "L", "Maputo Cidade": "MPM",
		"cidade de maputo": "MPM", "MZ-P": "P", "Cabo Delgado": "P", "niassa": "A",
	}
	for in, want := range casos {
		if got, ok := ProvinciaISO(in); !ok || got != want {
			t.Errorf("ProvinciaISO(%q) = %q, %v; queria %q", in, got, ok, want)
		}
	}
}

func TestSepararDistritoProvincia(t *testing.T) {
	casos := []struct {
		in, distrito, prov string
		ok                 bool
	}{
		{"Boane, Maputo", "Boane", "L", true},
		{"Chókwè - Gaza", "Chókwè", "G", true},
		{"Lichinga/A", "Lichinga", "A", true},
		{"Mocímboa da Praia, Cabo Delgado", "Mocímboa da Praia", "P", true},
		{"Xique-Xique, BA", "", "", false}, // UF brasileira: não é Moçambique
		{"São Paulo, SP", "", "", false},
		{"Boane", "", "", false},
	}
	for _, c := range casos {
		d, p, ok := SepararDistritoProvincia(c.in)
		if d != c.distrito || p != c.prov || ok != c.ok {
			t.Errorf("SepararDistritoProvincia(%q) = %q, %q, %v; queria %q, %q, %v", c.in, d, p, ok, c.distrito, c.prov, c.ok)
		}
	}
}
