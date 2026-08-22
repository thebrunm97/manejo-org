package utils

import "testing"

// Não é asserção: imprime o texto que o motor de fala realmente receberá, para
// inspeção humana com `go test -run Preview -v`.
func TestPreviewRealWeatherSpeech(t *testing.T) {
	in := "🌿 *Consulta Técnica:*\n\nA previsão do tempo para Miraporanga, Minas Gerais, indica dias de sol e sem previsão de chuva para o período:\n\n*   *Hoje (22/08):* Céu limpo, com temperatura máxima de 28°C e mínima de 13°C. O índice de radiação UV está em 7,35 e a evapotranspiração é de 5,08 mm.\n*   *Amanhã (23/08):* Parcialmente nublado, com temperaturas variando entre 13°C e 31°C.\n\n*Dica de manejo:* Como os índices de evapotranspiração estão elevados (acima de 5 mm/dia), fique atento à necessidade de irrigação. ☀️🌡️"
	t.Logf("\n──── O QUE O MOTOR VAI FALAR ────\n%s\n─────────────────────────────────", SanitizeForSpeech(in))
}
