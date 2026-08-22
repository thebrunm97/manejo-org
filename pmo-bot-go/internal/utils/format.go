package utils

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// SanitizeForWhatsApp converts LLM Markdown to WhatsApp standard
func SanitizeForWhatsApp(text string) string {
	// Convert bold ** or __ to *
	text = strings.ReplaceAll(text, "**", "*")
	// Remove headers ###
	text = strings.ReplaceAll(text, "### ", "")
	text = strings.ReplaceAll(text, "## ", "")
	return text
}

var (
	// Marcadores de lista no início da linha ("* ", "- ", "1. ").
	reListMarker = regexp.MustCompile(`(?m)^[\t ]*(?:[*\-+•]|\d+[.)])[\t ]+`)
	// Cabeçalhos markdown.
	reHeading = regexp.MustCompile(`(?m)^[\t ]*#{1,6}[\t ]*`)
	// Blocos e trechos de código — lidos em voz alta viram ruído puro.
	reCodeFence = regexp.MustCompile("(?s)```.*?```")
	reInlineCode = regexp.MustCompile("`([^`]*)`")
	// Links markdown: preserva o rótulo, descarta a URL.
	reMarkdownLink = regexp.MustCompile(`\[([^\]]+)\]\([^)]*\)`)
	// URLs soltas — ninguém quer ouvir "agá tê tê pê dois pontos barra barra".
	reBareURL = regexp.MustCompile(`https?://\S+`)
	// Espaços/linhas em excesso deixados para trás pelas remoções acima.
	// Datas numéricas: "22/08" seria lido como "vinte e dois barra zero oito".
	reDateFull  = regexp.MustCompile(`\b(\d{1,2})/(\d{1,2})/(\d{4})\b`)
	reDateShort = regexp.MustCompile(`\b(\d{1,2})/(\d{1,2})\b`)

	reMultiSpace = regexp.MustCompile(`[ \t]{2,}`)
	// Linhas que sobraram só com espaço após as remoções acima.
	reBlankLine    = regexp.MustCompile(`(?m)^[ \t]+$`)
	reMultiNewline = regexp.MustCompile(`\n{3,}`)
)

// SanitizeForSpeech prepara o texto para ser lido por um motor de TTS.
//
// Existe porque o texto que vai para o WhatsApp é rico em formatação — negrito
// com asteriscos, marcadores de lista, emojis — e os motores de TTS leem tudo
// isso literalmente: o produtor ouvia "asterisco asterisco Consulta Técnica" e
// o nome de cada emoji. Aqui a formatação é removida e não convertida, porque
// nada dela tem equivalente falado útil.
//
// O texto exibido no WhatsApp NÃO passa por aqui: a formatação visual continua
// intacta na mensagem escrita. Esta função serve exclusivamente ao áudio.
func SanitizeForSpeech(text string) string {
	// A ordem importa: blocos de código saem antes de mexer em pontuação, e os
	// links viram rótulo antes de as URLs soltas serem varridas.
	text = reCodeFence.ReplaceAllString(text, " ")
	text = reInlineCode.ReplaceAllString(text, "$1")
	text = reMarkdownLink.ReplaceAllString(text, "$1")
	text = reBareURL.ReplaceAllString(text, " ")

	text = reHeading.ReplaceAllString(text, "")
	text = reListMarker.ReplaceAllString(text, "")

	// Ênfase: os delimitadores somem, o conteúdo permanece.
	text = strings.NewReplacer(
		"**", "", "__", "", "*", "", "_", "", "~~", "", "`", "",
	).Replace(text)

	// Antes de stripSymbols, que descartaria "°" e "%" sem deixar leitura.
	text = expandUnitsForSpeech(text)
	text = expandDatesForSpeech(text)

	text = stripSymbols(text)

	text = reMultiSpace.ReplaceAllString(text, " ")
	text = reBlankLine.ReplaceAllString(text, "")
	text = reMultiNewline.ReplaceAllString(text, "\n\n")
	return strings.TrimSpace(text)
}

// speechUnits expande abreviações para a forma falada.
//
// Um motor de TTS lê "28°C" como "vinte e oito grau cê" — tecnicamente correto,
// mas soa robótico para quem está ouvindo no campo. A ordem das entradas importa:
// as mais específicas vêm primeiro, senão "mm/dia" viraria "milímetros/dia".
var speechUnits = []struct {
	re   *regexp.Regexp
	repl string
}{
	{regexp.MustCompile(`(\d)\s*°\s*C\b`), "$1 graus Celsius"},
	{regexp.MustCompile(`(\d)\s*°\s*F\b`), "$1 graus Fahrenheit"},
	{regexp.MustCompile(`(\d)\s*°`), "$1 graus"},
	{regexp.MustCompile(`(\d)\s*mm\s*/\s*dia\b`), "$1 milímetros por dia"},
	{regexp.MustCompile(`(\d)\s*km\s*/\s*h\b`), "$1 quilômetros por hora"},
	{regexp.MustCompile(`(\d)\s*mm\b`), "$1 milímetros"},
	{regexp.MustCompile(`(\d)\s*cm\b`), "$1 centímetros"},
	{regexp.MustCompile(`(\d)\s*km\b`), "$1 quilômetros"},
	{regexp.MustCompile(`(\d)\s*kg\b`), "$1 quilos"},
	{regexp.MustCompile(`(\d)\s*ha\b`), "$1 hectares"},
	{regexp.MustCompile(`(\d)\s*m²`), "$1 metros quadrados"},
	{regexp.MustCompile(`(\d)\s*%`), "$1 por cento"},
}

func expandUnitsForSpeech(text string) string {
	for _, u := range speechUnits {
		text = u.re.ReplaceAllString(text, u.repl)
	}
	return text
}

var speechMonths = [...]string{
	"janeiro", "fevereiro", "março", "abril", "maio", "junho",
	"julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
}

// expandDatesForSpeech converte datas numéricas para a forma falada, para evitar
// que "22/08" seja lido como "vinte e dois barra zero oito".
func expandDatesForSpeech(text string) string {
	monthName := func(mm string) (string, bool) {
		m, err := strconv.Atoi(mm)
		if err != nil || m < 1 || m > 12 {
			return "", false
		}
		return speechMonths[m-1], true
	}

	text = reDateFull.ReplaceAllStringFunc(text, func(match string) string {
		p := reDateFull.FindStringSubmatch(match)
		name, ok := monthName(p[2])
		if !ok {
			return match
		}
		day, _ := strconv.Atoi(p[1])
		return fmt.Sprintf("%d de %s de %s", day, name, p[3])
	})

	return reDateShort.ReplaceAllStringFunc(text, func(match string) string {
		p := reDateShort.FindStringSubmatch(match)
		name, ok := monthName(p[2])
		if !ok {
			return match
		}
		day, _ := strconv.Atoi(p[1])
		return fmt.Sprintf("%d de %s", day, name)
	})
}

// stripSymbols remove emojis e demais pictogramas, preservando letras (com
// acentuação), dígitos, pontuação comum e os símbolos que têm leitura natural
// em português — º, ª, %, e o grau de "29 °C".
func stripSymbols(text string) string {
	var b strings.Builder
	b.Grow(len(text))

	for _, r := range text {
		switch {
		case unicode.IsLetter(r), unicode.IsDigit(r), unicode.IsSpace(r):
			b.WriteRune(r)
		case r == '°' || r == 'º' || r == 'ª' || r == '%':
			b.WriteRune(r)
		case unicode.IsPunct(r):
			b.WriteRune(r)
		default:
			// Emojis e pictogramas caem aqui (categoria So) e viram espaço, para
			// não grudar as palavras vizinhas.
			b.WriteRune(' ')
		}
	}
	return b.String()
}
