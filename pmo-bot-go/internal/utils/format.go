package utils

import "strings"

// SanitizeForWhatsApp converts LLM Markdown to WhatsApp standard
func SanitizeForWhatsApp(text string) string {
	// Convert bold ** or __ to *
	text = strings.ReplaceAll(text, "**", "*")
	// Remove headers ###
	text = strings.ReplaceAll(text, "### ", "")
	text = strings.ReplaceAll(text, "## ", "")
	return text
}
