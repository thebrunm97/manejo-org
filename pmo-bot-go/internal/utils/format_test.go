package utils

import "testing"

func TestSanitizeForSpeech(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "remove emoji e asteriscos do cabeçalho",
			in:   "🌿 *Consulta Técnica:*",
			want: "Consulta Técnica:",
		},
		{
			name: "remove marcadores de lista mantendo o conteúdo",
			in:   "*   Temperatura: Mínima de 16°C\n*   Condições: Sem chuva",
			want: "Temperatura: Mínima de 16 graus Celsius\nCondições: Sem chuva",
		},
		{
			// Símbolos de unidade viram palavra: o motor lia "29,7 grau cê".
			name: "expande unidades e preserva acentuação",
			in:   "Máxima de 29,7°C com 80% de umidade.",
			want: "Máxima de 29,7 graus Celsius com 80 por cento de umidade.",
		},
		{
			name: "emoji no meio da frase não gruda as palavras",
			in:   "um dia de céu limpo ☀️ hoje",
			want: "um dia de céu limpo hoje",
		},
		{
			name: "negrito e itálico somem, texto fica",
			in:   "A **evapotranspiração** está _alta_",
			want: "A evapotranspiração está alta",
		},
		{
			name: "cabeçalho markdown",
			in:   "## Previsão\nCéu limpo",
			want: "Previsão\nCéu limpo",
		},
		{
			name: "link vira só o rótulo",
			in:   "Veja [o manual](https://exemplo.com/guia) para detalhes",
			want: "Veja o manual para detalhes",
		},
		{
			name: "url solta é removida",
			in:   "Acesse https://exemplo.com/x agora",
			want: "Acesse agora",
		},
		{
			name: "bloco de código não é lido",
			in:   "Rode isto:\n```\nSELECT 1;\n```\ne pronto",
			// A quebra dupla que sobra vira só uma pausa na fala — aceitável;
			// o que não se admite é uma linha órfã cheia de espaços.
			want: "Rode isto:\n\ne pronto",
		},
		{
			name: "texto sem formatação só tem as unidades expandidas",
			in:   "Bom dia, produtor. Hoje choveu 12 mm.",
			want: "Bom dia, produtor. Hoje choveu 12 milímetros.",
		},
		{
			name: "texto sem formatação nem unidade permanece intacto",
			in:   "Bom dia, produtor. Tudo certo por aí?",
			want: "Bom dia, produtor. Tudo certo por aí?",
		},
		{
			name: "ampulheta do ACK",
			in:   "⏳ Processando sua solicitação...",
			want: "Processando sua solicitação...",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := SanitizeForSpeech(tc.in)
			if got != tc.want {
				t.Errorf("SanitizeForSpeech()\n  in:   %q\n  got:  %q\n  want: %q", tc.in, got, tc.want)
			}
		})
	}
}

// A formatação visual do WhatsApp não pode ser afetada pelo sanitizador de fala.
func TestSanitizeForWhatsAppKeepsVisualFormatting(t *testing.T) {
	in := "🌿 *Consulta Técnica:*"
	if got := SanitizeForWhatsApp(in); got != in {
		t.Errorf("formatação visual não deveria mudar: got %q, want %q", got, in)
	}
}
