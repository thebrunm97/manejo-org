package utils

import (
	"regexp"
	"strings"
)

// regexNumOnly extrai apenas os números da string
var regexNumOnly = regexp.MustCompile(`\D`)

// SanitizePhone normaliza qualquer string de telefone recebida do WhatsApp.
// Remove sufixos como @c.us e @s.whatsapp.net, limpa não-numéricos, e
// lida com o problema do nono dígito no formato 55 (Brasil).
func SanitizePhone(phone string) string {
	// 1. Limpa os identificadores do WPPConnect
	phone = strings.Split(phone, "@")[0]

	// 2. Remove todos os caracteres não numéricos (+, -, (, ), espaços)
	numericOnly := regexNumOnly.ReplaceAllString(phone, "")

	if numericOnly == "" {
		return ""
	}

	// 3. Regra do 9º dígito (Brasil - DDI 55)
	// No banco, geralmente salvamos com DDI+DDD+9+NUMERO (13 dígitos)
	// WPPConnect pode enviar números antigos sem o 9º dígito (12 dígitos).
	logicaNonoDigito := true

	if logicaNonoDigito && strings.HasPrefix(numericOnly, "55") {
		// DDI(2) + DDD(2) + Num(8) = 12 digitos (sem o 9)
		if len(numericOnly) == 12 {
			// Injeta o dígito '9' logo após o DDD
			ddd := numericOnly[2:4]
			numero := numericOnly[4:]
			numericOnly = "55" + ddd + "9" + numero
		}
	}

	return numericOnly
}
