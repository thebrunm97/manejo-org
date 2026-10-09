package state

import (
	"strings"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
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

func TestPareceLocalMZSemMachamba(t *testing.T) {
	semProp := &supabase.Profile{ID: "u"}
	if !pareceLocalMZSemMachamba("258841234567", semProp, "Boane, Maputo") {
		t.Error("produtor MZ sem machamba mandando distrito, província")
	}
	for _, c := range []struct {
		phone, body string
		p           *supabase.Profile
	}{
		{"5511999999999", "Boane, Maputo", semProp},                       // não é MZ
		{"258841234567", "Boane", semProp},                                // sem província explícita
		{"258841234567", "posso semear milho em Boane, Maputo?", semProp}, // pergunta
		{"258841234567", "Boane, Maputo", &supabase.Profile{ID: "u", PropriedadeAtivaID: 7}},
	} {
		if pareceLocalMZSemMachamba(c.phone, c.p, c.body) {
			t.Errorf("não deveria capturar %q de %s", c.body, c.phone)
		}
	}
}

// O produtor de Moçambique não deve ler o vocabulário do Brasil no registo.
func TestTextosRegistoMZ(t *testing.T) {
	const mz = "258841234567"
	d := DadosCadastro{Nome: "Ana Machava"}
	for _, txt := range []string{msgBoasVindasMZ, resumoCadastro(mz, d), MsgProcessando(mz), msgPedirMachambaMZ} {
		for _, br := range []string{"cadastr", "você", "propriedade", "Processando", "solicitação"} {
			if strings.Contains(strings.ToLower(txt), strings.ToLower(br)) {
				t.Errorf("texto MZ com %q: %q", br, txt)
			}
		}
	}
	if !strings.Contains(resumoCadastro("5511999999999", d), "Posso cadastrar") {
		t.Error("o texto do Brasil não pode mudar")
	}
}
