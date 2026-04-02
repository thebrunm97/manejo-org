package utils

import (
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// RemoveDiacritics remove acentos e caracteres especiais de uma string.
// Ex: "Uréia" -> "Ureia"
func RemoveDiacritics(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, s)
	return result
}

// Normalize converte para lowercase, remove espaços e diacríticos.
// Ex: " Uréia " -> "ureia"
func Normalize(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ToLower(s)
	return RemoveDiacritics(s)
}
