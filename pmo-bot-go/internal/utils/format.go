package utils

import (
	"strings"
)

// SanitizeForWhatsApp converts standard Markdown bold (**) to WhatsApp bold (*)
// and ensures lists remain readable for the WhatsApp mobile/web clients.
func SanitizeForWhatsApp(text string) string {
	if text == "" {
		return ""
	}

	// 1. Replace double asterisks (Markdown bold) with single asterisks (WhatsApp bold)
	// Note: We replace "**" with "*" everywhere. Since WhatsApp uses "*" for bold,
	// " *text* " will work correctly.
	text = strings.ReplaceAll(text, "**", "*")

	// 2. Ensuring lists are readable.
	// Common Markdown lists use "- " or "* ". 
	// WhatsApp supports these as bullet points if they are at the start of a line.
	// Usually, no change is needed for basic lists, but we can ensure they 
	// don't have stray double-asterisks if the LLM used them for list markers.
	
	return strings.TrimSpace(text)
}
