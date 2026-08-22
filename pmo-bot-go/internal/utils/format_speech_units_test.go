package utils

import (
	"strings"
	"testing"
)

func TestSanitizeForSpeech_Units(t *testing.T) {
	cases := []struct{ name, in, want string }{
		{"grau celsius", "máxima de 28°C", "máxima de 28 graus Celsius"},
		{"grau com espaco", "mínima de 13 °C", "mínima de 13 graus Celsius"},
		{"milimetros", "evapotranspiração é de 5,08 mm", "evapotranspiração é de 5,08 milímetros"},
		{"mm por dia antes de mm solto", "acima de 5 mm/dia", "acima de 5 milímetros por dia"},
		{"porcento", "80% de umidade", "80 por cento de umidade"},
		{"quilos", "colheu 420 kg", "colheu 420 quilos"},
		{"hectares", "área de 12 ha", "área de 12 hectares"},
		{"grau sem unidade", "girou 90°", "girou 90 graus"},
		{"nao mexe em palavra com mm", "programme", "programme"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SanitizeForSpeech(tc.in); got != tc.want {
				t.Errorf("in=%q\n got=%q\nwant=%q", tc.in, got, tc.want)
			}
		})
	}
}

func TestSanitizeForSpeech_Dates(t *testing.T) {
	cases := []struct{ name, in, want string }{
		{"data curta", "Hoje (22/08): Céu limpo", "Hoje (22 de agosto): Céu limpo"},
		{"data completa", "vencimento 05/03/2026", "vencimento 5 de março de 2026"},
		{"mes invalido fica intacto", "razão 22/99", "razão 22/99"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SanitizeForSpeech(tc.in); got != tc.want {
				t.Errorf("in=%q\n got=%q\nwant=%q", tc.in, got, tc.want)
			}
		})
	}
}

// A mensagem real que o produtor recebeu, ponta a ponta.
func TestSanitizeForSpeech_RealWeatherMessage(t *testing.T) {
	in := "🌿 *Consulta Técnica:*\n\n*   Hoje (22/08): Céu limpo, com temperatura máxima de 28°C e mínima de 13°C. O índice de radiação UV está em 7,35 e a evapotranspiração é de 5,08 mm.\n\n*Dica de manejo:* Como os índices estão elevados (acima de 5 mm/dia), fique atento. ☀️🌡️"
	got := SanitizeForSpeech(in)

	for _, forbidden := range []string{"*", "°", "🌿", "☀️", "/dia"} {
		if strings.Contains(got, forbidden) {
			t.Errorf("saída ainda contém %q:\n%s", forbidden, got)
		}
	}
	for _, expected := range []string{"28 graus Celsius", "22 de agosto", "5,08 milímetros", "5 milímetros por dia"} {
		if !strings.Contains(got, expected) {
			t.Errorf("saída deveria conter %q:\n%s", expected, got)
		}
	}
}
