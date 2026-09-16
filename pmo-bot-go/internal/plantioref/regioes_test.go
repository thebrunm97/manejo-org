package plantioref

import "testing"

func TestMapaTem27UFs(t *testing.T) {
	if len(regioesPorUF) != 27 {
		t.Fatalf("regioesPorUF tem %d entradas, esperado 27", len(regioesPorUF))
	}
	for uf, r := range regioesPorUF {
		if !regioesValidas[r] || r == RegiaoBrasil {
			t.Errorf("UF %s mapeada para região inválida %q", uf, r)
		}
	}
}

// Spot-checks dos erros clássicos de divisão regional do IBGE: DF/GO/MT/MS no
// Centro-Oeste (não Sudeste, por causa de Brasília e Goiás soarem "centrais"),
// TO no Norte (não Nordeste, apesar do nome "Tocantins" soar nordestino para
// muita gente), MS no Centro-Oeste (não Sul, apesar de "Sul de Mato Grosso").
func TestSpotChecksDivisaoRegionalIBGE(t *testing.T) {
	casos := map[string]Regiao{
		"DF": RegiaoCentroOeste,
		"GO": RegiaoCentroOeste,
		"MT": RegiaoCentroOeste,
		"MS": RegiaoCentroOeste,
		"TO": RegiaoNorte,
		"BA": RegiaoNordeste,
		"ES": RegiaoSudeste,
		"MG": RegiaoSudeste,
		"RJ": RegiaoSudeste,
		"SP": RegiaoSudeste,
		"PR": RegiaoSul,
		"RS": RegiaoSul,
		"SC": RegiaoSul,
	}
	for uf, esperado := range casos {
		got, ok := RegiaoDaUF(uf)
		if !ok {
			t.Errorf("RegiaoDaUF(%q) não encontrou nada", uf)
			continue
		}
		if got != esperado {
			t.Errorf("RegiaoDaUF(%q) = %q, esperado %q", uf, got, esperado)
		}
	}
}

func TestRegiaoDaUFNormalizaEntrada(t *testing.T) {
	casos := []string{"mg", " MG ", "Mg"}
	for _, uf := range casos {
		got, ok := RegiaoDaUF(uf)
		if !ok || got != RegiaoSudeste {
			t.Errorf("RegiaoDaUF(%q) = (%q, %v), esperado (sudeste, true)", uf, got, ok)
		}
	}
}

func TestRegiaoDaUFDesconhecida(t *testing.T) {
	if _, ok := RegiaoDaUF("XX"); ok {
		t.Fatal("RegiaoDaUF(\"XX\") deveria devolver ok=false")
	}
	if _, ok := RegiaoDaUF(""); ok {
		t.Fatal("RegiaoDaUF(\"\") deveria devolver ok=false")
	}
}

func TestRotuloRegiao(t *testing.T) {
	casos := map[Regiao]string{
		RegiaoCentroOeste: "Centro-Oeste",
		RegiaoNordeste:    "Nordeste",
		RegiaoNorte:       "Norte",
		RegiaoSudeste:     "Sudeste",
		RegiaoSul:         "Sul",
		RegiaoBrasil:      "Brasil",
	}
	for r, esperado := range casos {
		if got := r.Rotulo(); got != esperado {
			t.Errorf("Regiao(%q).Rotulo() = %q, esperado %q", r, got, esperado)
		}
	}
}
