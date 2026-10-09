package state

import (
	"strings"
	"testing"
)

func TestInterpretarMachambaMZ(t *testing.T) {
	tab, err := tabelaZAE()
	if err != nil {
		t.Fatal(err)
	}

	casos := []struct {
		texto, distrito, prov string
		res                   resultadoMachamba
	}{
		{"Boane, Maputo", "Boane", "L", machambaOK},
		{"Chókwè - Gaza", "Chókwè", "G", machambaOK}, // fora da lista: zona pela província
		{"boane", "boane", "L", machambaOK},          // só o distrito, província única
		{"Inventado, Maputo", "Inventado", "L", machambaNaoReconhecida},
		{"Inventado", "Inventado", "", machambaNaoReconhecida},
		{"quando semear milho?", "", "", machambaOutroAssunto},
		{"tenho uma machamba perto do rio no distrito", "", "", machambaOutroAssunto},
		{"   ", "", "", machambaNaoReconhecida},
	}
	for _, c := range casos {
		local, res := interpretarMachambaMZ(tab, c.texto)
		if res != c.res || local.Distrito != c.distrito || local.Provincia != c.prov {
			t.Errorf("%q: veio (%q, %q, %v), queria (%q, %q, %v)",
				c.texto, local.Distrito, local.Provincia, res, c.distrito, c.prov, c.res)
		}
		if res == machambaOK && len(local.Zonas) == 0 {
			t.Errorf("%q: resolvido sem zona", c.texto)
		}
	}
}

func TestTextoZonas(t *testing.T) {
	tab, _ := tabelaZAE()

	l, _ := interpretarMachambaMZ(tab, "Boane, Maputo")
	if got := textoZonas(l); got != "zona agroecológica R1" {
		t.Errorf("Boane: %q", got)
	}
	l, _ = interpretarMachambaMZ(tab, "Manhiça, Maputo")
	if got := textoZonas(l); !strings.Contains(got, "R1, R2, R3") || !strings.Contains(got, "depende") {
		t.Errorf("Manhiça cruza três zonas: %q", got)
	}
	l, _ = interpretarMachambaMZ(tab, "Chókwè, Gaza")
	if got := textoZonas(l); !strings.HasPrefix(got, "provavelmente") {
		t.Errorf("zona pela província precisa avisar a incerteza: %q", got)
	}
}

func TestTelefoneMZ(t *testing.T) {
	if !ehTelefoneMZ("258841234567") || ehTelefoneMZ("5511999999999") {
		t.Error("detecção pelo DDI 258")
	}
}
